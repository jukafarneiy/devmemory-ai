import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  const cachePath = path.resolve(extensionDevelopmentPath, ".vscode-test");

  const workspacePath = await mkdtemp(path.join(tmpdir(), "devmemory-vscode-test-"));
  await writeFile(path.join(workspacePath, "README.md"), "# Test Workspace\n", "utf8");
  await writeFile(
    path.join(workspacePath, "package.json"),
    `${JSON.stringify({ name: "devmemory-test-fixture", version: "0.0.1", private: true }, null, 2)}\n`,
    "utf8"
  );
  await mkdir(path.join(workspacePath, "src"), { recursive: true });
  await writeFile(
    path.join(workspacePath, "src", "index.ts"),
    'export const hello = "world";\n',
    "utf8"
  );
  await writeFile(
    path.join(workspacePath, ".env"),
    "FAKE_SECRET=should-not-be-tracked\n",
    "utf8"
  );

  const workspaceUri = pathToFileURL(workspacePath).toString();

  // When this script is launched from the VS Code integrated terminal,
  // ELECTRON_RUN_AS_NODE=1 leaks into the child Electron process spawned by
  // @vscode/test-electron and makes it run as Node, which rejects VS Code
  // CLI flags like --folder-uri. Strip the var here and restore it after.
  const originalElectronRunAsNode = process.env.ELECTRON_RUN_AS_NODE;
  delete process.env.ELECTRON_RUN_AS_NODE;

  let exitCode = 0;
  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      cachePath,
      launchArgs: [`--folder-uri=${workspaceUri}`]
    });
  } catch (err) {
    console.error("Failed to run extension smoke tests:", err);
    exitCode = 1;
  } finally {
    if (originalElectronRunAsNode === undefined) {
      delete process.env.ELECTRON_RUN_AS_NODE;
    } else {
      process.env.ELECTRON_RUN_AS_NODE = originalElectronRunAsNode;
    }
    await rm(workspacePath, { recursive: true, force: true });
  }

  process.exit(exitCode);
}

void main();
