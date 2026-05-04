import * as assert from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "devmemory-ai.devmemory-ai-vscode";

function workspaceFolder(): string {
  const folders = vscode.workspace.workspaceFolders;
  assert.ok(folders && folders.length > 0, "expected a workspace folder to be open");
  return folders[0].uri.fsPath;
}

suite("DevMemory paste guard smoke", () => {
  const stubbedWarnings: string[] = [];
  let originalShowWarn: typeof vscode.window.showWarningMessage;

  suiteSetup(async () => {
    originalShowWarn = vscode.window.showWarningMessage;
    (vscode.window as any).showWarningMessage = async (...args: unknown[]) => {
      const message = typeof args[0] === "string" ? args[0] : "";
      stubbedWarnings.push(message);
      // Default response: no-op (do not Undo, do not allowlist).
      return undefined;
    };

    await vscode.workspace
      .getConfiguration("devmemory")
      .update("confirmBeforeScan", false, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace
      .getConfiguration("devmemory")
      .update("pasteGuard.enabled", true, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace
      .getConfiguration("devmemory")
      .update("pasteGuard.minChars", 50, vscode.ConfigurationTarget.Workspace);

    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} not found in test host`);
    if (!ext.isActive) {
      await ext.activate();
    }

    // Ensure .ai-memory exists so the guard log can be written.
    const root = workspaceFolder();
    if (!existsSync(path.join(root, ".ai-memory"))) {
      await vscode.commands.executeCommand("devmemory.initializeProject");
    }
  });

  suiteTeardown(() => {
    (vscode.window as any).showWarningMessage = originalShowWarn;
  });

  test("inserting a destructive paste produces a paste-guard session log", async () => {
    const root = workspaceFolder();
    const fileUri = vscode.Uri.file(path.join(root, "src", "destructive.ts"));
    const we = new vscode.WorkspaceEdit();
    we.createFile(fileUri, { overwrite: true });
    we.insert(fileUri, new vscode.Position(0, 0), "// scratch\n");
    await vscode.workspace.applyEdit(we);
    const document = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });

    const fakeAiPaste = [
      "// AI suggested cleanup steps:",
      "rm -rf ~/projects/old",
      "git push --force origin main",
      "DROP DATABASE production;",
      "",
      "// please confirm before running"
    ].join("\n");

    await editor.edit((edit) => {
      edit.insert(new vscode.Position(1, 0), fakeAiPaste);
    });

    // Give the guard's async logger a moment to flush.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const sessionsDir = path.join(root, ".ai-memory", "sessions");
    assert.ok(existsSync(sessionsDir), `sessions dir should exist at ${sessionsDir}`);
    const files = readdirSync(sessionsDir).filter((f) => f.endsWith("-paste-guard.md"));
    assert.ok(files.length > 0, "expected at least one paste-guard log file");
    const log = readFileSync(path.join(sessionsDir, files[0]), "utf8");
    assert.match(log, /\[BLOCKING\]/, "log should contain at least one BLOCKING finding");
    assert.match(log, /rm -rf|DROP DATABASE/, "log should mention the destructive command");
  });
});
