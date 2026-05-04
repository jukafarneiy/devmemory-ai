import * as assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "devmemory-ai.devmemory-ai-vscode";

function workspaceFolder(): string {
  const folders = vscode.workspace.workspaceFolders;
  assert.ok(folders && folders.length > 0, "expected a workspace folder to be open");
  return folders[0].uri.fsPath;
}

suite("DevMemory audit pack smoke", () => {
  let originalShowInfo: typeof vscode.window.showInformationMessage;

  suiteSetup(async () => {
    originalShowInfo = vscode.window.showInformationMessage;
    (vscode.window as any).showInformationMessage = async () => undefined;

    await vscode.workspace
      .getConfiguration("devmemory")
      .update("confirmBeforeScan", false, vscode.ConfigurationTarget.Workspace);

    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} not found`);
    if (!ext.isActive) {
      await ext.activate();
    }

    const root = workspaceFolder();
    if (!existsSync(path.join(root, ".ai-memory"))) {
      await vscode.commands.executeCommand("devmemory.initializeProject");
    }
  });

  suiteTeardown(() => {
    (vscode.window as any).showInformationMessage = originalShowInfo;
  });

  test("exportAuditPack produces log + key + verify.sh + report and verify.sh returns OK", async () => {
    const root = workspaceFolder();

    await vscode.commands.executeCommand("devmemory.exportAuditPack");

    const auditDir = path.join(root, ".ai-memory", ".audit");
    assert.ok(existsSync(auditDir), `audit dir should exist at ${auditDir}`);
    const exports = readdirSync(auditDir).filter((n) => n.startsWith("export-"));
    assert.ok(exports.length > 0, "expected at least one export-* directory");
    const exportRoot = path.join(auditDir, exports.sort().pop()!);

    for (const expected of ["log.jsonl", "public-key.pem", "verify.sh", "report.html"]) {
      assert.ok(existsSync(path.join(exportRoot, expected)), `missing ${expected}`);
    }

    const report = readFileSync(path.join(exportRoot, "report.html"), "utf8");
    assert.match(report, /DevMemory AI — Audit Pack/, "HTML report should contain the heading");
    assert.match(report, /BEGIN PUBLIC KEY/, "HTML report should embed the public key");

    // Run verify.sh in a subprocess against the exported log.
    const result = spawnSync("bash", ["verify.sh", "log.jsonl", "public-key.pem"], {
      cwd: exportRoot,
      encoding: "utf8"
    });
    if (result.status !== 0) {
      // If the export contains zero entries, the verifier may produce "OK: 0 entries verified" with status 0.
      assert.fail(`verify.sh exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
    }
    assert.match(result.stdout, /OK:\s*\d+\s+entries verified/, `verify.sh stdout: ${result.stdout}`);
  });
});
