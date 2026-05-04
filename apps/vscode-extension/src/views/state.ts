import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { loadConfig, resolveMemoryDir } from "@devmemory/core";

export type FlowStateKind =
  | "no-workspace"
  | "needs-attention"
  | "not-set-up"
  | "needs-understanding"
  | "needs-review"
  | "ready";

export type PendingAction = "save-project-understanding" | "save-session-summary";

export interface FlowState {
  kind: FlowStateKind;
  detectedProfiles: Array<{ id: string; label: string }>;
  fileCount: number;
  generatedAt: string | null;
  qualityLabel: string;
  qualityCodicon: string;
  detail?: string;
  pendingAction: PendingAction | null;
  pasteGuardCount: number;
  memoryAgeDays: number | null;
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

const PENDING_ACTION_FILE = "workflow-state.json";

export async function readFlowState(): Promise<FlowState> {
  const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!rootDir) {
    return {
      kind: "no-workspace",
      detectedProfiles: [],
      fileCount: 0,
      generatedAt: null,
      qualityLabel: "Unknown",
      qualityCodicon: "circle-slash",
      detail: "Open a workspace folder to enable DevMemory AI.",
      pendingAction: null,
      pasteGuardCount: 0,
      memoryAgeDays: null
    };
  }

  try {
    const config = await loadConfig(rootDir);
    const memoryDir = resolveMemoryDir(rootDir, config);
    const pendingAction = await readPendingAction(memoryDir);

    const manifestPath = path.join(memoryDir, "manifest.json");
    const manifestRaw = await tryReadFile(manifestPath);
    if (manifestRaw === null) {
      return {
        kind: "not-set-up",
        detectedProfiles: [],
        fileCount: 0,
        generatedAt: null,
        qualityLabel: "Not run yet",
        qualityCodicon: "circle-slash",
        detail: "Run \"Scan This Project\" to scan this workspace.",
        pendingAction,
        pasteGuardCount: await countPasteGuardEvents(memoryDir),
        memoryAgeDays: null
      };
    }

    let manifest: ManifestShape;
    try {
      manifest = JSON.parse(manifestRaw) as ManifestShape;
    } catch {
      return {
        kind: "needs-attention",
        detectedProfiles: [],
        fileCount: 0,
        generatedAt: null,
        qualityLabel: "Invalid manifest",
        qualityCodicon: "warning",
        detail: "manifest.json is not valid JSON. Re-run \"Scan This Project\".",
        pendingAction,
        pasteGuardCount: await countPasteGuardEvents(memoryDir),
        memoryAgeDays: null
      };
    }

    const detectedProfiles = Array.isArray(manifest.detectedProfiles)
      ? (manifest.detectedProfiles as Array<{ id: string; label: string }>)
      : [];
    const fileCount = Array.isArray(manifest.files) ? (manifest.files as unknown[]).length : 0;
    const generatedAt = typeof manifest.generatedAt === "string" ? manifest.generatedAt : null;
    const memoryAgeDays = generatedAt ? daysBetween(new Date(generatedAt), new Date()) : null;
    const pasteGuardCount = await countPasteGuardEvents(memoryDir);

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
        detail = "Paste the AI's response into your clipboard and click Save What The AI Told Me.";
      } else {
        qualityLabel = "Needs project understanding";
        qualityCodicon = "info";
        detail = "Run \"Teach The AI About This Project\" so the AI replaces the placeholder content.";
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
      detail = generatedAt ? `Last scan ${generatedAt}, ${fileCount} files tracked.` : `${fileCount} files tracked.`;
    }

    if (pendingAction === "save-session-summary") {
      qualityLabel = "Awaiting AI response";
      qualityCodicon = "info";
      detail = "Paste the AI's session-end response into your clipboard and click Save What The AI Did.";
    }

    return {
      kind,
      detectedProfiles,
      fileCount,
      generatedAt,
      qualityLabel,
      qualityCodicon,
      detail,
      pendingAction,
      pasteGuardCount,
      memoryAgeDays
    };
  } catch (error) {
    return {
      kind: "needs-attention",
      detectedProfiles: [],
      fileCount: 0,
      generatedAt: null,
      qualityLabel: "Needs attention",
      qualityCodicon: "warning",
      detail: error instanceof Error ? error.message : String(error),
      pendingAction: null,
      pasteGuardCount: 0,
      memoryAgeDays: null
    };
  }
}

export async function setPendingAction(rootDir: string, action: PendingAction | null): Promise<void> {
  try {
    const config = await loadConfig(rootDir);
    const memoryDir = resolveMemoryDir(rootDir, config);
    await fs.mkdir(memoryDir, { recursive: true });
    const filePath = path.join(memoryDir, PENDING_ACTION_FILE);
    const payload = JSON.stringify({ pendingAction: action, updatedAt: new Date().toISOString() }, null, 2);
    await fs.writeFile(filePath, `${payload}\n`, "utf8");
  } catch {
    // Best-effort UX hint
  }
}

async function readPendingAction(memoryDir: string): Promise<PendingAction | null> {
  try {
    const raw = await fs.readFile(path.join(memoryDir, PENDING_ACTION_FILE), "utf8");
    const parsed = JSON.parse(raw) as { pendingAction?: unknown };
    if (parsed.pendingAction === "save-project-understanding" || parsed.pendingAction === "save-session-summary") {
      return parsed.pendingAction;
    }
    return null;
  } catch {
    return null;
  }
}

async function detectPlaceholders(memoryDir: string): Promise<boolean> {
  for (const fileName of PLACEHOLDER_FILES) {
    const content = await tryReadFile(path.join(memoryDir, fileName));
    if (content === null) continue;
    if (PLACEHOLDER_PHRASES.some((phrase) => content.includes(phrase))) {
      return true;
    }
  }
  return false;
}

async function detectReviewSignals(memoryDir: string): Promise<string | null> {
  const healthRaw = await tryReadFile(path.join(memoryDir, "health-check.md"));
  if (healthRaw && /^- Status:\s*needs-review/m.test(healthRaw)) {
    return "Last health check reported needs-review.";
  }
  const sessionsDir = path.join(memoryDir, "sessions");
  let entries: string[];
  try {
    entries = await fs.readdir(sessionsDir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const content = await tryReadFile(path.join(sessionsDir, entry));
    if (content && content.includes("## DevMemory Warnings")) {
      return "One or more session logs were applied with warnings.";
    }
  }
  return null;
}

async function countPasteGuardEvents(memoryDir: string): Promise<number> {
  const sessionsDir = path.join(memoryDir, "sessions");
  let entries: string[];
  try {
    entries = await fs.readdir(sessionsDir);
  } catch {
    return 0;
  }
  return entries.filter((name) => name.endsWith("-paste-guard.md")).length;
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function daysBetween(a: Date, b: Date): number {
  const diff = Math.abs(b.getTime() - a.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
