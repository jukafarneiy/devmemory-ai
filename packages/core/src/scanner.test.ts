import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./defaults";
import { scanProject } from "./scanner";

describe("scanProject (integration)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "devmemory-scan-"));

    await fs.writeFile(path.join(tempDir, "app.py"), "print('hello')\n", "utf8");
    await fs.writeFile(path.join(tempDir, "requirements.txt"), "flask==3.0\n", "utf8");
    await fs.mkdir(path.join(tempDir, "templates"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "templates", "index.html"), "<h1>hi</h1>\n", "utf8");

    await fs.writeFile(path.join(tempDir, ".env"), "SECRET=topsecret\n", "utf8");

    await fs.mkdir(path.join(tempDir, ".venv", "lib"), { recursive: true });
    await fs.writeFile(path.join(tempDir, ".venv", "lib", "secret.py"), "TOKEN='x'\n", "utf8");

    await fs.mkdir(path.join(tempDir, "uploads"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "uploads", "image.png"), "binary-bytes", "utf8");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("detects Python and includes app code while excluding sensitive paths", async () => {
    const result = await scanProject(tempDir, { ...DEFAULT_CONFIG });

    const trackedPaths = result.files.map((file) => file.path);
    expect(trackedPaths).toContain("app.py");
    expect(trackedPaths).toContain("requirements.txt");
    expect(trackedPaths).toContain("templates/index.html");

    expect(trackedPaths).not.toContain(".env");
    expect(trackedPaths).not.toContain(".venv/lib/secret.py");
    expect(trackedPaths).not.toContain("uploads/image.png");

    const detectedIds = result.detectedProfiles.map((profile) => profile.id);
    expect(detectedIds).toContain("python");
  });

  it("never reads excluded files (audit log proves it)", async () => {
    await scanProject(tempDir, { ...DEFAULT_CONFIG });

    const auditPath = path.join(tempDir, DEFAULT_CONFIG.memoryDir, "audit", "file-access-log.jsonl");
    const audit = await fs.readFile(auditPath, "utf8");

    expect(audit).toContain('"path":"app.py"');
    expect(audit).toContain('"path":"requirements.txt"');
    expect(audit).toContain('"path":"templates/index.html"');

    expect(audit).not.toContain('"path":".env"');
    expect(audit).not.toContain(".venv/lib/secret.py");
    expect(audit).not.toContain("uploads/image.png");
  });
});
