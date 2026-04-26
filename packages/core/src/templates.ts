import path from "node:path";
import type {
  DetectedTechnology,
  Manifest,
  MemoryHealthCheckResult,
  ScanResult,
  SessionSummaryInput,
  SkippedReason,
  SkippedReasonCounts
} from "./types";

export const MANAGED_MARKER = "<!-- devmemory:managed -->";

export const LEGACY_PLACEHOLDER_MARKERS: readonly string[] = [
  "Describe the product goal here",
  "Package manifest detected",
  "Record commands that future AI sessions should know."
];

const SCAN_REPORT_FILE_LIMIT = 100;

export function createManifest(scan: ScanResult): Manifest {
  return {
    version: 1,
    generatedAt: scan.scannedAt,
    files: scan.files,
    skippedCount: scan.skipped.length,
    detectedProfiles: scan.detectedProfiles
  };
}

export function scanReportTemplate(scan: ScanResult): string {
  const technologyLine =
    scan.detectedProfiles.length > 0
      ? scan.detectedProfiles.map((profile) => profile.label).join(", ")
      : "none recognized";

  const counts = countSkippedByReason(scan.skipped);

  const trackedList = scan.files
    .slice(0, SCAN_REPORT_FILE_LIMIT)
    .map((file) => `- ${file.path} (${file.bytes} bytes)`)
    .join("\n");

  const skippedList = scan.skipped
    .slice(0, SCAN_REPORT_FILE_LIMIT)
    .map((entry) => {
      const detail = entry.detail ? ` — ${entry.detail}` : "";
      return `- ${entry.path} [${entry.reason}]${detail}`;
    })
    .join("\n");

  return [
    "# Scan Report",
    "",
    "> No file content is included in this report. It only lists local paths and scan decisions.",
    "",
    "## Overview",
    "",
    `- Scanned at: ${scan.scannedAt}`,
    `- Root: ${scan.rootDir}`,
    `- Detected technologies: ${technologyLine}`,
    `- Tracked files: ${scan.files.length}`,
    `- Skipped files: ${scan.skipped.length}`,
    "",
    "## Skipped By Reason",
    "",
    `- excluded: ${counts.excluded}`,
    `- not-included: ${counts["not-included"]}`,
    `- too-large: ${counts["too-large"]}`,
    `- read-error: ${counts["read-error"]}`,
    "",
    `## Tracked Files (first ${SCAN_REPORT_FILE_LIMIT})`,
    "",
    trackedList || "- No files tracked.",
    "",
    `## Skipped Files (first ${SCAN_REPORT_FILE_LIMIT})`,
    "",
    skippedList || "- No files skipped.",
    ""
  ].join("\n");
}

function countSkippedByReason(skipped: ScanResult["skipped"]): SkippedReasonCounts {
  const counts: SkippedReasonCounts = {
    excluded: 0,
    "not-included": 0,
    "too-large": 0,
    "read-error": 0
  };

  for (const entry of skipped) {
    const reason = entry.reason as SkippedReason;
    counts[reason] += 1;
  }

  return counts;
}

export function projectSummaryTemplate(scan: ScanResult): string {
  const importantFiles = scan.files.slice(0, 30).map((file) => `- ${file.path}`).join("\n");
  const detectedLabels = scan.detectedProfiles.map((profile) => profile.label);
  const detectedLine =
    detectedLabels.length > 0
      ? `Detected technologies: ${detectedLabels.join(", ")}.`
      : "Detected technologies: none recognized — falling back to global include rules.";

  return managed([
    "# Project Summary",
    "",
    "## Purpose",
    "",
    "Summarize what this project is and who it serves. Replace this paragraph with one or two factual sentences.",
    "",
    "## Detected Project Signals",
    "",
    `- Root: ${path.basename(scan.rootDir)}`,
    `- Tracked files: ${scan.files.length}`,
    `- Skipped files: ${scan.skipped.length}`,
    `- ${detectedLine}`,
    "",
    "## Important Files",
    "",
    importantFiles || "- No files matched the current include rules.",
    "",
    "## Notes For AI Sessions",
    "",
    "- Prefer reading this memory before re-scanning the whole project.",
    "- Ask before accessing files that are not covered by the allowlist.",
    "- Do not include secrets or credentials in project memory.",
    ""
  ]);
}

export function currentStateTemplate(): string {
  return managed([
    "# Current State",
    "",
    "## Working",
    "",
    "- Initial DevMemory AI project memory has been created.",
    "",
    "## In Progress",
    "",
    "- Replace these placeholders with the current implementation status.",
    "",
    "## Known Issues",
    "",
    "- None recorded yet.",
    "",
    "## Next Actions",
    "",
    "- Generate a resume prompt before the next AI coding session.",
    ""
  ]);
}

export function architectureTemplate(): string {
  return managed([
    "# Architecture",
    "",
    "## Overview",
    "",
    "Document the main modules, boundaries, and data flow here.",
    "",
    "## Conventions",
    "",
    "- Keep this file concise.",
    "- Record durable architecture facts, not session chatter.",
    "",
    "## Open Questions",
    "",
    "- None recorded yet.",
    ""
  ]);
}

interface CommandBlock {
  label: string;
  commands: string[];
}

const COMMAND_BLOCKS_BY_PROFILE: Record<string, CommandBlock> = {
  node: {
    label: "Node.js",
    commands: ["npm install", "npm run build", "npm test"]
  },
  python: {
    label: "Python",
    commands: ["python -m venv .venv", "pip install -r requirements.txt", "pytest"]
  },
  php: {
    label: "PHP",
    commands: ["composer install", "php artisan test"]
  },
  ruby: {
    label: "Ruby",
    commands: ["bundle install", "bundle exec rspec"]
  },
  java: {
    label: "Java / Kotlin",
    commands: ["./mvnw test", "./gradlew test"]
  },
  dotnet: {
    label: ".NET",
    commands: ["dotnet restore", "dotnet test"]
  },
  go: {
    label: "Go",
    commands: ["go test ./..."]
  },
  rust: {
    label: "Rust",
    commands: ["cargo test"]
  },
  flutter: {
    label: "Dart / Flutter",
    commands: ["flutter pub get", "flutter test"]
  }
};

export function commandsTemplate(scan: ScanResult): string {
  const blocks: string[] = [];
  for (const profile of scan.detectedProfiles) {
    const block = COMMAND_BLOCKS_BY_PROFILE[profile.id];
    if (!block) {
      continue;
    }
    blocks.push(`### ${block.label}`, "", "```bash", ...block.commands, "```", "");
  }

  if (blocks.length === 0) {
    blocks.push(
      "### Generic",
      "",
      "Replace these placeholders with the actual install, build, test and run commands for this stack.",
      "",
      "```bash",
      "# install dependencies",
      "# run tests",
      "# build the project",
      "```",
      ""
    );
  }

  return managed([
    "# Commands",
    "",
    "Common commands per detected stack. Add or refine entries as you learn the project.",
    "",
    ...blocks
  ]);
}

export function nextActionsTemplate(): string {
  return managed([
    "# Next Actions",
    "",
    "- Review generated memory placeholders.",
    "- Add the first real session summary.",
    "- Keep this list small and actionable.",
    ""
  ]);
}

export function aiEndPromptTemplate(): string {
  return managed([
    "# AI End Prompt",
    "",
    "Use this at the end of an AI coding session:",
    "",
    "```text",
    "Summarize this session for DevMemory AI.",
    "Return only durable project memory, not conversation filler.",
    "Include: changes made, files touched, decisions, bugs fixed, commands run, tests, risks, and next actions.",
    "Redact secrets, credentials, tokens, personal data, and environment-specific values.",
    "```",
    ""
  ]);
}

const BOOTSTRAP_FILE_LIMIT = 200;

export function bootstrapPromptTemplate(scan: ScanResult): string {
  const detectedLine =
    scan.detectedProfiles.length > 0
      ? scan.detectedProfiles.map((profile) => profile.label).join(", ")
      : "none recognized";

  const trackedSlice = scan.files.slice(0, BOOTSTRAP_FILE_LIMIT);
  const trackedList =
    trackedSlice.map((file) => `- ${file.path}`).join("\n") || "- (no tracked files yet)";
  const truncationNote =
    scan.files.length > BOOTSTRAP_FILE_LIMIT
      ? `\n\n_${scan.files.length - BOOTSTRAP_FILE_LIMIT} additional tracked files omitted from this list._`
      : "";

  return [
    "# Bootstrap Memory Prompt",
    "",
    "Copy the block below into your AI assistant. The assistant must reply using exactly the four Markdown sections requested at the end.",
    "",
    "```text",
    "You are helping populate the DevMemory AI memory store for an existing software project.",
    "",
    `Detected technologies: ${detectedLine}.`,
    "",
    "Tracked files (these are the only files DevMemory AI has approved for analysis):",
    trackedList + truncationNote,
    "",
    "Rules:",
    "- Do not include any secrets, credentials, tokens, environment variables, certificates, private keys, or local database paths.",
    "- Do not invent facts. If something is unclear or unverified, write \"Unknown\".",
    "- Base your analysis only on the tracked files above and on file contents the user explicitly shares with you.",
    "- If you do not have access to the file contents yet, ask the user to paste the relevant files. Do not guess.",
    "- Keep each section compact, factual, and actionable.",
    "",
    "Reply using EXACTLY these four Markdown sections, in this order, with these exact headings (no extras, no surrounding prose):",
    "",
    "## PROJECT_SUMMARY",
    "One short paragraph describing what this project is, who it serves, and the main technology stack.",
    "",
    "## ARCHITECTURE",
    "Bullet list (or short prose) covering main modules, boundaries, and data flow.",
    "",
    "## CURRENT_STATE",
    "Bullets describing what is working, what is in progress, and known issues.",
    "",
    "## NEXT_ACTIONS",
    "Bullet list of concrete near-term actions the next AI session should take.",
    "```",
    "",
    "After the AI replies, copy the full response and click \"Save Project Understanding\" in the DevMemory AI sidebar.",
    ""
  ].join("\n");
}

export function healthCheckTemplate(result: MemoryHealthCheckResult): string {
  const checksLines =
    result.checks
      .map((entry) => `- [${entry.status.toUpperCase()}] ${entry.label} — ${entry.detail}`)
      .join("\n") || "- No checks were run.";

  const warningsLines = result.warnings.length
    ? result.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None.";

  const recommendations = buildHealthRecommendations(result);

  return [
    "# Memory Health Check",
    "",
    `- Generated at: ${result.generatedAt}`,
    `- Status: ${result.status}`,
    "",
    "## Checks",
    "",
    checksLines,
    "",
    "## Warnings",
    "",
    warningsLines,
    "",
    "## Recommendations",
    "",
    recommendations,
    ""
  ].join("\n");
}

function buildHealthRecommendations(result: MemoryHealthCheckResult): string {
  if (result.status === "healthy") {
    return "- Memory looks healthy. Keep applying session updates after each AI session.";
  }

  const warnIds = new Set(result.checks.filter((entry) => entry.status === "warn").map((entry) => entry.id));
  const recs: string[] = [];

  if (warnIds.has("memory-dir") || warnIds.has("manifest")) {
    recs.push("- Click \"Set Up Memory\" in the DevMemory AI sidebar to (re)create .ai-memory and the manifest.");
  }
  if (warnIds.has("placeholders")) {
    recs.push(
      "- Click \"Teach DevMemory About This Project\" in the sidebar, then \"Save Project Understanding\" to replace placeholder content."
    );
  }
  if (warnIds.has("session-warnings")) {
    recs.push(
      "- Review the flagged session logs under .ai-memory/sessions/ to confirm or correct the warnings."
    );
  }
  if (warnIds.has("resume-prompt")) {
    recs.push("- Click \"Start AI Session\" in the sidebar to refresh prompts/resume-prompt.md.");
  }
  if (warnIds.has("scan-report")) {
    recs.push("- Click \"Set Up Memory\" in the sidebar to regenerate scan-report.md.");
  }
  if (recs.length === 0) {
    recs.push("- Review the warnings above and update the affected files.");
  }
  return recs.join("\n");
}

export function sessionEndPromptTemplate(): string {
  return [
    "# Session End Prompt",
    "",
    "Copy the block below into your AI assistant at the end of a coding session. The assistant must reply with exactly the eight Markdown sections requested below.",
    "",
    "```text",
    "Summarize this AI coding session for DevMemory AI.",
    "",
    "Rules:",
    "- Record only durable project memory, not conversation filler.",
    "- Do not include secrets, credentials, tokens, certificates, private keys, environment variables, or local database paths.",
    "- Do not invent facts. If something did not happen in this session, write \"None\".",
    "- Keep each section short and objective.",
    "",
    "Reply using EXACTLY these eight Markdown sections, in this order, with these exact headings:",
    "",
    "## SESSION_SUMMARY",
    "One short paragraph stating what this session accomplished.",
    "",
    "## CHANGES_MADE",
    "Bullet list of concrete code or configuration changes.",
    "",
    "## FILES_TOUCHED",
    "Bullet list of file paths that were created or modified.",
    "",
    "## DECISIONS",
    "Bullet list of durable decisions (write \"None\" if no notable decisions were made).",
    "",
    "## BUGS_FIXED",
    "Bullet list of bugs fixed, each with one-line root cause (write \"None\" if no bugs were fixed).",
    "",
    "## COMMANDS_RUN",
    "Bullet list of relevant commands run during the session (write \"None\" if not applicable).",
    "",
    "## CURRENT_STATE",
    "Bullets describing what is working, what is in progress, and known issues after this session.",
    "",
    "## NEXT_ACTIONS",
    "Bullet list of concrete near-term actions for the next session.",
    "```",
    "",
    "After the AI replies, copy the full response and click \"Save Session Summary\" in the DevMemory AI sidebar.",
    ""
  ].join("\n");
}

export function sessionSummaryTemplate(input: SessionSummaryInput): string {
  return [
    `# ${input.title || "Session Summary"}`,
    "",
    `Date: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    input.summary.trim(),
    "",
    "## Changed Files",
    "",
    listOrEmpty(input.changedFiles),
    "",
    "## Decisions",
    "",
    listOrEmpty(input.decisions),
    "",
    "## Next Actions",
    "",
    listOrEmpty(input.nextActions),
    ""
  ].join("\n");
}

export function resumePromptTemplate(memorySections: Array<{ title: string; content: string }>): string {
  const sections = memorySections
    .map((section) => ({ title: section.title, body: stripManagedHeader(section.content) }))
    .filter((section) => section.body.length > 0)
    .map((section) => `## ${section.title}\n\n${section.body}`)
    .join("\n\n");

  return [
    "# Resume Prompt",
    "",
    "```text",
    "You are continuing work on this software project.",
    "Use the DevMemory AI context below as the source of truth before re-scanning the repository.",
    "Respect privacy rules: do not request or expose secrets, credentials, tokens, certificates, private keys, local databases, or ignored build artifacts.",
    "First, restate the current objective and propose the smallest safe next step.",
    "",
    sections,
    "```",
    ""
  ].join("\n");
}

export function extractTextPrompt(markdown: string): string {
  const match = markdown.match(/```text\r?\n([\s\S]*?)\r?\n```/);
  return match ? match[1].trim() : markdown.trim();
}

function managed(lines: string[]): string {
  return [MANAGED_MARKER, "", ...lines].join("\n");
}

function stripManagedHeader(content: string): string {
  let remaining = content.replace(/^﻿/, "").trimStart();

  if (remaining.startsWith(MANAGED_MARKER)) {
    remaining = remaining.slice(MANAGED_MARKER.length).trimStart();
  }

  if (remaining.startsWith("# ")) {
    const newlineIndex = remaining.indexOf("\n");
    if (newlineIndex === -1) {
      return "";
    }
    remaining = remaining.slice(newlineIndex + 1).trimStart();
  }

  return remaining.trimEnd();
}

function listOrEmpty(items?: string[]): string {
  return items?.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded.";
}

export function isManagedOrLegacyPlaceholder(content: string): boolean {
  if (content.includes(MANAGED_MARKER)) {
    return true;
  }
  return LEGACY_PLACEHOLDER_MARKERS.some((marker) => content.includes(marker));
}

export function detectedTechnologyLabels(profiles: DetectedTechnology[]): string[] {
  return profiles.map((profile) => profile.label);
}
