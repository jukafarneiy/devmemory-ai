import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG } from "./defaults";
import { loadConfig, normalizeConfig, resolveMemoryDir, writeConfig } from "./config";
import { scanProject } from "./scanner";
import {
  MANAGED_MARKER,
  aiEndPromptTemplate,
  architectureTemplate,
  bootstrapPromptTemplate,
  commandsTemplate,
  createManifest,
  currentStateTemplate,
  healthCheckTemplate,
  isManagedOrLegacyPlaceholder,
  nextActionsTemplate,
  projectSummaryTemplate,
  resumePromptTemplate,
  scanReportTemplate,
  sessionEndPromptTemplate,
  sessionSummaryTemplate
} from "./templates";
import type {
  HealthCheckEntry,
  InitializeMemoryResult,
  MemoryConfig,
  MemoryHealthCheckResult,
  ResumePromptResult,
  SessionSummaryInput,
  SessionSummaryResult
} from "./types";

export async function initializeMemory(
  rootDir: string,
  overrides: Partial<MemoryConfig> = {}
): Promise<InitializeMemoryResult> {
  const config = normalizeConfig({
    ...(await loadConfig(rootDir)),
    ...overrides
  });
  const memoryDir = resolveMemoryDir(rootDir, config);
  const filesWritten: string[] = [];

  await ensureMemoryDirectories(memoryDir);
  filesWritten.push(await writeConfig(rootDir, config));

  const scan = await scanProject(rootDir, config);
  const manifest = createManifest(scan);
  const manifestPath = path.join(memoryDir, "manifest.json");
  await writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, filesWritten);

  const scanReportPath = path.join(memoryDir, "scan-report.md");
  await writeText(scanReportPath, scanReportTemplate(scan), filesWritten);

  await writeManagedMarkdown(path.join(memoryDir, "project-summary.md"), projectSummaryTemplate(scan), filesWritten);
  await writeManagedMarkdown(path.join(memoryDir, "current-state.md"), currentStateTemplate(), filesWritten);
  await writeManagedMarkdown(path.join(memoryDir, "architecture.md"), architectureTemplate(), filesWritten);
  await writeManagedMarkdown(path.join(memoryDir, "commands.md"), commandsTemplate(scan), filesWritten);
  await writeManagedMarkdown(path.join(memoryDir, "tasks", "next-actions.md"), nextActionsTemplate(), filesWritten);
  await writeManagedMarkdown(path.join(memoryDir, "prompts", "ai-end-prompt.md"), aiEndPromptTemplate(), filesWritten);

  const resumePrompt = await generateResumePrompt(rootDir, config);
  filesWritten.push(resumePrompt.promptPath);

  return {
    memoryDir,
    manifestPath,
    filesWritten: Array.from(new Set(filesWritten)),
    scan
  };
}

export async function generateResumePrompt(
  rootDir: string,
  config?: MemoryConfig
): Promise<ResumePromptResult> {
  const resolvedConfig = config ?? (await loadConfig(rootDir));
  const memoryDir = resolveMemoryDir(rootDir, resolvedConfig);
  await ensureMemoryDirectories(memoryDir);

  const sections = await Promise.all([
    readMemorySection(memoryDir, "Project Summary", "project-summary.md"),
    readMemorySection(memoryDir, "Current State", "current-state.md"),
    readMemorySection(memoryDir, "Architecture", "architecture.md"),
    readMemorySection(memoryDir, "Commands", "commands.md"),
    readMemorySection(memoryDir, "Next Actions", path.join("tasks", "next-actions.md"))
  ]);

  const prompt = resumePromptTemplate(sections);
  const promptPath = path.join(memoryDir, "prompts", "resume-prompt.md");
  await fs.writeFile(promptPath, prompt, "utf8");

  return { prompt, promptPath };
}

export async function addSessionSummary(
  rootDir: string,
  input: SessionSummaryInput
): Promise<SessionSummaryResult> {
  if (!input.summary.trim()) {
    throw new Error("Session summary cannot be empty.");
  }

  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  await ensureMemoryDirectories(memoryDir);

  const fileName = `${formatTimestampForFile(new Date())}-${slugify(input.title || "session")}.md`;
  const sessionPath = path.join(memoryDir, "sessions", fileName);
  await fs.writeFile(sessionPath, sessionSummaryTemplate(input), "utf8");

  return { sessionPath };
}

export async function rescanMemory(rootDir: string): Promise<InitializeMemoryResult> {
  return initializeMemory(rootDir, await loadConfig(rootDir));
}

const HEALTH_PLACEHOLDER_MARKERS = [
  "Replace these placeholders",
  "Document the main modules",
  "Summarize what this project is"
];

interface ManagedFileTarget {
  id: string;
  label: string;
  relativePath: string;
  scanForPlaceholders: boolean;
}

const HEALTH_FILE_TARGETS: ManagedFileTarget[] = [
  { id: "scan-report", label: "scan-report.md", relativePath: "scan-report.md", scanForPlaceholders: false },
  { id: "project-summary", label: "project-summary.md", relativePath: "project-summary.md", scanForPlaceholders: true },
  { id: "current-state", label: "current-state.md", relativePath: "current-state.md", scanForPlaceholders: true },
  { id: "architecture", label: "architecture.md", relativePath: "architecture.md", scanForPlaceholders: true },
  { id: "next-actions", label: "tasks/next-actions.md", relativePath: path.join("tasks", "next-actions.md"), scanForPlaceholders: true },
  { id: "resume-prompt", label: "prompts/resume-prompt.md", relativePath: path.join("prompts", "resume-prompt.md"), scanForPlaceholders: false }
];

export async function runMemoryHealthCheck(
  rootDir: string
): Promise<{ result: MemoryHealthCheckResult; reportPath: string }> {
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);

  const checks: HealthCheckEntry[] = [];
  const warnings: string[] = [];

  const memoryDirExists = await pathExists(memoryDir);
  checks.push({
    id: "memory-dir",
    label: ".ai-memory directory",
    status: memoryDirExists ? "pass" : "warn",
    detail: memoryDirExists ? `Found at ${memoryDir}.` : "Not found. Click \"Set Up Memory\" in the DevMemory AI sidebar."
  });
  if (!memoryDirExists) {
    warnings.push(".ai-memory directory is missing.");
  }

  const manifestPath = path.join(memoryDir, "manifest.json");
  const manifestState = await readManifestSafely(manifestPath);
  if (manifestState.kind === "ok") {
    const fileCount = manifestState.fileCount;
    const hasGeneratedAt = Boolean(manifestState.generatedAt);
    const ok = hasGeneratedAt && fileCount > 0;
    checks.push({
      id: "manifest",
      label: "manifest.json",
      status: ok ? "pass" : "warn",
      detail: ok
        ? `${fileCount} files tracked (last scan ${manifestState.generatedAt}).`
        : `manifest.json is present but ${fileCount === 0 ? "tracks 0 files" : "missing generatedAt"}.`
    });
    if (fileCount === 0) {
      warnings.push("manifest.json tracks 0 files.");
    }
    if (!hasGeneratedAt) {
      warnings.push("manifest.json is missing generatedAt.");
    }
  } else {
    const detail =
      manifestState.kind === "missing" ? "manifest.json is missing." : "manifest.json is not valid JSON.";
    checks.push({ id: "manifest", label: "manifest.json", status: "warn", detail });
    warnings.push(detail);
  }

  const placeholderHits: string[] = [];
  for (const target of HEALTH_FILE_TARGETS) {
    const absolute = path.join(memoryDir, target.relativePath);
    const exists = await pathExists(absolute);
    checks.push({
      id: target.id,
      label: target.label,
      status: exists ? "pass" : "warn",
      detail: exists ? "Present." : "Missing."
    });
    if (!exists) {
      warnings.push(`${target.label} is missing.`);
      continue;
    }
    if (!target.scanForPlaceholders) {
      continue;
    }
    try {
      const content = await fs.readFile(absolute, "utf8");
      for (const marker of HEALTH_PLACEHOLDER_MARKERS) {
        if (content.includes(marker)) {
          placeholderHits.push(`${target.label} contains placeholder text "${marker}".`);
        }
      }
    } catch {
      // ignore — existence already failed if unreadable
    }
  }

  checks.push({
    id: "placeholders",
    label: "Managed files free of placeholders",
    status: placeholderHits.length === 0 ? "pass" : "warn",
    detail:
      placeholderHits.length === 0
        ? "No placeholder phrases detected."
        : `${placeholderHits.length} placeholder occurrence(s) found in managed files.`
  });
  warnings.push(...placeholderHits);

  const flaggedSessions = await collectFlaggedSessions(path.join(memoryDir, "sessions"));
  checks.push({
    id: "session-warnings",
    label: "Sessions without DevMemory Warnings",
    status: flaggedSessions.length === 0 ? "pass" : "warn",
    detail:
      flaggedSessions.length === 0
        ? "No session logs flagged with DevMemory Warnings."
        : `${flaggedSessions.length} session(s) include a DevMemory Warnings section.`
  });
  if (flaggedSessions.length > 0) {
    warnings.push(`Sessions applied with warnings: ${flaggedSessions.join(", ")}.`);
  }

  const status: MemoryHealthCheckResult["status"] = checks.some((entry) => entry.status === "warn")
    ? "needs-review"
    : "healthy";

  const result: MemoryHealthCheckResult = {
    generatedAt: new Date().toISOString(),
    status,
    warnings,
    checks
  };

  await fs.mkdir(memoryDir, { recursive: true });
  const reportPath = path.join(memoryDir, "health-check.md");
  await fs.writeFile(reportPath, healthCheckTemplate(result), "utf8");

  return { result, reportPath };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

type ManifestReadState =
  | { kind: "ok"; generatedAt: string | null; fileCount: number }
  | { kind: "missing" }
  | { kind: "invalid" };

async function readManifestSafely(manifestPath: string): Promise<ManifestReadState> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, "utf8");
  } catch {
    return { kind: "missing" };
  }

  try {
    const parsed = JSON.parse(raw) as { generatedAt?: unknown; files?: unknown };
    const generatedAt = typeof parsed.generatedAt === "string" ? parsed.generatedAt : null;
    const fileCount = Array.isArray(parsed.files) ? (parsed.files as unknown[]).length : 0;
    return { kind: "ok", generatedAt, fileCount };
  } catch {
    return { kind: "invalid" };
  }
}

async function collectFlaggedSessions(sessionsDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(sessionsDir);
  } catch {
    return [];
  }

  const flagged: string[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) {
      continue;
    }
    try {
      const content = await fs.readFile(path.join(sessionsDir, entry), "utf8");
      if (content.includes("## DevMemory Warnings")) {
        flagged.push(entry);
      }
    } catch {
      // ignore unreadable session files
    }
  }
  return flagged;
}

export async function quarantineFlaggedSessions(rootDir: string): Promise<{
  movedFiles: string[];
  quarantineLogPath: string;
  healthCheckPath: string;
}> {
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  const sessionsDir = path.join(memoryDir, "sessions");
  const quarantineDir = path.join(memoryDir, "quarantine", "sessions");
  const quarantineLogPath = path.join(memoryDir, "quarantine", "quarantine-log.md");

  const flagged = await collectFlaggedSessions(sessionsDir);
  const movedFiles: string[] = [];

  if (flagged.length > 0) {
    await fs.mkdir(quarantineDir, { recursive: true });

    for (const fileName of flagged) {
      const src = path.join(sessionsDir, fileName);
      const dest = await uniqueDestinationPath(quarantineDir, fileName);
      await fs.rename(src, dest);
      movedFiles.push(dest);
    }

    await appendQuarantineLog(quarantineLogPath, movedFiles);
  }

  const { reportPath } = await runMemoryHealthCheck(rootDir);

  return { movedFiles, quarantineLogPath, healthCheckPath: reportPath };
}

async function uniqueDestinationPath(dir: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = path.join(dir, fileName);
  let counter = 1;
  while (await pathExists(candidate)) {
    candidate = path.join(dir, `${base}-${counter}${ext}`);
    counter += 1;
  }
  return candidate;
}

async function appendQuarantineLog(logPath: string, movedAbsolutePaths: string[]): Promise<void> {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  if (!(await pathExists(logPath))) {
    await fs.writeFile(logPath, `${MANAGED_MARKER}\n\n# Quarantine Log\n\n`, "utf8");
  }

  const memoryDir = path.dirname(path.dirname(logPath));
  const block = [
    `## ${new Date().toISOString()}`,
    "",
    "Reason: session log contained `## DevMemory Warnings`.",
    "",
    "Moved files:",
    ...movedAbsolutePaths.map((absPath) => `- ${path.relative(memoryDir, absPath)}`),
    "",
    "---",
    "",
    ""
  ].join("\n");

  await fs.appendFile(logPath, block, "utf8");
}

interface BootstrapTarget {
  sectionKey: string;
  fileTitle: string;
  filePath: (memoryDir: string) => string;
}

const BOOTSTRAP_TARGETS: BootstrapTarget[] = [
  {
    sectionKey: "PROJECT_SUMMARY",
    fileTitle: "Project Summary",
    filePath: (memoryDir) => path.join(memoryDir, "project-summary.md")
  },
  {
    sectionKey: "ARCHITECTURE",
    fileTitle: "Architecture",
    filePath: (memoryDir) => path.join(memoryDir, "architecture.md")
  },
  {
    sectionKey: "CURRENT_STATE",
    fileTitle: "Current State",
    filePath: (memoryDir) => path.join(memoryDir, "current-state.md")
  },
  {
    sectionKey: "NEXT_ACTIONS",
    fileTitle: "Next Actions",
    filePath: (memoryDir) => path.join(memoryDir, "tasks", "next-actions.md")
  }
];

export async function generateBootstrapPrompt(rootDir: string): Promise<ResumePromptResult> {
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  await ensureMemoryDirectories(memoryDir);

  const scan = await scanProject(rootDir, config);
  const prompt = bootstrapPromptTemplate(scan);

  const promptPath = path.join(memoryDir, "prompts", "bootstrap-memory-prompt.md");
  await fs.writeFile(promptPath, prompt, "utf8");

  return { prompt, promptPath };
}

export async function applyBootstrapMemory(
  rootDir: string,
  markdown: string
): Promise<{ filesWritten: string[] }> {
  const sections = parseBootstrapSections(markdown);

  const missing = BOOTSTRAP_TARGETS.filter((target) => !sections.has(target.sectionKey)).map(
    (target) => target.sectionKey
  );

  if (missing.length > 0) {
    throw new Error(
      `Bootstrap memory is missing required sections: ${missing.join(", ")}. Each section header must appear exactly as "## ${missing[0]}".`
    );
  }

  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  await ensureMemoryDirectories(memoryDir);

  const filesWritten: string[] = [];
  for (const target of BOOTSTRAP_TARGETS) {
    const body = sections.get(target.sectionKey) ?? "";
    const content = renderBootstrapFile(target.fileTitle, body);
    await writeText(target.filePath(memoryDir), content, filesWritten);
  }

  return { filesWritten };
}

const BOOTSTRAP_HEADING_ALIASES: Record<string, string> = {
  project_summary: "PROJECT_SUMMARY",
  "project summary": "PROJECT_SUMMARY",
  architecture: "ARCHITECTURE",
  current_state: "CURRENT_STATE",
  "current state": "CURRENT_STATE",
  next_actions: "NEXT_ACTIONS",
  "next actions": "NEXT_ACTIONS"
};

const SESSION_HEADING_ALIASES: Record<string, string> = {
  session_summary: "SESSION_SUMMARY",
  "session summary": "SESSION_SUMMARY",
  changes_made: "CHANGES_MADE",
  "changes made": "CHANGES_MADE",
  files_touched: "FILES_TOUCHED",
  "files touched": "FILES_TOUCHED",
  decisions: "DECISIONS",
  bugs_fixed: "BUGS_FIXED",
  "bugs fixed": "BUGS_FIXED",
  commands_run: "COMMANDS_RUN",
  "commands run": "COMMANDS_RUN",
  current_state: "CURRENT_STATE",
  "current state": "CURRENT_STATE",
  next_actions: "NEXT_ACTIONS",
  "next actions": "NEXT_ACTIONS"
};

function parseSectionsByAlias(
  markdown: string,
  aliases: Record<string, string>,
  options: { allowBareHeadings?: boolean } = {}
): Map<string, string> {
  const sections = new Map<string, string>();
  const headingPattern = /^##\s+(.+?)\s*$/;

  const lines = markdown.split(/\r?\n/);
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (currentKey) {
      sections.set(currentKey, buffer.join("\n").trim());
    }
  };

  for (const line of lines) {
    let detected: string | null = null;

    const match = line.match(headingPattern);
    if (match) {
      detected = aliases[match[1].trim().toLowerCase()] ?? null;
    }

    if (!detected && options.allowBareHeadings) {
      const normalized = line.trim().toLowerCase();
      if (normalized.length > 0) {
        detected = aliases[normalized] ?? null;
      }
    }

    if (detected) {
      flush();
      currentKey = detected;
      buffer = [];
      continue;
    }

    if (currentKey) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function parseBootstrapSections(markdown: string): Map<string, string> {
  return parseSectionsByAlias(markdown, BOOTSTRAP_HEADING_ALIASES);
}

function renderBootstrapFile(title: string, body: string): string {
  const trimmed = body.trim();
  const bodyText = trimmed.length > 0 ? trimmed : "Unknown.";
  return `${MANAGED_MARKER}\n\n# ${title}\n\n${bodyText}\n`;
}

interface SessionSectionMeta {
  key: string;
  fileTitle: string;
}

const SESSION_SECTION_ORDER: SessionSectionMeta[] = [
  { key: "SESSION_SUMMARY", fileTitle: "Session Summary" },
  { key: "CHANGES_MADE", fileTitle: "Changes Made" },
  { key: "FILES_TOUCHED", fileTitle: "Files Touched" },
  { key: "DECISIONS", fileTitle: "Decisions" },
  { key: "BUGS_FIXED", fileTitle: "Bugs Fixed" },
  { key: "COMMANDS_RUN", fileTitle: "Commands Run" },
  { key: "CURRENT_STATE", fileTitle: "Current State" },
  { key: "NEXT_ACTIONS", fileTitle: "Next Actions" }
];

const REQUIRED_SESSION_SECTIONS = ["SESSION_SUMMARY", "CURRENT_STATE", "NEXT_ACTIONS"] as const;

export async function generateSessionEndPrompt(rootDir: string): Promise<ResumePromptResult> {
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  await ensureMemoryDirectories(memoryDir);

  const prompt = sessionEndPromptTemplate();
  const promptPath = path.join(memoryDir, "prompts", "session-end-prompt.md");
  await fs.writeFile(promptPath, prompt, "utf8");

  return { prompt, promptPath };
}

export interface SessionUpdatePreviewSection {
  key: string;
  title: string;
  body: string;
}

export interface SessionUpdatePreview {
  sections: SessionUpdatePreviewSection[];
  missingRequired: string[];
  warnings: string[];
}

const SIMULATION_PATTERN = /\b(?:simula[çc][aã]o|simulation|fake|fict[ií]cio|fictitious)\b/i;

const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\brm\s+-rf\b/i, label: "rm -rf" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, label: "git reset --hard" },
  { pattern: /\bdrop\s+database\b/i, label: "drop database" }
];

const NONE_LINE_PATTERN = /^none\.?$/i;

const GENERIC_CURRENT_STATE_PHRASES: RegExp[] = [
  /^no project changes were made(?: in this session)?\.?$/i,
  /^no work is currently in progress(?: from this session)?\.?$/i,
  /^known issues:\s*none\.?$/i,
  /^no known issues were identified(?: in this session)?\.?$/i
];

function stripBulletPrefix(line: string): string {
  return line.replace(/^[\s\-*+•#>]+/, "").trim();
}

function isSectionEffectivelyEmpty(body: string | undefined): boolean {
  if (!body) {
    return true;
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return true;
  }
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const stripped = stripBulletPrefix(rawLine);
    if (stripped.length === 0) {
      continue;
    }
    if (NONE_LINE_PATTERN.test(stripped)) {
      continue;
    }
    return false;
  }
  return true;
}

function isCurrentStateEffectivelyEmpty(body: string | undefined): boolean {
  if (isSectionEffectivelyEmpty(body)) {
    return true;
  }
  for (const rawLine of body!.split(/\r?\n/)) {
    const stripped = stripBulletPrefix(rawLine);
    if (stripped.length === 0) {
      continue;
    }
    if (NONE_LINE_PATTERN.test(stripped)) {
      continue;
    }
    if (GENERIC_CURRENT_STATE_PHRASES.some((pattern) => pattern.test(stripped))) {
      continue;
    }
    return false;
  }
  return true;
}

export async function parseSessionUpdatePreview(
  markdown: string,
  rootDir?: string
): Promise<SessionUpdatePreview> {
  const parsed = parseSectionsByAlias(markdown, SESSION_HEADING_ALIASES, {
    allowBareHeadings: true
  });

  const sections: SessionUpdatePreviewSection[] = [];
  for (const meta of SESSION_SECTION_ORDER) {
    const body = parsed.get(meta.key)?.trim();
    if (body && body.length > 0) {
      sections.push({ key: meta.key, title: meta.fileTitle, body });
    }
  }

  const missingRequired = REQUIRED_SESSION_SECTIONS.filter(
    (key) => !hasContent(parsed.get(key))
  ).map((key) => key as string);

  const warnings: string[] = [];

  for (const section of sections) {
    const match = SIMULATION_PATTERN.exec(section.body);
    if (match) {
      warnings.push(
        `${section.title} appears to contain simulated/fictitious content (matched "${match[0]}").`
      );
      break;
    }
  }

  const commandsBody = parsed.get("COMMANDS_RUN") ?? "";
  for (const danger of DANGEROUS_COMMAND_PATTERNS) {
    if (danger.pattern.test(commandsBody)) {
      warnings.push(`Commands Run lists a destructive command: ${danger.label}.`);
    }
  }

  if (rootDir) {
    const filesBody = parsed.get("FILES_TOUCHED") ?? "";
    const cited = extractFilePathsFromBullets(filesBody);
    const missingFiles: string[] = [];
    for (const cite of cited) {
      const absolute = path.isAbsolute(cite) ? cite : path.resolve(rootDir, cite);
      try {
        await fs.access(absolute);
      } catch {
        missingFiles.push(cite);
      }
    }
    if (missingFiles.length > 0) {
      const sample = missingFiles.slice(0, 3).join(", ");
      const more = missingFiles.length > 3 ? ` (+${missingFiles.length - 3} more)` : "";
      warnings.push(`Files Touched lists paths that do not exist in the workspace: ${sample}${more}.`);
    }
  }

  const allOptionalEmpty =
    isSectionEffectivelyEmpty(parsed.get("SESSION_SUMMARY")) &&
    isSectionEffectivelyEmpty(parsed.get("CHANGES_MADE")) &&
    isSectionEffectivelyEmpty(parsed.get("FILES_TOUCHED")) &&
    isSectionEffectivelyEmpty(parsed.get("DECISIONS")) &&
    isSectionEffectivelyEmpty(parsed.get("BUGS_FIXED")) &&
    isSectionEffectivelyEmpty(parsed.get("COMMANDS_RUN")) &&
    isSectionEffectivelyEmpty(parsed.get("NEXT_ACTIONS")) &&
    isCurrentStateEffectivelyEmpty(parsed.get("CURRENT_STATE"));

  if (allOptionalEmpty) {
    warnings.push("Session summary appears empty or non-informative.");
  }

  return { sections, missingRequired, warnings };
}

function extractFilePathsFromBullets(body: string): string[] {
  const paths: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*[-*+]\s+`?([^\s`]+)/);
    if (match) {
      paths.push(match[1]);
    }
  }
  return paths;
}

export interface ApplySessionUpdateOptions {
  warnings?: string[];
}

export async function applySessionUpdate(
  rootDir: string,
  markdown: string,
  options: ApplySessionUpdateOptions = {}
): Promise<{ filesWritten: string[] }> {
  const sections = parseSectionsByAlias(markdown, SESSION_HEADING_ALIASES, {
    allowBareHeadings: true
  });

  const missing = REQUIRED_SESSION_SECTIONS.filter((key) => !hasContent(sections.get(key)));
  if (missing.length > 0) {
    throw new Error(
      `Session update is missing required sections: ${missing.join(", ")}. Each section header must appear exactly as "## ${missing[0]}" (or its title-case variant).`
    );
  }

  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  await ensureMemoryDirectories(memoryDir);

  const filesWritten: string[] = [];
  const now = new Date();

  const warnings = (options.warnings ?? []).filter((w) => w.trim().length > 0);
  const sessionFileName = `${formatTimestampForFile(now)}-session.md`;
  const sessionPath = path.join(memoryDir, "sessions", sessionFileName);
  await writeText(sessionPath, renderSessionFile(now, sections, warnings), filesWritten);

  await writeText(
    path.join(memoryDir, "current-state.md"),
    renderBootstrapFile("Current State", sections.get("CURRENT_STATE") ?? ""),
    filesWritten
  );

  await writeText(
    path.join(memoryDir, "tasks", "next-actions.md"),
    renderBootstrapFile("Next Actions", sections.get("NEXT_ACTIONS") ?? ""),
    filesWritten
  );

  const decisions = sections.get("DECISIONS");
  if (hasMeaningfulContent(decisions)) {
    const decisionsPath = path.join(memoryDir, "decisions", "decisions.md");
    await appendManagedLog(decisionsPath, "Decisions", now, decisions ?? "");
    filesWritten.push(decisionsPath);
  }

  const bugs = sections.get("BUGS_FIXED");
  if (hasMeaningfulContent(bugs)) {
    const bugsPath = path.join(memoryDir, "issues", "bugs-and-fixes.md");
    await appendManagedLog(bugsPath, "Bugs and Fixes", now, bugs ?? "");
    filesWritten.push(bugsPath);
  }

  return { filesWritten };
}

function hasContent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMeaningfulContent(value: string | undefined): boolean {
  if (!hasContent(value)) {
    return false;
  }
  return value!.trim().toLowerCase() !== "none";
}

function renderSessionFile(
  date: Date,
  sections: Map<string, string>,
  warnings: string[] = []
): string {
  const lines: string[] = [MANAGED_MARKER, "", `# Session ${date.toISOString()}`, ""];

  if (warnings.length > 0) {
    lines.push("## DevMemory Warnings", "");
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  for (const meta of SESSION_SECTION_ORDER) {
    const body = sections.get(meta.key)?.trim();
    if (!body) {
      continue;
    }
    lines.push(`## ${meta.fileTitle}`, "", body, "");
  }
  return `${lines.join("\n")}\n`;
}

async function appendManagedLog(
  filePath: string,
  title: string,
  date: Date,
  body: string
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  let exists = true;
  try {
    await fs.access(filePath);
  } catch {
    exists = false;
  }

  if (!exists) {
    await fs.writeFile(filePath, `${MANAGED_MARKER}\n\n# ${title}\n\n`, "utf8");
  }

  const block = `## ${date.toISOString()}\n\n${body.trim()}\n\n---\n\n`;
  await fs.appendFile(filePath, block, "utf8");
}

async function ensureMemoryDirectories(memoryDir: string): Promise<void> {
  await Promise.all([
    fs.mkdir(memoryDir, { recursive: true }),
    fs.mkdir(path.join(memoryDir, "decisions"), { recursive: true }),
    fs.mkdir(path.join(memoryDir, "sessions"), { recursive: true }),
    fs.mkdir(path.join(memoryDir, "tasks"), { recursive: true }),
    fs.mkdir(path.join(memoryDir, "issues"), { recursive: true }),
    fs.mkdir(path.join(memoryDir, "prompts"), { recursive: true }),
    fs.mkdir(path.join(memoryDir, "snapshots"), { recursive: true }),
    fs.mkdir(path.join(memoryDir, "audit"), { recursive: true })
  ]);
}

async function writeManagedMarkdown(
  filePath: string,
  content: string,
  filesWritten: string[]
): Promise<void> {
  let existing: string | null = null;

  try {
    existing = await fs.readFile(filePath, "utf8");
  } catch {
    existing = null;
  }

  if (existing === null || isManagedOrLegacyPlaceholder(existing)) {
    await writeText(filePath, content, filesWritten);
  }
}

async function writeText(filePath: string, content: string, filesWritten: string[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  filesWritten.push(filePath);
}

async function readMemorySection(
  memoryDir: string,
  title: string,
  relativePath: string
): Promise<{ title: string; content: string }> {
  try {
    return {
      title,
      content: await fs.readFile(path.join(memoryDir, relativePath), "utf8")
    };
  } catch {
    return { title, content: "" };
  }
}

function formatTimestampForFile(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "session";
}

export { DEFAULT_CONFIG };
