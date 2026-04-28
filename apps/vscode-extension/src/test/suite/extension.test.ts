import * as assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "devmemory-ai.devmemory-ai-vscode";

const EXPECTED_COMMANDS = [
  "devmemory.initializeProject",
  "devmemory.generateBootstrapPrompt",
  "devmemory.applyBootstrapMemory",
  "devmemory.generateResumePrompt",
  "devmemory.generateSessionEndPrompt",
  "devmemory.applySessionUpdate",
  "devmemory.runHealthCheck",
  "devmemory.exportAIContextFiles"
];

function workspaceFolder(): string {
  const folders = vscode.workspace.workspaceFolders;
  assert.ok(folders && folders.length > 0, "expected a workspace folder to be open");
  return folders[0].uri.fsPath;
}

const capturedInfoMessages: string[] = [];

suite("DevMemory AI extension smoke", () => {
  let originalShowInfo: typeof vscode.window.showInformationMessage;
  let originalShowWarn: typeof vscode.window.showWarningMessage;

  suiteSetup(async () => {
    originalShowInfo = vscode.window.showInformationMessage;
    originalShowWarn = vscode.window.showWarningMessage;
    (vscode.window as any).showInformationMessage = async (message: unknown) => {
      if (typeof message === "string") {
        capturedInfoMessages.push(message);
      }
      return undefined;
    };
    (vscode.window as any).showWarningMessage = async () => undefined;

    await vscode.workspace
      .getConfiguration("devmemory")
      .update("confirmBeforeScan", false, vscode.ConfigurationTarget.Workspace);

    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} not found in test host`);
    if (!ext.isActive) {
      await ext.activate();
    }
  });

  suiteTeardown(() => {
    (vscode.window as any).showInformationMessage = originalShowInfo;
    (vscode.window as any).showWarningMessage = originalShowWarn;
  });

  test("extension activates", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext && ext.isActive, "extension should be active after suiteSetup");
  });

  test("all expected commands are registered", async () => {
    const all = await vscode.commands.getCommands(true);
    for (const cmd of EXPECTED_COMMANDS) {
      assert.ok(all.includes(cmd), `missing command: ${cmd}`);
    }
  });

  test("initializeProject creates .ai-memory/ with manifest and scan report; .env not tracked", async () => {
    const root = workspaceFolder();
    const memoryDir = path.join(root, ".ai-memory");

    await vscode.commands.executeCommand("devmemory.initializeProject");

    const manifestPath = path.join(memoryDir, "manifest.json");
    const scanReportPath = path.join(memoryDir, "scan-report.md");
    assert.ok(existsSync(manifestPath), `${manifestPath} should exist`);
    assert.ok(existsSync(scanReportPath), `${scanReportPath} should exist`);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      files?: Array<string | { path?: string }>;
    };
    const trackedPaths = (manifest.files ?? []).map((entry) =>
      typeof entry === "string" ? entry : entry.path ?? ""
    );
    const envHits = trackedPaths.filter((p) => p === ".env" || p.endsWith("/.env"));
    assert.deepStrictEqual(envHits, [], `manifest tracked .env: ${envHits.join(", ")}`);

    const scanReport = readFileSync(scanReportPath, "utf8");
    assert.ok(
      !/^[-*]\s+`?\.env`?\s*$/m.test(scanReport),
      "scan-report.md should not list .env as a tracked file"
    );

    const initMessage = capturedInfoMessages.find((m) => m.startsWith("Memory set up"));
    assert.ok(initMessage, "expected a 'Memory set up' info message");
    assert.match(
      initMessage!,
      /Teach DevMemory About This Project/,
      "post-init message should point at the Teach DevMemory next step"
    );
  });

  test("generateResumePrompt creates prompts/resume-prompt.md and points at End AI Session", async () => {
    const root = workspaceFolder();
    await vscode.commands.executeCommand("devmemory.generateResumePrompt");
    const promptPath = path.join(root, ".ai-memory", "prompts", "resume-prompt.md");
    assert.ok(existsSync(promptPath), `${promptPath} should exist`);

    const resumeMessage = capturedInfoMessages.find((m) => m.startsWith("Resume prompt copied"));
    assert.ok(resumeMessage, "expected a 'Resume prompt copied' info message");
    assert.match(
      resumeMessage!,
      /End AI Session/,
      "post-resume message should point at the End AI Session next step"
    );
  });
});
