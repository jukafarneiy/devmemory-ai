import * as vscode from "vscode";
import { readFlowState } from "./state";

export class StatusBarController implements vscode.Disposable {
  private readonly memoryItem: vscode.StatusBarItem;
  private readonly guardItem: vscode.StatusBarItem;
  private timer: NodeJS.Timeout | undefined;

  constructor() {
    this.memoryItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.memoryItem.text = "$(book) DevMemory";
    this.memoryItem.tooltip = "DevMemory AI — open project memory.";
    this.memoryItem.command = "devmemory.heroView.focus";
    this.memoryItem.show();

    this.guardItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.guardItem.text = "$(shield)";
    this.guardItem.tooltip = "DevMemory paste guard — open the latest catch.";
    this.guardItem.command = "devmemory.viewPasteGuardLog";
  }

  async refresh(): Promise<void> {
    const state = await readFlowState();
    this.memoryItem.text = renderMemoryText(state);
    this.memoryItem.tooltip = renderMemoryTooltip(state);
    this.memoryItem.command = state.kind === "not-set-up" || state.kind === "no-workspace"
      ? "workbench.view.extension.devmemory"
      : "devmemory.generateResumePrompt";

    if (state.pasteGuardCount > 0) {
      this.guardItem.text = `$(shield) ${state.pasteGuardCount}`;
      this.guardItem.tooltip = `DevMemory paste guard caught ${state.pasteGuardCount} destructive paste${state.pasteGuardCount === 1 ? "" : "s"} in this project. Click to open the latest log.`;
      this.guardItem.show();
    } else {
      this.guardItem.hide();
    }
  }

  startAutoRefresh(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.refresh();
    }, 30_000);
    this.timer.unref?.();
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.memoryItem.dispose();
    this.guardItem.dispose();
  }
}

function renderMemoryText(state: ReturnType<typeof readFlowState> extends Promise<infer T> ? T : never): string {
  if (state.kind === "no-workspace") return "$(book) DevMemory: ?";
  if (state.kind === "not-set-up") return "$(book) DevMemory: setup";
  if (state.kind === "needs-attention") return "$(warning) DevMemory: ⚠";
  if (state.kind === "needs-review") return "$(book) DevMemory: review";
  if (state.kind === "needs-understanding") return "$(book) DevMemory: teach";
  if (state.memoryAgeDays && state.memoryAgeDays > 30) {
    return `$(book) DevMemory: ${state.memoryAgeDays}d (stale)`;
  }
  if (state.memoryAgeDays !== null) {
    return `$(book) DevMemory: ${state.memoryAgeDays}d`;
  }
  return "$(book) DevMemory: ready";
}

function renderMemoryTooltip(state: ReturnType<typeof readFlowState> extends Promise<infer T> ? T : never): string {
  const lines = [`Memory: ${state.qualityLabel}`];
  if (state.detail) {
    lines.push(state.detail);
  }
  if (state.memoryAgeDays !== null) {
    lines.push(`Last scan: ${state.memoryAgeDays} day${state.memoryAgeDays === 1 ? "" : "s"} ago.`);
  }
  if (state.pasteGuardCount > 0) {
    lines.push(`Paste guard catches: ${state.pasteGuardCount}.`);
  }
  return lines.join("\n");
}
