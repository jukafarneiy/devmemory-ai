# Connect Claude Code / Cursor / Cline / Continue

Run *Export Context To CLAUDE.md / AGENTS.md / Copilot / Cursor* and DevMemory writes a managed block into each target file:

```
<!-- devmemory:managed:start -->
... your project memory ...
<!-- devmemory:managed:end -->
```

Anything **outside** these markers is preserved on every export. So your hand-written rules in `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` stay intact.

## Why all four targets

- `CLAUDE.md` — Anthropic Claude Code reads this automatically.
- `AGENTS.md` — agentic-conventions file consumed by Codex, Cline, Roo, several agents.
- `.cursorrules` — Cursor.
- `.github/copilot-instructions.md` — GitHub Copilot's per-repo prefix.

## MCP-aware clients

If you also enable *MCP Server* (`devmemory.exposeMcpServer`), Claude Code, Cursor, Cline, and Continue can call DevMemory tools directly via Model Context Protocol — no clipboard, no managed-file edits, just live context. DevMemory writes `.vscode/mcp.json` between its markers so client auto-discovery works on any MCP-aware tool.

## When to re-export

Re-run after a session that meaningfully changed `project-summary.md`, `architecture.md`, or `current-state.md`. The managed block is updated **in place** — no commit churn.
