import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import {
  addSessionSummary,
  applyBootstrapMemory,
  applySessionUpdate,
  extractTextPrompt,
  generateBootstrapPrompt,
  generateResumePrompt,
  generateSessionEndPrompt,
  initializeMemory,
  loadConfig,
  parseSessionUpdatePreview,
  quarantineFlaggedSessions,
  resolveMemoryDir,
  runMemoryHealthCheck
} from "@devmemory/core";

let statusBarItem: vscode.StatusBarItem;
let treeProvider: DevMemoryTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "$(book) DevMemory";
  statusBarItem.tooltip = "DevMemory AI: copy a fresh resume prompt for your next AI session.";
  statusBarItem.command = "devmemory.generateResumePrompt";
  statusBarItem.show();

  treeProvider = new DevMemoryTreeProvider();
  const treeView = vscode.window.createTreeView("devmemory.memoryView", {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });

  context.subscriptions.push(
    statusBarItem,
    treeView,
    vscode.commands.registerCommand("devmemory.initializeProject", initializeProjectCommand),
    vscode.commands.registerCommand("devmemory.generateResumePrompt", generateResumePromptCommand),
    vscode.commands.registerCommand("devmemory.addSessionSummary", addSessionSummaryCommand),
    vscode.commands.registerCommand("devmemory.openMemoryFolder", openMemoryFolderCommand),
    vscode.commands.registerCommand("devmemory.openScanReport", openScanReportCommand),
    vscode.commands.registerCommand("devmemory.generateBootstrapPrompt", generateBootstrapPromptCommand),
    vscode.commands.registerCommand("devmemory.applyBootstrapMemory", applyBootstrapMemoryCommand),
    vscode.commands.registerCommand("devmemory.generateSessionEndPrompt", generateSessionEndPromptCommand),
    vscode.commands.registerCommand("devmemory.applySessionUpdate", applySessionUpdateCommand),
    vscode.commands.registerCommand("devmemory.refreshView", () => treeProvider.refresh()),
    vscode.commands.registerCommand("devmemory.runHealthCheck", runHealthCheckCommand),
    vscode.commands.registerCommand(
      "devmemory.quarantineFlaggedSessions",
      quarantineFlaggedSessionsCommand
    )
  );

  treeProvider.refresh();
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered in the extension context.
}

async function initializeProjectCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const shouldConfirm = vscode.workspace.getConfiguration("devmemory").get<boolean>("confirmBeforeScan", true);
  if (shouldConfirm) {
    const confirmed = await vscode.window.showWarningMessage(
      "DevMemory AI will scan only allowed project files and create a local .ai-memory folder. Sensitive defaults like .env, keys, databases, node_modules, dist, and build are ignored.",
      { modal: true },
      "Initialize"
    );

    if (confirmed !== "Initialize") {
      return;
    }
  }

  let result: Awaited<ReturnType<typeof initializeMemory>>;
  try {
    result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Initializing DevMemory AI",
        cancellable: false
      },
      async () => {
        const initialized = await initializeMemory(rootDir);
        statusBarItem.text = "$(book) DevMemory: Ready";
        treeProvider.refresh();
        return initialized;
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`DevMemory AI initialization failed: ${message}`);
    return;
  }

  const detected = result.scan.detectedProfiles.map((profile) => profile.label);
  const detectedSentence =
    detected.length > 0 ? `Detected: ${detected.join(", ")}.` : "No specific stack detected.";
  const message = `Memory set up. ${detectedSentence} Tracked ${result.scan.files.length} files, skipped ${result.scan.skipped.length}. Next: Teach DevMemory About This Project.`;

  const action = await vscode.window.showInformationMessage(
    message,
    "Teach DevMemory",
    "View Scan Report"
  );

  if (action === "Teach DevMemory") {
    await generateBootstrapPromptCommand();
  } else if (action === "View Scan Report") {
    const config = await loadConfig(rootDir);
    const memoryDir = resolveMemoryDir(rootDir, config);
    await openMarkdownFile(path.join(memoryDir, "scan-report.md"));
  }
}

async function generateResumePromptCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Generating DevMemory AI resume prompt",
      cancellable: false
    },
    () => generateResumePrompt(rootDir)
  );

  await vscode.env.clipboard.writeText(extractTextPrompt(result.prompt));
  treeProvider.refresh();
  const action = await vscode.window.showInformationMessage(
    "Resume prompt copied to clipboard. Paste it into your AI before starting work. When you're done, click End AI Session.",
    "End AI Session",
    "Open Prompt"
  );

  if (action === "End AI Session") {
    await generateSessionEndPromptCommand();
  } else if (action === "Open Prompt") {
    await openMarkdownFile(result.promptPath);
  }
}

async function addSessionSummaryCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const summary = await vscode.window.showInputBox({
    title: "DevMemory AI: Add Session Summary",
    prompt: "Paste a concise durable summary of the AI coding session.",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length ? undefined : "Summary is required.")
  });

  if (!summary) {
    return;
  }

  const title = await vscode.window.showInputBox({
    title: "DevMemory AI: Session Title",
    prompt: "Optional short title for this session.",
    ignoreFocusOut: true
  });

  const result = await addSessionSummary(rootDir, { title, summary });
  await vscode.window.showInformationMessage("Session summary saved.");
  await openMarkdownFile(result.sessionPath);
}

async function generateBootstrapPromptCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Generating DevMemory AI bootstrap prompt",
      cancellable: false
    },
    () => generateBootstrapPrompt(rootDir)
  );

  await vscode.env.clipboard.writeText(extractTextPrompt(result.prompt));
  await setPendingAction(rootDir, "save-project-understanding");
  treeProvider.refresh();
  const action = await vscode.window.showInformationMessage(
    "Bootstrap prompt copied to clipboard. Paste it into your AI assistant, copy the AI's response, then click Save Project Understanding.",
    "Save Project Understanding",
    "Open Prompt"
  );

  if (action === "Save Project Understanding") {
    await applyBootstrapMemoryCommand();
  } else if (action === "Open Prompt") {
    await openMarkdownFile(result.promptPath);
  }
}

const REQUIRED_BOOTSTRAP_SECTIONS = [
  "PROJECT_SUMMARY",
  "ARCHITECTURE",
  "CURRENT_STATE",
  "NEXT_ACTIONS"
] as const;

const BOOTSTRAP_SECTION_PATTERNS: Record<(typeof REQUIRED_BOOTSTRAP_SECTIONS)[number], RegExp> = {
  PROJECT_SUMMARY: /^##\s+(PROJECT_SUMMARY|Project Summary)\s*$/im,
  ARCHITECTURE: /^##\s+(ARCHITECTURE|Architecture)\s*$/im,
  CURRENT_STATE: /^##\s+(CURRENT_STATE|Current State)\s*$/im,
  NEXT_ACTIONS: /^##\s+(NEXT_ACTIONS|Next Actions)\s*$/im
};

function missingBootstrapSections(markdown: string): string[] {
  return REQUIRED_BOOTSTRAP_SECTIONS.filter(
    (section) => !BOOTSTRAP_SECTION_PATTERNS[section].test(markdown)
  );
}

async function applyBootstrapMemoryCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const clipboardText = await vscode.env.clipboard.readText();

  if (!clipboardText.trim()) {
    await vscode.window.showErrorMessage(
      "Clipboard is empty. Copy the AI bootstrap response first."
    );
    return;
  }

  const missing = missingBootstrapSections(clipboardText);

  if (missing.length > 0) {
    const proceed = await vscode.window.showWarningMessage(
      "Clipboard does not look like the AI's project understanding response. Run \"Teach DevMemory About This Project\" first, paste the prompt into your AI assistant, copy the four-section response, then click \"Save Project Understanding\" again.",
      { modal: true },
      "Teach DevMemory About This Project",
      "Cancel"
    );
    if (proceed === "Teach DevMemory About This Project") {
      await generateBootstrapPromptCommand();
    }
    return;
  }

  const confirmed = await vscode.window.showInformationMessage(
    "Save project understanding from clipboard? This will update project-summary, architecture, current-state, and next-actions.",
    { modal: true },
    "Save",
    "Cancel"
  );
  if (confirmed !== "Save") {
    return;
  }

  let result: { filesWritten: string[] };
  try {
    result = await applyBootstrapMemory(rootDir, clipboardText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Project understanding not saved: ${message}`);
    return;
  }

  await setPendingAction(rootDir, null);
  const resume = await generateResumePrompt(rootDir);
  treeProvider.refresh();

  const action = await vscode.window.showInformationMessage(
    `Project understanding saved. Updated ${result.filesWritten.length} files. Next: Start AI Session.`,
    "Start AI Session",
    "Open Resume Prompt"
  );

  if (action === "Start AI Session") {
    await generateResumePromptCommand();
  } else if (action === "Open Resume Prompt") {
    await openMarkdownFile(resume.promptPath);
  }
}

async function generateSessionEndPromptCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Generating DevMemory AI session end prompt",
      cancellable: false
    },
    () => generateSessionEndPrompt(rootDir)
  );

  await vscode.env.clipboard.writeText(extractTextPrompt(result.prompt));
  await setPendingAction(rootDir, "save-session-summary");
  treeProvider.refresh();
  const action = await vscode.window.showInformationMessage(
    "Session end prompt copied to clipboard. Paste it into your AI at the end of the session, copy the AI's structured response, then click Save Session Summary.",
    "Save Session Summary",
    "Open Prompt"
  );

  if (action === "Save Session Summary") {
    await applySessionUpdateCommand();
  } else if (action === "Open Prompt") {
    await openMarkdownFile(result.promptPath);
  }
}

async function applySessionUpdateCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const clipboardText = await vscode.env.clipboard.readText();

  if (!clipboardText.trim()) {
    await vscode.window.showErrorMessage(
      "Clipboard is empty. Copy the AI session-end response first."
    );
    return;
  }

  const preview = await parseSessionUpdatePreview(clipboardText, rootDir);

  if (preview.missingRequired.length > 0) {
    const proceed = await vscode.window.showWarningMessage(
      "Clipboard does not look like the AI's session-end response. Run \"End AI Session\" first, paste the prompt into your AI assistant, copy the structured response, then click \"Save Session Summary\" again.",
      { modal: true },
      "End AI Session",
      "Cancel"
    );
    if (proceed === "End AI Session") {
      await generateSessionEndPromptCommand();
    }
    return;
  }

  if (preview.warnings.length > 0) {
    const summary = summarizeWarnings(preview.warnings);
    const proceed = await vscode.window.showWarningMessage(
      `Session summary has warnings: ${summary} Save anyway?`,
      { modal: true },
      "Save Anyway",
      "Cancel"
    );
    if (proceed !== "Save Anyway") {
      return;
    }
  } else {
    const confirmed = await vscode.window.showInformationMessage(
      `Save session summary from clipboard? Detected ${preview.sections.length} sections. This will append a new session log and refresh current-state and next-actions.`,
      { modal: true },
      "Save",
      "Cancel"
    );
    if (confirmed !== "Save") {
      return;
    }
  }

  let result: { filesWritten: string[] };
  try {
    result = await applySessionUpdate(rootDir, clipboardText, { warnings: preview.warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Session summary not saved: ${message}`);
    return;
  }

  await setPendingAction(rootDir, null);
  const resume = await generateResumePrompt(rootDir);
  treeProvider.refresh();

  if (preview.warnings.length > 0) {
    const action = await vscode.window.showInformationMessage(
      `Session summary saved with warnings. Updated ${result.filesWritten.length} files. Review Memory Quality when possible.`,
      "Check Memory Quality",
      "Open Resume Prompt"
    );
    if (action === "Check Memory Quality") {
      await runHealthCheckCommand();
    } else if (action === "Open Resume Prompt") {
      await openMarkdownFile(resume.promptPath);
    }
    return;
  }

  const action = await vscode.window.showInformationMessage(
    `Session summary saved. Updated ${result.filesWritten.length} files. Next: Start AI Session when you continue.`,
    "Start AI Session",
    "Open Resume Prompt"
  );

  if (action === "Start AI Session") {
    await generateResumePromptCommand();
  } else if (action === "Open Resume Prompt") {
    await openMarkdownFile(resume.promptPath);
  }
}

function summarizeWarnings(warnings: string[]): string {
  if (warnings.length <= 2) {
    return warnings.join(" ");
  }
  return `${warnings.slice(0, 2).join(" ")} (+${warnings.length - 2} more)`;
}

async function openScanReportCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir) {
    return;
  }

  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  const reportPath = path.join(memoryDir, "scan-report.md");

  try {
    await fs.access(reportPath);
    await openMarkdownFile(reportPath);
  } catch {
    const action = await vscode.window.showWarningMessage(
      "DevMemory AI scan report has not been generated yet. Initialize the project first.",
      "Initialize"
    );

    if (action === "Initialize") {
      await initializeProjectCommand();
    }
  }
}

async function openMemoryFolderCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir) {
    return;
  }

  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  const summaryPath = path.join(memoryDir, "project-summary.md");

  try {
    await fs.access(summaryPath);
    await openMarkdownFile(summaryPath);
  } catch {
    const action = await vscode.window.showWarningMessage(
      "DevMemory AI memory has not been initialized for this workspace yet.",
      "Initialize"
    );

    if (action === "Initialize") {
      await initializeProjectCommand();
    }
  }
}

async function runHealthCheckCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  let outcome: Awaited<ReturnType<typeof runMemoryHealthCheck>>;
  try {
    outcome = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Running DevMemory AI memory health check",
        cancellable: false
      },
      () => runMemoryHealthCheck(rootDir)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Memory health check failed: ${message}`);
    return;
  }

  treeProvider.refresh();

  const { result, reportPath } = outcome;
  const message =
    result.status === "healthy"
      ? "DevMemory AI memory health check passed."
      : `DevMemory AI memory needs review: ${result.warnings.length} warning(s).`;

  const action = await vscode.window.showInformationMessage(message, "Open Health Check");
  if (action === "Open Health Check") {
    await openMarkdownFile(reportPath);
  }
}

async function quarantineFlaggedSessionsCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    "Move flagged session logs to quarantine? This will not delete files.",
    { modal: true },
    "Quarantine",
    "Cancel"
  );
  if (confirmed !== "Quarantine") {
    return;
  }

  let outcome: Awaited<ReturnType<typeof quarantineFlaggedSessions>>;
  try {
    outcome = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Quarantining flagged DevMemory sessions",
        cancellable: false
      },
      () => quarantineFlaggedSessions(rootDir)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Quarantine failed: ${message}`);
    return;
  }

  treeProvider.refresh();

  const message =
    outcome.movedFiles.length > 0
      ? `Quarantined ${outcome.movedFiles.length} flagged session(s).`
      : "No flagged sessions found.";

  const action = await vscode.window.showInformationMessage(message, "Open Health Check");
  if (action === "Open Health Check") {
    await openMarkdownFile(outcome.healthCheckPath);
  }
}

function getWorkspaceRoot(): string | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    void vscode.window.showErrorMessage("Open a workspace folder before using DevMemory AI.");
    return undefined;
  }

  return workspaceFolder.uri.fsPath;
}

function ensureWorkspaceTrusted(): boolean {
  if (vscode.workspace.isTrusted) {
    return true;
  }

  void vscode.window.showErrorMessage(
    "DevMemory AI needs a trusted workspace before scanning project files."
  );
  return false;
}

async function openMarkdownFile(filePath: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document, { preview: false });
}

const PENDING_ACTION_FILE = "workflow-state.json";

type PendingAction = "save-project-understanding" | "save-session-summary";

async function setPendingAction(rootDir: string, action: PendingAction | null): Promise<void> {
  try {
    const config = await loadConfig(rootDir);
    const memoryDir = resolveMemoryDir(rootDir, config);
    await fs.mkdir(memoryDir, { recursive: true });
    const filePath = path.join(memoryDir, PENDING_ACTION_FILE);
    const payload = JSON.stringify(
      { pendingAction: action, updatedAt: new Date().toISOString() },
      null,
      2
    );
    await fs.writeFile(filePath, `${payload}\n`, "utf8");
  } catch {
    // Best-effort UX hint; never block the main flow if the file cannot be written.
  }
}

async function readPendingAction(memoryDir: string): Promise<PendingAction | null> {
  try {
    const raw = await fs.readFile(path.join(memoryDir, PENDING_ACTION_FILE), "utf8");
    const parsed = JSON.parse(raw) as { pendingAction?: unknown };
    if (
      parsed.pendingAction === "save-project-understanding" ||
      parsed.pendingAction === "save-session-summary"
    ) {
      return parsed.pendingAction;
    }
    return null;
  } catch {
    return null;
  }
}

type FlowStateKind =
  | "no-workspace"
  | "needs-attention"
  | "not-set-up"
  | "needs-understanding"
  | "needs-review"
  | "ready";

interface FlowState {
  kind: FlowStateKind;
  detectedProfiles: Array<{ id: string; label: string }>;
  fileCount: number;
  generatedAt: string | null;
  qualityLabel: string;
  qualityCodicon: string;
  detail?: string;
  pendingAction: PendingAction | null;
}

interface ManifestShape {
  generatedAt?: unknown;
  files?: unknown;
  detectedProfiles?: unknown;
}

const PLACEHOLDER_PHRASES = [
  "Replace these placeholders",
  "Document the main modules",
  "Summarize what this project is"
];

const PLACEHOLDER_FILES = [
  "project-summary.md",
  "current-state.md",
  "architecture.md"
];

interface NextStepDefinition {
  label: string;
  command: string;
  codicon: string;
  tooltip: string;
}

const TEACH_DEVMEMORY_TOOLTIP =
  "Copies a stack-aware prompt to your clipboard. Paste it into your AI, then come back and click Save Project Understanding once the AI has replied.";
const SAVE_PROJECT_UNDERSTANDING_TOOLTIP =
  "Reads the AI's project-understanding response from your clipboard and saves it into project memory. Run \"Teach DevMemory About This Project\" first if your clipboard is empty.";
const START_AI_SESSION_TOOLTIP =
  "Copies a fresh resume prompt to your clipboard. Paste it into your AI before starting work. When you're done, click End AI Session.";
const END_AI_SESSION_TOOLTIP =
  "Copies a wrap-up prompt to your clipboard. Paste it into the AI at the end of the session, then click Save Session Summary.";
const SAVE_SESSION_SUMMARY_TOOLTIP =
  "Reads the AI's session-end response from your clipboard, previews warnings, and updates current-state, next-actions, and the session log. Run \"End AI Session\" first.";
const CHECK_MEMORY_QUALITY_TOOLTIP =
  "Audits the local memory store for placeholders, missing files, and sessions applied with warnings, and writes a report.";

const NEXT_STEP_BY_STATE: Record<FlowStateKind, NextStepDefinition[]> = {
  "no-workspace": [],
  "needs-attention": [
    {
      label: "Set Up Memory",
      command: "devmemory.initializeProject",
      codicon: "rocket",
      tooltip:
        "Re-runs setup to repair the local memory store. After it completes, the next step is Teach DevMemory About This Project."
    }
  ],
  "not-set-up": [
    {
      label: "Set Up Memory",
      command: "devmemory.initializeProject",
      codicon: "rocket",
      tooltip:
        "Scans the workspace and creates the local .ai-memory store. After it completes, the next step is Teach DevMemory About This Project."
    }
  ],
  "needs-understanding": [
    {
      label: "Teach DevMemory About This Project",
      command: "devmemory.generateBootstrapPrompt",
      codicon: "lightbulb",
      tooltip: TEACH_DEVMEMORY_TOOLTIP
    },
    {
      label: "Save Project Understanding",
      command: "devmemory.applyBootstrapMemory",
      codicon: "save",
      tooltip: SAVE_PROJECT_UNDERSTANDING_TOOLTIP
    }
  ],
  "ready": [
    {
      label: "Start AI Session",
      command: "devmemory.generateResumePrompt",
      codicon: "play",
      tooltip: START_AI_SESSION_TOOLTIP
    }
  ],
  "needs-review": [
    {
      label: "Check Memory Quality",
      command: "devmemory.runHealthCheck",
      codicon: "pulse",
      tooltip: CHECK_MEMORY_QUALITY_TOOLTIP
    }
  ]
};

const DAILY_WORKFLOW_ACTIONS: NextStepDefinition[] = [
  {
    label: "Start AI Session",
    command: "devmemory.generateResumePrompt",
    codicon: "play",
    tooltip: START_AI_SESSION_TOOLTIP
  },
  {
    label: "End AI Session",
    command: "devmemory.generateSessionEndPrompt",
    codicon: "stop-circle",
    tooltip: END_AI_SESSION_TOOLTIP
  },
  {
    label: "Save Session Summary",
    command: "devmemory.applySessionUpdate",
    codicon: "cloud-upload",
    tooltip: SAVE_SESSION_SUMMARY_TOOLTIP
  }
];

const REVIEW_ACTIONS: NextStepDefinition[] = [
  {
    label: "Check Memory Quality",
    command: "devmemory.runHealthCheck",
    codicon: "pulse",
    tooltip: CHECK_MEMORY_QUALITY_TOOLTIP
  },
  {
    label: "View Scan Report",
    command: "devmemory.openScanReport",
    codicon: "checklist",
    tooltip: "Opens the latest scan report so you can see which files were tracked or skipped."
  },
  {
    label: "Open Memory Files",
    command: "devmemory.openMemoryFolder",
    codicon: "folder-opened",
    tooltip: "Opens the project-summary markdown file. Use this to inspect what DevMemory currently knows."
  }
];

const ADVANCED_ACTIONS: NextStepDefinition[] = [
  {
    label: "Save Project Understanding",
    command: "devmemory.applyBootstrapMemory",
    codicon: "save",
    tooltip: SAVE_PROJECT_UNDERSTANDING_TOOLTIP
  },
  {
    label: "Refresh View",
    command: "devmemory.refreshView",
    codicon: "refresh",
    tooltip: "Re-reads the local memory state and updates the sidebar."
  }
];

interface GroupDefinition {
  id: "next-step" | "daily" | "review" | "advanced";
  label: string;
}

const GROUP_DEFINITIONS: GroupDefinition[] = [
  { id: "next-step", label: "Next Step" },
  { id: "daily", label: "Daily Workflow" },
  { id: "review", label: "Review & Maintenance" },
  { id: "advanced", label: "Advanced" }
];

class GroupTreeItem extends vscode.TreeItem {
  constructor(public readonly groupId: GroupDefinition["id"], label: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `devmemory.group.${groupId}`;
  }
}

class DevMemoryTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private state: FlowState = {
    kind: "not-set-up",
    detectedProfiles: [],
    fileCount: 0,
    generatedAt: null,
    qualityLabel: "Unknown",
    qualityCodicon: "circle-slash",
    pendingAction: null
  };

  refresh(): void {
    void this.loadState().then(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }

  async getChildren(parent?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (parent instanceof GroupTreeItem) {
      return this.buildGroupChildren(parent.groupId);
    }
    if (parent) {
      return [];
    }
    return [...this.buildStatusItems(), ...this.buildGroups()];
  }

  private buildStatusItems(): vscode.TreeItem[] {
    const status = describeMemoryStatus(this.state);
    const techsList = this.state.detectedProfiles.map((profile) => profile.label).join(", ");
    const nextSteps = resolveNextSteps(this.state);
    const primary = nextSteps[0];

    const items: vscode.TreeItem[] = [
      makeInfoItem("Memory status", status.codicon, status.description, status.tooltip)
    ];

    items.push(
      makeInfoItem(
        "Detected technologies",
        "symbol-misc",
        techsList.length > 0 ? techsList : "—",
        techsList.length > 0
          ? `Stacks recognized in this workspace: ${techsList}.`
          : "No stack detected yet. Run \"Set Up Memory\" first."
      )
    );

    items.push(
      makeInfoItem(
        "Memory quality",
        this.state.qualityCodicon,
        this.state.qualityLabel,
        this.state.detail ?? "Result of the most recent memory health check."
      )
    );

    let nextDescription = "—";
    let nextTooltip = "Open a workspace folder to enable DevMemory AI.";
    if (primary && nextSteps.length > 1) {
      nextDescription = primary.label;
      nextTooltip = `Click "${primary.label}" first, then "${nextSteps[1].label}" once the AI has replied and you've copied its response.`;
    } else if (primary) {
      nextDescription = primary.label;
      nextTooltip = `Under "Next Step", click "${primary.label}". ${primary.tooltip}`;
    }

    items.push(
      makeInfoItem("Next recommended action", "arrow-right", nextDescription, nextTooltip)
    );

    return items;
  }

  private buildGroups(): vscode.TreeItem[] {
    return GROUP_DEFINITIONS.map((group) => new GroupTreeItem(group.id, group.label));
  }

  private buildGroupChildren(groupId: GroupDefinition["id"]): vscode.TreeItem[] {
    switch (groupId) {
      case "next-step": {
        const nextSteps = resolveNextSteps(this.state);
        if (nextSteps.length === 0) {
          return [
            makeInfoItem(
              "Open a workspace first",
              "warning",
              undefined,
              "DevMemory AI needs a workspace folder to operate."
            )
          ];
        }
        return nextSteps.map(makeActionItem);
      }
      case "daily":
        return DAILY_WORKFLOW_ACTIONS.map(makeActionItem);
      case "review":
        return REVIEW_ACTIONS.map(makeActionItem);
      case "advanced":
        return ADVANCED_ACTIONS.map(makeActionItem);
    }
  }

  private async loadState(): Promise<void> {
    const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootDir) {
      this.state = {
        kind: "no-workspace",
        detectedProfiles: [],
        fileCount: 0,
        generatedAt: null,
        qualityLabel: "Unknown",
        qualityCodicon: "circle-slash",
        detail: "Open a workspace folder to enable DevMemory AI.",
        pendingAction: null
      };
      return;
    }

    try {
      const config = await loadConfig(rootDir);
      const memoryDir = resolveMemoryDir(rootDir, config);
      const pendingAction = await readPendingAction(memoryDir);

      const manifestPath = path.join(memoryDir, "manifest.json");
      let manifestRaw: string | null = null;
      try {
        manifestRaw = await fs.readFile(manifestPath, "utf8");
      } catch {
        manifestRaw = null;
      }

      if (manifestRaw === null) {
        this.state = {
          kind: "not-set-up",
          detectedProfiles: [],
          fileCount: 0,
          generatedAt: null,
          qualityLabel: "Not run yet",
          qualityCodicon: "circle-slash",
          detail: "Run \"Set Up Memory\" to scan this workspace.",
          pendingAction
        };
        return;
      }

      let manifest: ManifestShape;
      try {
        manifest = JSON.parse(manifestRaw) as ManifestShape;
      } catch {
        this.state = {
          kind: "needs-attention",
          detectedProfiles: [],
          fileCount: 0,
          generatedAt: null,
          qualityLabel: "Invalid manifest",
          qualityCodicon: "warning",
          detail: "manifest.json is not valid JSON. Re-run \"Set Up Memory\".",
          pendingAction
        };
        return;
      }

      const detectedProfiles = Array.isArray(manifest.detectedProfiles)
        ? (manifest.detectedProfiles as Array<{ id: string; label: string }>)
        : [];
      const fileCount = Array.isArray(manifest.files) ? (manifest.files as unknown[]).length : 0;
      const generatedAt = typeof manifest.generatedAt === "string" ? manifest.generatedAt : null;

      const hasPlaceholders = await detectPlaceholders(memoryDir);
      const reviewSignal = await detectReviewSignals(memoryDir);

      let kind: FlowStateKind;
      let qualityLabel: string;
      let qualityCodicon: string;
      let detail: string | undefined;

      if (hasPlaceholders) {
        kind = "needs-understanding";
        if (pendingAction === "save-project-understanding") {
          qualityLabel = "Awaiting AI response";
          qualityCodicon = "info";
          detail = "Paste the AI's response into your clipboard and click \"Save Project Understanding\".";
        } else {
          qualityLabel = "Needs project understanding";
          qualityCodicon = "info";
          detail = "Run \"Teach DevMemory About This Project\" so the AI replaces the placeholder content.";
        }
      } else if (reviewSignal) {
        kind = "needs-review";
        qualityLabel = "Needs review";
        qualityCodicon = "warning";
        detail = reviewSignal;
      } else {
        kind = "ready";
        qualityLabel = "Healthy";
        qualityCodicon = "pass";
        detail = generatedAt
          ? `Last scan ${generatedAt}, ${fileCount} files tracked.`
          : `${fileCount} files tracked.`;
      }

      if (pendingAction === "save-session-summary") {
        qualityLabel = "Awaiting AI response";
        qualityCodicon = "info";
        detail = "Paste the AI's session-end response into your clipboard and click \"Save Session Summary\".";
      }

      this.state = {
        kind,
        detectedProfiles,
        fileCount,
        generatedAt,
        qualityLabel,
        qualityCodicon,
        detail,
        pendingAction
      };
    } catch (error) {
      this.state = {
        kind: "needs-attention",
        detectedProfiles: [],
        fileCount: 0,
        generatedAt: null,
        qualityLabel: "Needs attention",
        qualityCodicon: "warning",
        detail: error instanceof Error ? error.message : String(error),
        pendingAction: null
      };
    }
  }
}

const SAVE_SESSION_SUMMARY_ACTION: NextStepDefinition = {
  label: "Save Session Summary",
  command: "devmemory.applySessionUpdate",
  codicon: "cloud-upload",
  tooltip: SAVE_SESSION_SUMMARY_TOOLTIP
};

const END_AI_SESSION_ACTION: NextStepDefinition = {
  label: "End AI Session",
  command: "devmemory.generateSessionEndPrompt",
  codicon: "stop-circle",
  tooltip: END_AI_SESSION_TOOLTIP
};

function resolveNextSteps(state: FlowState): NextStepDefinition[] {
  if (state.pendingAction === "save-session-summary") {
    return [SAVE_SESSION_SUMMARY_ACTION, END_AI_SESSION_ACTION];
  }

  const base = NEXT_STEP_BY_STATE[state.kind];
  if (state.kind !== "needs-understanding" || state.pendingAction !== "save-project-understanding") {
    return base;
  }
  const save = base.find((step) => step.command === "devmemory.applyBootstrapMemory");
  const teach = base.find((step) => step.command === "devmemory.generateBootstrapPrompt");
  if (!save || !teach) {
    return base;
  }
  return [save, teach];
}

function describeMemoryStatus(state: FlowState): { description: string; tooltip: string; codicon: string } {
  switch (state.kind) {
    case "no-workspace":
      return {
        description: "Open a workspace first",
        tooltip: "DevMemory AI needs a workspace folder before it can scan.",
        codicon: "warning"
      };
    case "needs-attention":
      return {
        description: "Needs attention",
        tooltip: state.detail ?? "Local memory state could not be parsed.",
        codicon: "warning"
      };
    case "not-set-up":
      return {
        description: "Not set up",
        tooltip: "The .ai-memory folder has not been created yet.",
        codicon: "circle-slash"
      };
    case "needs-understanding":
      return {
        description: "Needs project understanding",
        tooltip: "Memory was set up but managed files still contain placeholder content.",
        codicon: "info"
      };
    case "needs-review":
      return {
        description: "Needs review",
        tooltip: state.detail ?? "Memory has unresolved warnings.",
        codicon: "warning"
      };
    case "ready":
      return {
        description: "Ready",
        tooltip: state.detail ?? "Memory is set up and healthy.",
        codicon: "pass"
      };
  }
}

async function detectPlaceholders(memoryDir: string): Promise<boolean> {
  for (const fileName of PLACEHOLDER_FILES) {
    let content: string;
    try {
      content = await fs.readFile(path.join(memoryDir, fileName), "utf8");
    } catch {
      continue;
    }
    if (PLACEHOLDER_PHRASES.some((phrase) => content.includes(phrase))) {
      return true;
    }
  }
  return false;
}

async function detectReviewSignals(memoryDir: string): Promise<string | null> {
  try {
    const healthRaw = await fs.readFile(path.join(memoryDir, "health-check.md"), "utf8");
    if (/^- Status:\s*needs-review/m.test(healthRaw)) {
      return "Last health check reported needs-review.";
    }
  } catch {
    // health-check.md is optional
  }

  const sessionsDir = path.join(memoryDir, "sessions");
  let entries: string[];
  try {
    entries = await fs.readdir(sessionsDir);
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md")) {
      continue;
    }
    try {
      const content = await fs.readFile(path.join(sessionsDir, entry), "utf8");
      if (content.includes("## DevMemory Warnings")) {
        return "One or more session logs were applied with warnings.";
      }
    } catch {
      // ignore unreadable session files
    }
  }
  return null;
}

function makeInfoItem(
  label: string,
  codicon: string,
  description?: string,
  tooltip?: string
): vscode.TreeItem {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(codicon);
  if (description !== undefined) {
    item.description = description;
  }
  item.tooltip = tooltip ?? (description ? `${label}: ${description}` : label);
  item.contextValue = "devmemory.statusItem";
  return item;
}

function makeActionItem(action: NextStepDefinition): vscode.TreeItem {
  const item = new vscode.TreeItem(action.label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(action.codicon);
  item.tooltip = action.tooltip;
  item.command = { command: action.command, title: action.label };
  item.contextValue = "devmemory.actionItem";
  return item;
}
