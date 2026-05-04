import * as vscode from "vscode";
import type { FlowState } from "./state";
import { readFlowState } from "./state";

interface ActionItem {
  label: string;
  command: string;
  codicon: string;
  tooltip: string;
}

const TODAY_BASE: ActionItem[] = [
  {
    label: "Resume AI session",
    command: "devmemory.generateResumePrompt",
    codicon: "play",
    tooltip: "Copies a fresh resume prompt to clipboard, primed with current memory."
  },
  {
    label: "Wrap up session",
    command: "devmemory.generateSessionEndPrompt",
    codicon: "stop-circle",
    tooltip: "Copies a wrap-up prompt; paste into your AI; come back and click Save when it replies."
  }
];

const PROJECT_MEMORY: ActionItem[] = [
  {
    label: "Teach the AI about this project",
    command: "devmemory.generateBootstrapPrompt",
    codicon: "lightbulb",
    tooltip: "Copies a stack-aware bootstrap prompt to clipboard."
  },
  {
    label: "Save what the AI told me",
    command: "devmemory.applyBootstrapMemory",
    codicon: "save",
    tooltip: "Reads the AI's bootstrap response from clipboard and writes it into project memory."
  },
  {
    label: "Open .ai-memory/",
    command: "devmemory.openMemoryFolder",
    codicon: "folder-opened",
    tooltip: "Opens project-summary.md so you can see and edit current memory."
  },
  {
    label: "View scan report",
    command: "devmemory.openScanReport",
    codicon: "checklist",
    tooltip: "Opens the latest scan-report.md (which files are tracked vs. skipped)."
  },
  {
    label: "Check memory health",
    command: "devmemory.runHealthCheck",
    codicon: "pulse",
    tooltip: "Audits the local memory store and writes health-check.md."
  },
  {
    label: "Export to CLAUDE.md / AGENTS.md / Cursor / Copilot",
    command: "devmemory.exportAIContextFiles",
    codicon: "export",
    tooltip: "Writes a managed block into each file. Hand-written content outside markers is preserved."
  },
  {
    label: "Export audit pack",
    command: "devmemory.exportAuditPack",
    codicon: "shield",
    tooltip: "Generates a signed, verifiable record of every session and paste-guard event in this project."
  }
];

const SETTINGS_BASE: ActionItem[] = [
  {
    label: "Open welcome walkthrough",
    command: "devmemory.openWalkthrough",
    codicon: "rocket",
    tooltip: "Replays the 4-step onboarding."
  },
  {
    label: "View paste guard log",
    command: "devmemory.viewPasteGuardLog",
    codicon: "shield",
    tooltip: "Latest paste-guard catch as a markdown file."
  },
  {
    label: "View local telemetry",
    command: "devmemory.viewTelemetry",
    codicon: "graph-line",
    tooltip: "Opt-in only, never sent over the network. Edit Settings → DevMemory AI → Telemetry."
  },
  {
    label: "Open settings",
    command: "workbench.action.openSettings",
    codicon: "settings-gear",
    tooltip: "Opens VS Code settings filtered to DevMemory AI."
  }
];

interface GroupDefinition {
  id: "today" | "project" | "settings";
  label: string;
  collapsible: vscode.TreeItemCollapsibleState;
}

const GROUP_DEFINITIONS: GroupDefinition[] = [
  { id: "today", label: "Today", collapsible: vscode.TreeItemCollapsibleState.Expanded },
  { id: "project", label: "Project memory", collapsible: vscode.TreeItemCollapsibleState.Collapsed },
  { id: "settings", label: "Settings & maintenance", collapsible: vscode.TreeItemCollapsibleState.Collapsed }
];

class GroupTreeItem extends vscode.TreeItem {
  constructor(public readonly groupId: GroupDefinition["id"], label: string, collapsible: vscode.TreeItemCollapsibleState) {
    super(label, collapsible);
    this.contextValue = `devmemory.group.${groupId}`;
  }
}

export class ActionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private state: FlowState | null = null;

  refresh(): void {
    void readFlowState().then((s) => {
      this.state = s;
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }

  async getChildren(parent?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!this.state) {
      this.state = await readFlowState();
    }
    if (parent instanceof GroupTreeItem) {
      return this.buildGroupChildren(parent.groupId);
    }
    if (parent) {
      return [];
    }
    return GROUP_DEFINITIONS.map((g) => new GroupTreeItem(g.id, g.label, g.collapsible));
  }

  private buildGroupChildren(groupId: GroupDefinition["id"]): vscode.TreeItem[] {
    if (groupId === "today") {
      const items = this.todayActions();
      if (items.length === 0) {
        return [makeInfoItem("No active session", "info", undefined, "Open the hero panel above for the next step.")];
      }
      return items.map(makeActionItem);
    }
    if (groupId === "project") {
      return PROJECT_MEMORY.map(makeActionItem);
    }
    return SETTINGS_BASE.map(makeActionItem);
  }

  private todayActions(): ActionItem[] {
    if (!this.state || this.state.kind === "no-workspace" || this.state.kind === "not-set-up") {
      return [];
    }
    if (this.state.kind === "needs-understanding") {
      return [];
    }
    return TODAY_BASE;
  }
}

function makeInfoItem(label: string, codicon: string, description?: string, tooltip?: string): vscode.TreeItem {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(codicon);
  if (description !== undefined) {
    item.description = description;
  }
  item.tooltip = tooltip ?? (description ? `${label}: ${description}` : label);
  item.contextValue = "devmemory.statusItem";
  return item;
}

function makeActionItem(action: ActionItem): vscode.TreeItem {
  const item = new vscode.TreeItem(action.label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(action.codicon);
  item.tooltip = action.tooltip;
  item.command = { command: action.command, title: action.label };
  item.contextValue = "devmemory.actionItem";
  return item;
}
