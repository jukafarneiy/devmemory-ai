import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import {
  AI_CONTEXT_TARGETS,
  addSessionSummary,
  applyBootstrapMemory,
  applySessionUpdate,
  clearTelemetry,
  exportAIContextFiles,
  exportTelemetryAsCsv,
  extractTextPrompt,
  generateBootstrapPrompt,
  generateResumePrompt,
  generateSessionEndPrompt,
  initializeMemory,
  inspectAIContextMemory,
  loadConfig,
  parseSessionUpdatePreview,
  quarantineFlaggedSessions,
  recordEvent,
  resolveMemoryDir,
  resolveTelemetryDir,
  runMemoryHealthCheck
} from "@devmemory/core";
import type { AIContextTarget } from "@devmemory/core";
import { PasteGuard } from "./guards/pasteGuard";
import { exportAuditPackCommand, verifyAuditPackCommand } from "./audit/commands";
import { ActionsTreeProvider } from "./views/actionsTree";
import { HeroWebviewProvider } from "./views/heroWebview";
import { StatusBarController } from "./views/statusBar";
import { setPendingAction } from "./views/state";
import { registerChatParticipant } from "./chat/participant";
import { registerLanguageModelTools } from "./chat/tools";
import { writeMcpManifest } from "./mcp/manifestWriter";
import { GitWatcher } from "./views/gitWatcher";

let actionsProvider: ActionsTreeProvider;
let heroProvider: HeroWebviewProvider;
let statusBar: StatusBarController;
let pasteGuard: PasteGuard | undefined;

const WALKTHROUGH_ID = "devmemory-ai.devmemory-ai-vscode#devmemory.welcome";

export function activate(context: vscode.ExtensionContext): void {
  statusBar = new StatusBarController();
  actionsProvider = new ActionsTreeProvider();
  heroProvider = new HeroWebviewProvider(context.extensionUri);

  context.subscriptions.push(
    statusBar,
    vscode.window.registerWebviewViewProvider(HeroWebviewProvider.viewType, heroProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.window.createTreeView("devmemory.actionsView", {
      treeDataProvider: actionsProvider,
      showCollapseAll: false
    }),
    pasteGuard = new PasteGuard(context),
    vscode.commands.registerCommand("devmemory.initializeProject", initializeProjectCommand),
    vscode.commands.registerCommand("devmemory.generateResumePrompt", generateResumePromptCommand),
    vscode.commands.registerCommand("devmemory.addSessionSummary", addSessionSummaryCommand),
    vscode.commands.registerCommand("devmemory.openMemoryFolder", openMemoryFolderCommand),
    vscode.commands.registerCommand("devmemory.openScanReport", openScanReportCommand),
    vscode.commands.registerCommand("devmemory.generateBootstrapPrompt", generateBootstrapPromptCommand),
    vscode.commands.registerCommand("devmemory.applyBootstrapMemory", applyBootstrapMemoryCommand),
    vscode.commands.registerCommand("devmemory.generateSessionEndPrompt", generateSessionEndPromptCommand),
    vscode.commands.registerCommand("devmemory.applySessionUpdate", applySessionUpdateCommand),
    vscode.commands.registerCommand("devmemory.refreshView", refreshViewsCommand),
    vscode.commands.registerCommand("devmemory.runHealthCheck", runHealthCheckCommand),
    vscode.commands.registerCommand("devmemory.quarantineFlaggedSessions", quarantineFlaggedSessionsCommand),
    vscode.commands.registerCommand("devmemory.exportAIContextFiles", exportAIContextFilesCommand),
    vscode.commands.registerCommand("devmemory.disablePasteGuard", disablePasteGuardCommand),
    vscode.commands.registerCommand("devmemory.viewPasteGuardLog", viewPasteGuardLogCommand),
    vscode.commands.registerCommand("devmemory.viewTelemetry", viewTelemetryCommand),
    vscode.commands.registerCommand("devmemory.exportTelemetry", exportTelemetryCommand),
    vscode.commands.registerCommand("devmemory.clearTelemetry", clearTelemetryCommand),
    vscode.commands.registerCommand("devmemory.exportAuditPack", exportAuditPackCommand),
    vscode.commands.registerCommand("devmemory.verifyAuditPack", verifyAuditPackCommand),
    vscode.commands.registerCommand("devmemory.openWalkthrough", openWalkthroughCommand),
    vscode.commands.registerCommand("devmemory.enableMcp", enableMcpCommand)
  );

  const chatParticipant = registerChatParticipant(context);
  if (chatParticipant) {
    context.subscriptions.push(chatParticipant);
  }
  context.subscriptions.push(...registerLanguageModelTools(context));

  GitWatcher.start(context);

  void refreshViewsCommand();
  statusBar.startAutoRefresh();

  if (shouldShowFirstRunWalkthrough(context)) {
    void context.globalState.update("devmemory.walkthroughShown", true);
    void vscode.commands.executeCommand("workbench.action.openWalkthrough", WALKTHROUGH_ID, false);
  }
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered in the extension context.
}

async function refreshViewsCommand(): Promise<void> {
  await heroProvider.refresh();
  actionsProvider.refresh();
  await statusBar.refresh();
}

async function openWalkthroughCommand(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.openWalkthrough", WALKTHROUGH_ID, false);
}

async function enableMcpCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir) {
    return;
  }
  const extension = vscode.extensions.getExtension("devmemory-ai.devmemory-ai-vscode");
  const extensionUri = extension?.extensionUri ?? vscode.Uri.file(__dirname).with({ path: path.dirname(__dirname) });

  let outcome: Awaited<ReturnType<typeof writeMcpManifest>>;
  try {
    outcome = await writeMcpManifest(rootDir, extensionUri);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Could not write .vscode/mcp.json: ${message}`);
    return;
  }
  await vscode.workspace
    .getConfiguration("devmemory")
    .update("exposeMcpServer", true, vscode.ConfigurationTarget.Workspace);

  const action = await vscode.window.showInformationMessage(
    `DevMemory MCP server ${outcome.action} .vscode/mcp.json. Restart your MCP-aware client (Claude Code / Cursor / Cline / Continue) to discover the server.`,
    "Open mcp.json"
  );
  if (action === "Open mcp.json") {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(outcome.filePath));
    await vscode.window.showTextDocument(document, { preview: false });
  }
}

function shouldShowFirstRunWalkthrough(context: vscode.ExtensionContext): boolean {
  if (!vscode.workspace.workspaceFolders?.length) return false;
  return !context.globalState.get<boolean>("devmemory.walkthroughShown", false);
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
      "Scan this project"
    );

    if (confirmed !== "Scan this project") {
      return;
    }
  }

  let result: Awaited<ReturnType<typeof initializeMemory>>;
  try {
    result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Scanning this project for DevMemory AI",
        cancellable: false
      },
      async () => {
        const initialized = await initializeMemory(rootDir);
        await refreshViewsCommand();
        return initialized;
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`DevMemory scan failed: ${message}`);
    return;
  }

  await recordCommandTelemetry(rootDir, "initializeProject");

  const detected = result.scan.detectedProfiles.map((profile) => profile.label);
  const detectedSentence =
    detected.length > 0 ? `Detected: ${detected.join(", ")}.` : "No specific stack detected.";
  const message = `Memory ready. ${detectedSentence} Tracked ${result.scan.files.length} files, skipped ${result.scan.skipped.length}. Next: teach the AI about this project.`;

  const action = await vscode.window.showInformationMessage(
    message,
    "Teach the AI",
    "View scan report"
  );

  if (action === "Teach the AI") {
    await generateBootstrapPromptCommand();
  } else if (action === "View scan report") {
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
      title: "Building a fresh resume prompt for your AI",
      cancellable: false
    },
    () => generateResumePrompt(rootDir)
  );

  await vscode.env.clipboard.writeText(extractTextPrompt(result.prompt));
  await refreshViewsCommand();
  const action = await vscode.window.showInformationMessage(
    "Resume prompt copied to clipboard. Paste it into your AI before starting work — or use @devmemory /resume in Copilot Chat. When you're done, click Wrap up.",
    "Wrap up session",
    "Open prompt"
  );

  if (action === "Wrap up session") {
    await generateSessionEndPromptCommand();
  } else if (action === "Open prompt") {
    await openMarkdownFile(result.promptPath);
  }
}

async function addSessionSummaryCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const summary = await vscode.window.showInputBox({
    title: "DevMemory AI: Add a manual session note",
    prompt: "Paste a concise durable summary of the AI coding session.",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim().length ? undefined : "Summary is required.")
  });

  if (!summary) {
    return;
  }

  const title = await vscode.window.showInputBox({
    title: "DevMemory AI: Session title",
    prompt: "Optional short title for this session.",
    ignoreFocusOut: true
  });

  const result = await addSessionSummary(rootDir, { title, summary });
  await vscode.window.showInformationMessage("Manual session note saved.");
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
      title: "Building a project-bootstrap prompt for your AI",
      cancellable: false
    },
    () => generateBootstrapPrompt(rootDir)
  );

  await vscode.env.clipboard.writeText(extractTextPrompt(result.prompt));
  await setPendingAction(rootDir, "save-project-understanding");
  await refreshViewsCommand();
  const action = await vscode.window.showInformationMessage(
    "Bootstrap prompt copied to clipboard. Paste it into your AI assistant, copy the response, then click Save what the AI told me.",
    "Save what the AI told me",
    "Open prompt"
  );

  if (action === "Save what the AI told me") {
    await applyBootstrapMemoryCommand();
  } else if (action === "Open prompt") {
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
    await vscode.window.showErrorMessage("Clipboard is empty. Copy the AI bootstrap response first.");
    return;
  }

  const missing = missingBootstrapSections(clipboardText);

  if (missing.length > 0) {
    const proceed = await vscode.window.showWarningMessage(
      "Clipboard does not look like the AI's project understanding response. Run \"Teach the AI about this project\", paste into your AI assistant, copy the four-section response, then click Save again.",
      { modal: true },
      "Teach the AI",
      "Cancel"
    );
    if (proceed === "Teach the AI") {
      await generateBootstrapPromptCommand();
    }
    return;
  }

  const confirmed = await vscode.window.showInformationMessage(
    "Save project understanding from clipboard? This updates project-summary, architecture, current-state, and next-actions.",
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

  await recordCommandTelemetry(rootDir, "applyBootstrapMemory");
  await setPendingAction(rootDir, null);
  const resume = await generateResumePrompt(rootDir);
  await refreshViewsCommand();

  const action = await vscode.window.showInformationMessage(
    `Project understanding saved (${result.filesWritten.length} files updated). Next: Resume an AI session.`,
    "Resume AI session",
    "Open resume prompt"
  );

  if (action === "Resume AI session") {
    await generateResumePromptCommand();
  } else if (action === "Open resume prompt") {
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
      title: "Building a session-end prompt for your AI",
      cancellable: false
    },
    () => generateSessionEndPrompt(rootDir)
  );

  await vscode.env.clipboard.writeText(extractTextPrompt(result.prompt));
  await setPendingAction(rootDir, "save-session-summary");
  await refreshViewsCommand();
  const action = await vscode.window.showInformationMessage(
    "Wrap-up prompt copied to clipboard. Paste it into your AI at the end of the session, copy the structured response, then click Save what the AI did.",
    "Save what the AI did",
    "Open prompt"
  );

  if (action === "Save what the AI did") {
    await applySessionUpdateCommand();
  } else if (action === "Open prompt") {
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
    await vscode.window.showErrorMessage("Clipboard is empty. Copy the AI session-end response first.");
    return;
  }

  const preview = await parseSessionUpdatePreview(clipboardText, rootDir);

  if (preview.missingRequired.length > 0) {
    const proceed = await vscode.window.showWarningMessage(
      "Clipboard does not look like the AI's session-end response. Run \"Wrap up session\" first, paste into your AI assistant, copy the structured response, then click Save again.",
      { modal: true },
      "Wrap up session",
      "Cancel"
    );
    if (proceed === "Wrap up session") {
      await generateSessionEndPromptCommand();
    }
    return;
  }

  if (preview.warnings.length > 0) {
    const summary = summarizeWarnings(preview.warnings);
    const proceed = await vscode.window.showWarningMessage(
      `Session summary has warnings: ${summary} Save anyway?`,
      { modal: true },
      "Save anyway",
      "Cancel"
    );
    if (proceed !== "Save anyway") {
      return;
    }
  } else {
    const confirmed = await vscode.window.showInformationMessage(
      `Save session from clipboard? Detected ${preview.sections.length} sections. Appends a session log and refreshes current-state and next-actions.`,
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
    await vscode.window.showErrorMessage(`Session not saved: ${message}`);
    return;
  }

  await recordCommandTelemetry(rootDir, "applySessionUpdate");
  await setPendingAction(rootDir, null);
  const resume = await generateResumePrompt(rootDir);
  await refreshViewsCommand();

  if (preview.warnings.length > 0) {
    const action = await vscode.window.showInformationMessage(
      `Session saved with warnings (${result.filesWritten.length} files). Run Check memory health when convenient.`,
      "Check memory health",
      "Open resume prompt"
    );
    if (action === "Check memory health") {
      await runHealthCheckCommand();
    } else if (action === "Open resume prompt") {
      await openMarkdownFile(resume.promptPath);
    }
    return;
  }

  const action = await vscode.window.showInformationMessage(
    `Session saved (${result.filesWritten.length} files). Next: Resume an AI session when you continue.`,
    "Resume AI session",
    "Open resume prompt"
  );

  if (action === "Resume AI session") {
    await generateResumePromptCommand();
  } else if (action === "Open resume prompt") {
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
      "DevMemory scan report has not been generated yet. Scan this project first.",
      "Scan this project"
    );
    if (action === "Scan this project") {
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
      "DevMemory memory has not been initialized for this workspace yet.",
      "Scan this project"
    );
    if (action === "Scan this project") {
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
        title: "Running DevMemory memory health check",
        cancellable: false
      },
      () => runMemoryHealthCheck(rootDir)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Memory health check failed: ${message}`);
    return;
  }

  await refreshViewsCommand();

  const { result, reportPath } = outcome;
  const message =
    result.status === "healthy"
      ? "DevMemory memory health check passed."
      : `DevMemory memory needs review: ${result.warnings.length} warning(s).`;

  const action = await vscode.window.showInformationMessage(message, "Open health check");
  if (action === "Open health check") {
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

  await refreshViewsCommand();

  const message =
    outcome.movedFiles.length > 0
      ? `Quarantined ${outcome.movedFiles.length} flagged session(s).`
      : "No flagged sessions found.";

  const action = await vscode.window.showInformationMessage(message, "Open health check");
  if (action === "Open health check") {
    await openMarkdownFile(outcome.healthCheckPath);
  }
}

async function exportAIContextFilesCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir || !ensureWorkspaceTrusted()) {
    return;
  }

  const inspection = await inspectAIContextMemory(rootDir);
  if (inspection.kind === "missing") {
    const action = await vscode.window.showWarningMessage(
      "DevMemory memory is incomplete. Scan this project and teach the AI about it before exporting context files.",
      "Scan this project"
    );
    if (action === "Scan this project") {
      await initializeProjectCommand();
    }
    return;
  }

  if (inspection.kind === "placeholders") {
    const fileList = inspection.files.join(", ");
    const action = await vscode.window.showWarningMessage(
      `DevMemory memory still contains placeholder content (${fileList}). Run "Teach the AI about this project" so the AI replaces it before exporting.`,
      "Teach the AI"
    );
    if (action === "Teach the AI") {
      await generateBootstrapPromptCommand();
    }
    return;
  }

  interface TargetPick extends vscode.QuickPickItem {
    target: AIContextTarget;
  }

  const items: TargetPick[] = AI_CONTEXT_TARGETS.map((target) => ({
    label: target.label,
    detail: target.filePath,
    target,
    picked: target.id !== "cursorrules"
  }));

  const picks = await vscode.window.showQuickPick<TargetPick>(items, {
    title: "DevMemory AI: Export AI Context Files",
    placeHolder:
      "Pick which context files to write or refresh. Existing human content outside the managed block is preserved.",
    canPickMany: true,
    ignoreFocusOut: true
  });

  if (!picks || picks.length === 0) {
    return;
  }

  let results;
  try {
    results = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Exporting DevMemory AI context files",
        cancellable: false
      },
      () => exportAIContextFiles(rootDir, { targets: picks.map((p) => p.target) })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`AI context export failed: ${message}`);
    return;
  }

  if (results.length === 0) {
    return;
  }

  const summary = results
    .map((r) => `${r.action} ${path.relative(rootDir, r.filePath)}`)
    .join(", ");
  const action = await vscode.window.showInformationMessage(
    `AI context export complete. ${summary}.`,
    "Open first file"
  );
  if (action === "Open first file") {
    await openMarkdownFile(results[0].filePath);
  }
}

async function disablePasteGuardCommand(): Promise<void> {
  await vscode.workspace
    .getConfiguration("devmemory")
    .update("pasteGuard.enabled", false, vscode.ConfigurationTarget.Workspace);
  await vscode.window.showInformationMessage(
    "DevMemory paste guard disabled for this workspace. Re-enable in Settings → DevMemory AI → Paste Guard."
  );
}

async function viewPasteGuardLogCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir) {
    return;
  }
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  const sessionsDir = path.join(memoryDir, "sessions");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(sessionsDir);
  } catch {
    await vscode.window.showInformationMessage(
      "No paste-guard log yet. Set up DevMemory and paste destructive content to see it in action."
    );
    return;
  }
  const logs = entries.filter((name) => name.endsWith("-paste-guard.md")).sort();
  if (logs.length === 0) {
    await vscode.window.showInformationMessage("No paste-guard events recorded yet.");
    return;
  }
  if (logs.length === 1) {
    await openMarkdownFile(path.join(sessionsDir, logs[0]));
    return;
  }
  const pick = await vscode.window.showQuickPick(
    logs.map((name) => ({ label: name, target: name })).reverse(),
    { title: "DevMemory paste-guard logs", placeHolder: "Pick a log to open (newest first)" }
  );
  if (!pick) return;
  await openMarkdownFile(path.join(sessionsDir, pick.target));
}

async function viewTelemetryCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir) {
    return;
  }
  const dir = await resolveTelemetryDir(rootDir);
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    await vscode.window.showInformationMessage(
      "Telemetry is opt-in. Enable it in Settings → DevMemory AI → Telemetry, or check that there are events recorded."
    );
    return;
  }
  const latest = entries
    .filter((n) => n.startsWith("events-") && n.endsWith(".jsonl"))
    .sort()
    .pop();
  if (!latest) {
    await vscode.window.showInformationMessage(
      "No telemetry events yet. Enable Settings → DevMemory AI → Telemetry to start collecting locally."
    );
    return;
  }
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(dir, latest)));
  await vscode.window.showTextDocument(document, { preview: false });
}

async function exportTelemetryCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir) {
    return;
  }
  const csv = await exportTelemetryAsCsv(rootDir);
  const dir = await resolveTelemetryDir(rootDir);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, `export-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.csv`);
  await fs.writeFile(target, csv, "utf8");
  const action = await vscode.window.showInformationMessage(
    `Telemetry exported to ${path.relative(rootDir, target)}.`,
    "Open"
  );
  if (action === "Open") {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
    await vscode.window.showTextDocument(document, { preview: false });
  }
}

async function clearTelemetryCommand(): Promise<void> {
  const rootDir = getWorkspaceRoot();
  if (!rootDir) {
    return;
  }
  const confirmed = await vscode.window.showWarningMessage(
    "Delete every local DevMemory telemetry file in this workspace? This cannot be undone.",
    { modal: true },
    "Delete telemetry"
  );
  if (confirmed !== "Delete telemetry") {
    return;
  }
  const result = await clearTelemetry(rootDir);
  await vscode.window.showInformationMessage(`DevMemory telemetry cleared. Removed ${result.removed} file(s).`);
}

async function recordCommandTelemetry(rootDir: string, commandName: string): Promise<void> {
  const enabled = vscode.workspace.getConfiguration("devmemory").get<boolean>("telemetry.enabled", false);
  await recordEvent("command.invoked", { command: commandName }, { enabled, rootDir }).catch(() => {});
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
