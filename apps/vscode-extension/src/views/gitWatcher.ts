import * as vscode from "vscode";

interface GitRepositoryStateLike {
  HEAD?: { commit?: string } | undefined;
  onDidChange(listener: () => void): vscode.Disposable;
}

interface GitRepositoryLike {
  rootUri: vscode.Uri;
  state: GitRepositoryStateLike;
  log?: (options: { maxEntries?: number }) => Promise<Array<{ hash: string; message: string }>>;
}

interface GitApiLike {
  repositories: GitRepositoryLike[];
  onDidOpenRepository(listener: (repo: GitRepositoryLike) => void): vscode.Disposable;
}

interface GitExtensionLike {
  getAPI(version: 1): GitApiLike;
}

export class GitWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly headCache = new Map<string, string>();
  private debounceTimer: NodeJS.Timeout | undefined;
  private dismissedFor: string | null = null;

  static start(context: vscode.ExtensionContext): GitWatcher | undefined {
    const ext = vscode.extensions.getExtension<GitExtensionLike>("vscode.git");
    if (!ext) return undefined;
    const watcher = new GitWatcher();
    void (async () => {
      try {
        const exports = ext.isActive ? ext.exports : await ext.activate();
        const api = exports.getAPI(1);
        watcher.attach(api);
        context.subscriptions.push(watcher);
      } catch {
        // best-effort; extension still works without git
      }
    })();
    return watcher;
  }

  private attach(api: GitApiLike): void {
    for (const repo of api.repositories) {
      this.subscribe(repo);
    }
    this.disposables.push(api.onDidOpenRepository((repo) => this.subscribe(repo)));
  }

  private subscribe(repo: GitRepositoryLike): void {
    const key = repo.rootUri.fsPath;
    this.headCache.set(key, repo.state.HEAD?.commit ?? "");
    this.disposables.push(
      repo.state.onDidChange(() => {
        const before = this.headCache.get(key) ?? "";
        const after = repo.state.HEAD?.commit ?? "";
        if (after && before && after !== before) {
          this.headCache.set(key, after);
          this.scheduleNudge(repo, after);
        } else if (after) {
          this.headCache.set(key, after);
        }
      })
    );
  }

  private scheduleNudge(repo: GitRepositoryLike, commit: string): void {
    if (this.dismissedFor === commit) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.nudge(repo, commit);
    }, 1500);
    this.debounceTimer.unref?.();
  }

  private async nudge(repo: GitRepositoryLike, commit: string): Promise<void> {
    if (!isPassiveMemoryEnabled()) return;

    let lastCommit = "(latest commit)";
    try {
      if (repo.log) {
        const entries = await repo.log({ maxEntries: 1 });
        if (entries[0]?.message) {
          lastCommit = entries[0].message.split(/\r?\n/)[0].slice(0, 80);
        }
      }
    } catch {
      // ignore
    }

    const action = await vscode.window.showInformationMessage(
      `DevMemory: you just committed "${lastCommit}". Save a session draft so the AI remembers this change?`,
      "Wrap up & save",
      "Not now",
      "Don't ask for this commit"
    );
    if (action === "Wrap up & save") {
      await vscode.commands.executeCommand("devmemory.generateSessionEndPrompt");
    } else if (action === "Don't ask for this commit") {
      this.dismissedFor = commit;
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      try { d.dispose(); } catch { /* best-effort */ }
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}

function isPassiveMemoryEnabled(): boolean {
  return vscode.workspace.getConfiguration("devmemory").get<boolean>("autoAttachContext", true);
}
