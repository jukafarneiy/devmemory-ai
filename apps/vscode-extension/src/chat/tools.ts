import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import {
  loadConfig,
  resolveMemoryDir,
  validateAiResponse
} from "@devmemory/core";

export function registerLanguageModelTools(context: vscode.ExtensionContext): vscode.Disposable[] {
  if (!isLmToolsApiAvailable()) {
    return [];
  }

  const disposables: vscode.Disposable[] = [
    vscode.lm.registerTool("devmemory_getProjectSummary", new MemoryFileTool("project-summary.md")),
    vscode.lm.registerTool("devmemory_getArchitecture", new MemoryFileTool("architecture.md")),
    vscode.lm.registerTool("devmemory_getCurrentState", new MemoryFileTool("current-state.md")),
    vscode.lm.registerTool("devmemory_searchDecisions", new SearchDecisionsTool()),
    vscode.lm.registerTool("devmemory_auditAiResponse", new AuditAiResponseTool())
  ];
  context.subscriptions.push(...disposables);
  return disposables;
}

function isLmToolsApiAvailable(): boolean {
  return typeof (vscode as { lm?: unknown }).lm !== "undefined" &&
    typeof (vscode.lm as { registerTool?: unknown }).registerTool === "function";
}

class MemoryFileTool implements vscode.LanguageModelTool<Record<string, never>> {
  constructor(private readonly relativePath: string) {}

  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootDir) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          "DevMemory: no workspace open. Open a project folder before invoking memory tools."
        )
      ]);
    }
    try {
      const config = await loadConfig(rootDir);
      const memoryDir = resolveMemoryDir(rootDir, config);
      const filePath = path.join(memoryDir, this.relativePath);
      const raw = await fs.readFile(filePath, "utf8");
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(stripManagedHeader(raw))]);
    } catch (error) {
      const message =
        isMissing(error)
          ? `DevMemory: \`.ai-memory/${this.relativePath}\` does not exist yet. Tell the user to run "DevMemory AI: Scan This Project" and "DevMemory AI: Teach The AI About This Project" first.`
          : `DevMemory: could not read .ai-memory/${this.relativePath}: ${formatError(error)}`;
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
    }
  }
}

interface SearchDecisionsInput {
  query: string;
}

class SearchDecisionsTool implements vscode.LanguageModelTool<SearchDecisionsInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SearchDecisionsInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootDir) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("DevMemory: no workspace open.")
      ]);
    }
    const query = (options.input?.query ?? "").trim();
    if (!query) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("DevMemory: provide a non-empty `query` to search the decisions log.")
      ]);
    }
    try {
      const config = await loadConfig(rootDir);
      const memoryDir = resolveMemoryDir(rootDir, config);
      const decisionsPath = path.join(memoryDir, "decisions", "decisions.md");
      const raw = await fs.readFile(decisionsPath, "utf8");
      const matches = matchDecisions(raw, query);
      if (matches.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`DevMemory: no decisions matched "${query}".`)
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `DevMemory: ${matches.length} decision block(s) matched "${query}":\n\n${matches.join("\n\n---\n\n")}`
        )
      ]);
    } catch (error) {
      const message = isMissing(error)
        ? "DevMemory: no decisions log yet (.ai-memory/decisions/decisions.md). Save a session that includes a DECISIONS section first."
        : `DevMemory: could not read decisions log: ${formatError(error)}`;
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(message)]);
    }
  }
}

interface AuditInput {
  text: string;
}

class AuditAiResponseTool implements vscode.LanguageModelTool<AuditInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AuditInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const text = options.input?.text ?? "";
    if (typeof text !== "string" || text.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("DevMemory: pass `text` to audit. Got an empty payload.")
      ]);
    }
    const findings = validateAiResponse(text);
    if (findings.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("DevMemory audit: no destructive shapes or simulated content detected.")
      ]);
    }
    const lines: string[] = [`DevMemory audit: ${findings.length} risk(s) detected.`];
    for (const f of findings) {
      lines.push(`- [${f.severity}] ${f.message}${f.line ? ` (line ${f.line})` : ""}`);
    }
    lines.push("\nReturn the warnings to the user before they execute any of these commands.");
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(lines.join("\n"))]);
  }
}

function matchDecisions(raw: string, query: string): string[] {
  const lcQuery = query.toLowerCase();
  const blocks = raw.split(/^---\s*$/m);
  const results: string[] = [];
  for (const block of blocks) {
    if (block.toLowerCase().includes(lcQuery)) {
      const trimmed = block.trim();
      if (trimmed.length > 0 && trimmed.length < 4000) {
        results.push(trimmed);
      } else if (trimmed.length >= 4000) {
        results.push(`${trimmed.slice(0, 3900)}…`);
      }
    }
  }
  return results.slice(0, 6);
}

function stripManagedHeader(value: string): string {
  return value.replace(/<!--\s*devmemory:managed[\s\S]*?-->/g, "").replace(/^\s*\n/, "").trim();
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT"
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
