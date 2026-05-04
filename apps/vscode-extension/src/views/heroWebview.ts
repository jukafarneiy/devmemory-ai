import * as vscode from "vscode";
import type { FlowState, FlowStateKind } from "./state";
import { readFlowState } from "./state";

interface PrimaryAction {
  command: string;
  title: string;
  subtitle?: string;
}

const PRIMARY_BY_STATE: Record<FlowStateKind, PrimaryAction> = {
  "no-workspace": {
    command: "workbench.action.files.openFolder",
    title: "Open a workspace",
    subtitle: "DevMemory needs a folder to scan."
  },
  "needs-attention": {
    command: "devmemory.initializeProject",
    title: "Re-scan this project",
    subtitle: "Memory state could not be parsed; re-scan to repair."
  },
  "not-set-up": {
    command: "devmemory.initializeProject",
    title: "Scan this project",
    subtitle: "15 sec — builds .ai-memory/ locally with strict secret exclusions."
  },
  "needs-understanding": {
    command: "devmemory.generateBootstrapPrompt",
    title: "Teach the AI about this project",
    subtitle: "Copies a prompt; paste into your AI; click save when it replies."
  },
  "needs-review": {
    command: "devmemory.runHealthCheck",
    title: "Check memory health",
    subtitle: "Recent sessions were saved with warnings — review."
  },
  "ready": {
    command: "devmemory.generateResumePrompt",
    title: "Resume an AI session",
    subtitle: "Copies a fresh resume prompt with current memory."
  }
};

export class HeroWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "devmemory.heroView";
  private view: vscode.WebviewView | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "run" && typeof message.command === "string") {
        await vscode.commands.executeCommand(message.command);
      }
    });
    view.onDidDispose(() => {
      this.view = undefined;
      if (this.timer) clearInterval(this.timer);
    });

    await this.refresh();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.refresh();
    }, 30_000);
    this.timer.unref?.();
  }

  async refresh(): Promise<void> {
    if (!this.view) return;
    const state = await readFlowState();
    this.view.webview.html = renderHtml(state);
  }
}

function renderHtml(state: FlowState): string {
  const primary = primaryFor(state);
  const guard = state.pasteGuardCount;
  const guardLabel = guard === 0 ? "No catches yet" : `${guard} caught`;
  const memoryAge = renderMemoryAge(state);
  const stateChip = renderStateChip(state);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  :root {
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --bg: var(--vscode-sideBar-background);
    --line: var(--vscode-panel-border);
    --accent: var(--vscode-focusBorder, #2ee6a6);
    --accent-fg: var(--vscode-button-foreground, #fff);
    --warn: #f0a020;
    --bad: #ef4444;
    --ok: #2ee6a6;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 12px;
    color: var(--fg); background: var(--bg);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
  }
  .row { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 8px; border-radius: 999px;
    font-size: 11px;
    background: rgba(127,127,127,0.12);
    color: var(--muted);
  }
  .chip.ok { color: var(--ok); }
  .chip.warn { color: var(--warn); }
  .chip.bad { color: var(--bad); }
  .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .stat {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0; font-size: 12px; color: var(--muted);
  }
  .stat strong { color: var(--fg); font-weight: 500; }
  button.primary {
    width: 100%; margin-top: 12px;
    padding: 10px 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 0; border-radius: 4px;
    font-size: 13px; font-weight: 500;
    cursor: pointer;
    text-align: left;
    line-height: 1.3;
  }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button.primary .subtitle {
    display: block; font-size: 11px; font-weight: 400; opacity: 0.85;
    margin-top: 2px;
  }
  .help {
    margin-top: 8px; font-size: 11px; color: var(--muted);
    line-height: 1.4;
  }
  .help a { color: var(--vscode-textLink-foreground); text-decoration: none; }
  .help a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="row">${stateChip}</div>
  <div class="stat"><span>Memory</span><strong>${escapeHtml(memoryAge)}</strong></div>
  <div class="stat"><span>Paste guard</span><strong>${escapeHtml(guardLabel)}</strong></div>
  ${state.detectedProfiles.length > 0 ? `<div class="stat"><span>Stack</span><strong>${escapeHtml(state.detectedProfiles.map((p) => p.label).join(", "))}</strong></div>` : ""}

  <button class="primary" data-cmd="${escapeHtml(primary.command)}">
    ${escapeHtml(primary.title)}
    ${primary.subtitle ? `<span class="subtitle">${escapeHtml(primary.subtitle)}</span>` : ""}
  </button>

  ${renderHelp(state)}

  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'run', command: btn.getAttribute('data-cmd') });
      });
    });
  </script>
</body>
</html>`;
}

function primaryFor(state: FlowState): PrimaryAction {
  if (state.pendingAction === "save-project-understanding") {
    return {
      command: "devmemory.applyBootstrapMemory",
      title: "Save what the AI told me",
      subtitle: "Paste the AI's reply into your clipboard, then click."
    };
  }
  if (state.pendingAction === "save-session-summary") {
    return {
      command: "devmemory.applySessionUpdate",
      title: "Save what the AI did",
      subtitle: "Paste the AI's session-end reply into your clipboard, then click."
    };
  }
  return PRIMARY_BY_STATE[state.kind];
}

function renderStateChip(state: FlowState): string {
  switch (state.kind) {
    case "ready":
      return `<span class="chip ok"><span class="dot"></span>Ready</span>`;
    case "needs-understanding":
      return `<span class="chip warn"><span class="dot"></span>Needs project understanding</span>`;
    case "needs-review":
      return `<span class="chip warn"><span class="dot"></span>Needs review</span>`;
    case "not-set-up":
      return `<span class="chip"><span class="dot"></span>Not set up</span>`;
    case "needs-attention":
      return `<span class="chip bad"><span class="dot"></span>Needs attention</span>`;
    default:
      return `<span class="chip"><span class="dot"></span>No workspace</span>`;
  }
}

function renderMemoryAge(state: FlowState): string {
  if (state.memoryAgeDays === null) return "—";
  if (state.memoryAgeDays === 0) return "today";
  if (state.memoryAgeDays === 1) return "1 day old";
  if (state.memoryAgeDays > 30) return `${state.memoryAgeDays} d (stale)`;
  return `${state.memoryAgeDays} days old`;
}

function renderHelp(state: FlowState): string {
  if (state.kind === "no-workspace" || state.kind === "not-set-up") {
    return `<p class="help">DevMemory builds a local Markdown memory of this repo. <a href="command:devmemory.openWalkthrough">Open the welcome walkthrough.</a></p>`;
  }
  if (state.kind === "needs-understanding") {
    return `<p class="help">First-time setup: the placeholder content needs to be replaced by an AI's understanding of your repo.</p>`;
  }
  return `<p class="help"><a href="command:devmemory.openWalkthrough">Open the welcome walkthrough</a> · <a href="command:devmemory.openMemoryFolder">Open .ai-memory/</a></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
