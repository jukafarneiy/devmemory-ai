import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import {
  RiskFinding,
  highestSeverity,
  loadConfig,
  recordEvent,
  resolveMemoryDir,
  validateAiResponse
} from "@devmemory/core";
import { appendAllowlist, isAllowed, loadAllowlist } from "./allowlist";

interface PasteGuardSettings {
  enabled: boolean;
  minChars: number;
  allowedFileGlobs: string[];
  telemetryEnabled: boolean;
}

interface PendingFinding {
  documentUri: vscode.Uri;
  range: vscode.Range;
  insertedText: string;
  findings: RiskFinding[];
  expiresAt: number;
}

const FINDING_TTL_MS = 60_000;
const MAX_TRACKED_FINDINGS = 25;

export class PasteGuard implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly findings = new Map<string, PendingFinding>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly codeLensProvider: PasteGuardCodeLensProvider;

  constructor(private readonly extensionContext: vscode.ExtensionContext) {
    this.codeLensProvider = new PasteGuardCodeLensProvider(this.findings, this.emitter.event);
    this.disposables.push(
      this.emitter,
      vscode.languages.registerCodeLensProvider({ scheme: "file" }, this.codeLensProvider),
      vscode.workspace.onDidChangeTextDocument((event) => {
        void this.handleDocumentChange(event);
      })
    );
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch {
        // best-effort
      }
    }
    this.findings.clear();
  }

  private async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
    const settings = readSettings();
    if (!settings.enabled) {
      return;
    }
    const document = event.document;
    if (document.uri.scheme !== "file") {
      return;
    }
    if (isUntitledOrScratch(document)) {
      return;
    }

    const rootDir = workspaceRootForUri(document.uri);
    if (!rootDir) {
      return;
    }
    if (isWithinMemoryDir(document.uri.fsPath)) {
      return;
    }
    if (matchesAnyGlob(document.uri.fsPath, rootDir, settings.allowedFileGlobs)) {
      return;
    }

    for (const change of event.contentChanges) {
      const insertedText = change.text;
      if (insertedText.length < settings.minChars) {
        continue;
      }
      if (countNewlines(insertedText) < 1 && insertedText.length < settings.minChars) {
        continue;
      }

      let findings = validateAiResponse(insertedText, { minLength: 1 });
      if (findings.length === 0) {
        continue;
      }

      const allowlist = await loadAllowlist(rootDir);
      if (allowlist.length > 0) {
        findings = findings.filter((finding) => !(finding.match && isAllowed(finding.match, allowlist)));
        if (findings.length === 0) {
          continue;
        }
      }

      const startOffset = document.offsetAt(change.range.start);
      const endOffset = startOffset + insertedText.length;
      const startPos = document.positionAt(startOffset);
      const endPos = document.positionAt(endOffset);

      const pending: PendingFinding = {
        documentUri: document.uri,
        range: new vscode.Range(startPos, endPos),
        insertedText,
        findings,
        expiresAt: Date.now() + FINDING_TTL_MS
      };
      this.trackFinding(pending);
      this.emitter.fire(document.uri);

      const severity = highestSeverity(findings);
      await this.logFinding(rootDir, document, findings);

      void recordEvent(
        severity === "blocking" ? "pasteGuard.blocked" : "pasteGuard.warning",
        {
          severity: severity ?? "warning",
          finding_count: findings.length,
          rules: findings.map((f) => f.rule).join(",").slice(0, 64)
        },
        { enabled: settings.telemetryEnabled, rootDir }
      ).catch(() => {});

      if (severity === "blocking") {
        await this.promptBlocking(document, pending);
      }
    }
  }

  private trackFinding(finding: PendingFinding): void {
    if (this.findings.size >= MAX_TRACKED_FINDINGS) {
      const oldest = [...this.findings.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) {
        this.findings.delete(oldest[0]);
      }
    }
    const id = `${finding.documentUri.toString()}#${finding.range.start.line}:${finding.range.start.character}-${Date.now()}`;
    this.findings.set(id, finding);
    setTimeout(() => {
      this.findings.delete(id);
      this.emitter.fire(finding.documentUri);
    }, FINDING_TTL_MS).unref?.();
  }

  private async promptBlocking(document: vscode.TextDocument, finding: PendingFinding): Promise<void> {
    const labels = finding.findings
      .filter((f) => f.severity === "blocking")
      .map((f) => f.message.replace(/^Detected destructive command:\s*/, "").replace(/\.$/, ""))
      .filter(Boolean);
    const summary = labels.slice(0, 3).join("; ");

    const choice = await vscode.window.showWarningMessage(
      `DevMemory blocked a destructive paste: ${summary}. Review before keeping.`,
      { modal: true },
      "Undo paste",
      "Keep with warning",
      "Add to allowlist"
    );

    if (choice === "Undo paste") {
      await this.undoPaste(document, finding);
      void recordEvent(
        "pasteGuard.undo",
        { severity: "blocking" },
        {
          enabled: readSettings().telemetryEnabled,
          rootDir: workspaceRootForUri(document.uri) ?? document.uri.fsPath
        }
      ).catch(() => {});
    } else if (choice === "Add to allowlist") {
      const rootDir = workspaceRootForUri(document.uri);
      if (rootDir) {
        const sample = finding.findings[0]?.match ?? finding.insertedText.slice(0, 60);
        const escaped = escapeRegex(sample);
        await appendAllowlist(rootDir, escaped);
        await vscode.window.showInformationMessage(
          `DevMemory paste-guard allowlist updated. Pattern: /${escaped}/.`
        );
      }
    }
  }

  private async undoPaste(document: vscode.TextDocument, finding: PendingFinding): Promise<void> {
    const editor =
      vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === document.uri.toString()) ??
      (await vscode.window.showTextDocument(document, { preview: false }));

    const success = await editor.edit((edit) => {
      edit.delete(finding.range);
    });
    if (!success) {
      await vscode.window.showWarningMessage(
        "DevMemory could not undo the paste automatically. Use Ctrl/Cmd+Z."
      );
    }
  }

  private async logFinding(
    rootDir: string,
    document: vscode.TextDocument,
    findings: RiskFinding[]
  ): Promise<void> {
    try {
      const config = await loadConfig(rootDir);
      const memoryDir = resolveMemoryDir(rootDir, config);
      const sessionsDir = path.join(memoryDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });
      const date = new Date();
      const fileName = `${date.toISOString().replace(/[:.]/g, "-").slice(0, 19)}-paste-guard.md`;
      const lines: string[] = [
        "<!-- devmemory:managed -->",
        "",
        `# Paste Guard ${date.toISOString()}`,
        "",
        `- Document: ${path.relative(rootDir, document.uri.fsPath)}`,
        `- Findings: ${findings.length}`,
        "",
        "## Risks",
        ""
      ];
      for (const f of findings) {
        lines.push(`- [${f.severity.toUpperCase()}] ${f.message}${f.line ? ` (line ${f.line})` : ""}`);
      }
      lines.push("");
      await fs.appendFile(path.join(sessionsDir, fileName), `${lines.join("\n")}\n`, "utf8");
    } catch {
      // best-effort logging — never block the editor
    }
  }
}

class PasteGuardCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    private readonly findings: Map<string, PendingFinding>,
    onUriChanged: vscode.Event<vscode.Uri>
  ) {
    onUriChanged(() => this._onDidChangeCodeLenses.fire());
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const now = Date.now();
    const lenses: vscode.CodeLens[] = [];
    for (const finding of this.findings.values()) {
      if (finding.documentUri.toString() !== document.uri.toString()) {
        continue;
      }
      if (finding.expiresAt < now) {
        continue;
      }
      const blocking = finding.findings.filter((f) => f.severity === "blocking").length;
      const warnings = finding.findings.filter((f) => f.severity === "warning").length;
      const label =
        blocking > 0
          ? `🛑 DevMemory: ${blocking} destructive command${blocking === 1 ? "" : "s"} pasted — review`
          : `⚠️ DevMemory: ${warnings} risk${warnings === 1 ? "" : "s"} pasted — review`;
      const headRange = new vscode.Range(finding.range.start, finding.range.start);
      lenses.push(
        new vscode.CodeLens(headRange, {
          title: label,
          command: "devmemory.viewPasteGuardLog",
          tooltip: finding.findings
            .map((f) => `[${f.severity}] ${f.message}`)
            .join("\n")
            .slice(0, 800)
        })
      );
    }
    return lenses;
  }
}

export function readSettings(): PasteGuardSettings {
  const cfg = vscode.workspace.getConfiguration("devmemory");
  return {
    enabled: cfg.get<boolean>("pasteGuard.enabled", true),
    minChars: clampInt(cfg.get<number>("pasteGuard.minChars", 200), 50, 5000),
    allowedFileGlobs: cfg.get<string[]>("pasteGuard.allowedFileGlobs", [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test.js",
      "**/*.spec.ts",
      "**/*.md",
      "**/.ai-memory/**"
    ]),
    telemetryEnabled: cfg.get<boolean>("telemetry.enabled", false)
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isUntitledOrScratch(document: vscode.TextDocument): boolean {
  if (document.isUntitled) {
    return true;
  }
  if (!document.uri.fsPath) {
    return true;
  }
  return false;
}

function workspaceRootForUri(uri: vscode.Uri): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (folder) {
    return folder.uri.fsPath;
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function isWithinMemoryDir(filePath: string): boolean {
  return filePath.includes(`${path.sep}.ai-memory${path.sep}`);
}

function matchesAnyGlob(filePath: string, rootDir: string, globs: ReadonlyArray<string>): boolean {
  if (globs.length === 0) {
    return false;
  }
  const relative = path.relative(rootDir, filePath).split(path.sep).join("/");
  for (const glob of globs) {
    if (toRegexFromGlob(glob).test(relative)) {
      return true;
    }
  }
  return false;
}

function toRegexFromGlob(glob: string): RegExp {
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
    } else if (ch === "?") {
      re += "[^/]";
      i += 1;
    } else if ("\\.+^$()|[]{}".includes(ch)) {
      re += `\\${ch}`;
      i += 1;
    } else {
      re += ch;
      i += 1;
    }
  }
  re += "$";
  return new RegExp(re);
}

function countNewlines(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
