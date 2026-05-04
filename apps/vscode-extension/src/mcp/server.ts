// DevMemory AI — minimal MCP server (stdio, JSON-RPC 2.0).
// Spec: https://modelcontextprotocol.io/specification/2025-06-18
//
// This file is bundled to dist/mcp-server.js by esbuild and spawned as a child
// process by MCP-aware clients (Claude Code, Cursor, Cline, Continue) via the
// .vscode/mcp.json manifest written by the DevMemory extension.
//
// Pure Node — no vscode import — so the same code can run from any MCP host.

import fs from "node:fs/promises";
import path from "node:path";
import {
  loadConfig,
  resolveMemoryDir,
  validateAiResponse
} from "@devmemory/core";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const SERVER_NAME = "devmemory";
const SERVER_VERSION = "0.3.0";
const PROTOCOL_VERSION = "2024-11-05";

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>, ctx: ServerContext) => Promise<{ content: ContentPart[]; isError?: boolean }>;
}

interface ServerContext {
  workspaceRoot: string;
}

interface ContentPart {
  type: "text";
  text: string;
}

const SECTIONS: Record<string, string> = {
  "project-summary": "project-summary.md",
  architecture: "architecture.md",
  "current-state": "current-state.md",
  "next-actions": path.join("tasks", "next-actions.md"),
  decisions: path.join("decisions", "decisions.md"),
  bugs: path.join("issues", "bugs-and-fixes.md")
};

const TOOLS: ToolDefinition[] = [
  {
    name: "memory.read",
    description:
      "Read one of the DevMemory project memory sections from .ai-memory/. Read-only. Use before answering questions about the project's purpose, architecture, current state, next actions, decisions, or bugs.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: Object.keys(SECTIONS),
          description: "Which section to read."
        }
      },
      required: ["section"]
    },
    async handler(args, ctx) {
      const section = String(args.section ?? "");
      const relative = SECTIONS[section];
      if (!relative) {
        return errorResult(`Unknown section: ${section}. Valid sections: ${Object.keys(SECTIONS).join(", ")}.`);
      }
      const config = await loadConfig(ctx.workspaceRoot);
      const memoryDir = resolveMemoryDir(ctx.workspaceRoot, config);
      try {
        const raw = await fs.readFile(path.join(memoryDir, relative), "utf8");
        return { content: [{ type: "text", text: stripManagedHeader(raw) }] };
      } catch (error) {
        if (isMissing(error)) {
          return errorResult(
            `.ai-memory/${relative} does not exist yet. The user must run "DevMemory AI: Scan This Project" and "Teach The AI About This Project" first.`
          );
        }
        throw error;
      }
    }
  },
  {
    name: "memory.search",
    description:
      "Search the local DevMemory decisions and bugs logs for a substring (case-insensitive). Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to search for in decisions and bugs logs." }
      },
      required: ["query"]
    },
    async handler(args, ctx) {
      const query = String(args.query ?? "").trim().toLowerCase();
      if (!query) {
        return errorResult("Provide a non-empty `query` string.");
      }
      const config = await loadConfig(ctx.workspaceRoot);
      const memoryDir = resolveMemoryDir(ctx.workspaceRoot, config);
      const matches: string[] = [];
      for (const fileName of ["decisions/decisions.md", "issues/bugs-and-fixes.md"]) {
        try {
          const raw = await fs.readFile(path.join(memoryDir, fileName), "utf8");
          const blocks = raw.split(/^---\s*$/m);
          for (const block of blocks) {
            if (block.toLowerCase().includes(query)) {
              const trimmed = block.trim();
              if (trimmed.length > 0) {
                matches.push(`### ${fileName}\n\n${trimmed.length > 4000 ? trimmed.slice(0, 3900) + "…" : trimmed}`);
              }
            }
          }
        } catch (error) {
          if (!isMissing(error)) throw error;
        }
      }
      if (matches.length === 0) {
        return { content: [{ type: "text", text: `No decisions or bugs matched "${query}".` }] };
      }
      return {
        content: [
          {
            type: "text",
            text: `Found ${matches.length} match(es) for "${query}":\n\n${matches.slice(0, 8).join("\n\n---\n\n")}`
          }
        ]
      };
    }
  },
  {
    name: "memory.audit",
    description:
      "Validate AI-produced text for destructive shell commands (rm -rf, DROP DATABASE, fork bombs, ...) and simulated/fictitious content. Returns warnings before the user runs anything.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "AI-generated text to inspect." }
      },
      required: ["text"]
    },
    async handler(args) {
      const text = String(args.text ?? "");
      if (!text) {
        return errorResult("Provide non-empty `text`.");
      }
      const findings = validateAiResponse(text);
      if (findings.length === 0) {
        return { content: [{ type: "text", text: "DevMemory audit: no destructive shapes detected." }] };
      }
      const lines: string[] = [`DevMemory audit: ${findings.length} risk(s) detected.`];
      for (const f of findings) {
        lines.push(`- [${f.severity}] ${f.message}${f.line ? ` (line ${f.line})` : ""}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  },
  {
    name: "memory.appendSession",
    description:
      "Append a session draft to .ai-memory/sessions/. The summary is signed in the audit log if the audit pack is enabled. Use at the end of an AI coding turn that produced concrete changes.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Concise durable summary of what changed." },
        title: { type: "string", description: "Optional short title for the session." }
      },
      required: ["summary"]
    },
    async handler(args, ctx) {
      const summary = String(args.summary ?? "").trim();
      if (!summary) {
        return errorResult("Provide a non-empty `summary` string.");
      }
      const title = typeof args.title === "string" ? args.title : undefined;
      const config = await loadConfig(ctx.workspaceRoot);
      const memoryDir = resolveMemoryDir(ctx.workspaceRoot, config);
      const sessionsDir = path.join(memoryDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });
      const slug = (title ?? "mcp-session").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mcp-session";
      const fileName = `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${slug}.md`;
      const filePath = path.join(sessionsDir, fileName);
      const body = [
        "<!-- devmemory:managed -->",
        "",
        `# ${title ?? "MCP Session Draft"}`,
        "",
        `Date: ${new Date().toISOString()}`,
        "",
        "## Summary",
        "",
        summary,
        ""
      ].join("\n");
      await fs.writeFile(filePath, body, "utf8");
      return {
        content: [
          {
            type: "text",
            text: `Saved session draft to .ai-memory/sessions/${fileName}. Tell the user to run "DevMemory AI: Check Memory Health" to consolidate.`
          }
        ]
      };
    }
  }
];

function errorResult(message: string): { content: ContentPart[]; isError: boolean } {
  return { content: [{ type: "text", text: message }], isError: true };
}

function stripManagedHeader(value: string): string {
  return value.replace(/<!--\s*devmemory:managed[\s\S]*?-->/g, "").replace(/^\s*\n/, "").trim();
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT"
  );
}

async function dispatch(req: JsonRpcRequest, ctx: ServerContext): Promise<JsonRpcResponse> {
  const id = req.id ?? null;
  try {
    if (req.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {}, resources: {} }
        }
      };
    }
    if (req.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }))
        }
      };
    }
    if (req.method === "tools/call") {
      const params = (req.params ?? {}) as { name?: unknown; arguments?: Record<string, unknown> };
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${String(params.name)}` }
        };
      }
      const result = await tool.handler(params.arguments ?? {}, ctx);
      return { jsonrpc: "2.0", id, result };
    }
    if (req.method === "resources/list") {
      const config = await loadConfig(ctx.workspaceRoot);
      const memoryDir = resolveMemoryDir(ctx.workspaceRoot, config);
      const resources: Array<{ uri: string; name: string; mimeType: string }> = [];
      for (const [name, relative] of Object.entries(SECTIONS)) {
        try {
          await fs.access(path.join(memoryDir, relative));
          resources.push({
            uri: `devmemory://workspace/${name}`,
            name: `DevMemory · ${name}`,
            mimeType: "text/markdown"
          });
        } catch {
          // skip missing resources
        }
      }
      return { jsonrpc: "2.0", id, result: { resources } };
    }
    if (req.method === "resources/read") {
      const params = (req.params ?? {}) as { uri?: string };
      const match = (params.uri ?? "").match(/^devmemory:\/\/workspace\/(.+)$/);
      if (!match) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: `Invalid resource URI: ${params.uri}` } };
      }
      const sectionName = match[1];
      const relative = SECTIONS[sectionName];
      if (!relative) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown resource: ${sectionName}` } };
      }
      const config = await loadConfig(ctx.workspaceRoot);
      const memoryDir = resolveMemoryDir(ctx.workspaceRoot, config);
      const raw = await fs.readFile(path.join(memoryDir, relative), "utf8");
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            { uri: params.uri ?? "", mimeType: "text/markdown", text: stripManagedHeader(raw) }
          ]
        }
      };
    }
    if (req.method === "ping" || req.method === "shutdown") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${req.method}` }
    };
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

async function main(): Promise<void> {
  const workspaceRoot = process.env.DEVMEMORY_WORKSPACE || process.cwd();
  const ctx: ServerContext = { workspaceRoot };

  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      let request: JsonRpcRequest;
      try {
        request = JSON.parse(line) as JsonRpcRequest;
      } catch (error) {
        emit({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error", data: error instanceof Error ? error.message : String(error) }
        });
        continue;
      }
      void dispatch(request, ctx).then(emit);
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });
}

function emit(response: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

void main();
