import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_CONTEXT_MANAGED_END,
  AI_CONTEXT_MANAGED_START,
  AI_CONTEXT_TARGETS,
  composeAIContextBlock,
  exportAIContextFiles,
  inspectAIContextMemory,
  spliceManagedBlock
} from "./aiContextExport";
import { applyBootstrapMemory, initializeMemory } from "./memory";
import { DEFAULT_MEMORY_DIR } from "./defaults";

const REAL_BOOTSTRAP = [
  "## PROJECT_SUMMARY",
  "Real summary, no placeholders here.",
  "",
  "## ARCHITECTURE",
  "- Main module: app.py",
  "",
  "## CURRENT_STATE",
  "- Working: pricing endpoint live in staging",
  "",
  "## NEXT_ACTIONS",
  "- Add /pricing tests",
  ""
].join("\n");

async function makeWorkspace(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "devmemory-aictx-"));
  await fs.writeFile(path.join(tempDir, "app.py"), "print('hi')\n", "utf8");
  await fs.writeFile(path.join(tempDir, "requirements.txt"), "flask==3.0\n", "utf8");
  return tempDir;
}

describe("composeAIContextBlock", () => {
  it("wraps the sections in start/end markers, with a generated timestamp", () => {
    const block = composeAIContextBlock(
      [
        { title: "Project Summary", body: "Pricing service in Flask." },
        { title: "Architecture", body: "- routes in app.py" },
        { title: "Current State", body: "- Working: /pricing" },
        { title: "Next Actions", body: "- Add tests" }
      ],
      new Date("2026-04-28T12:00:00.000Z")
    );

    expect(block.startsWith(AI_CONTEXT_MANAGED_START)).toBe(true);
    expect(block.endsWith(AI_CONTEXT_MANAGED_END)).toBe(true);
    expect(block).toContain("# Project Context (managed by DevMemory AI)");
    expect(block).toContain("## Project Summary");
    expect(block).toContain("Pricing service in Flask.");
    expect(block).toContain("## Next Actions");
    expect(block).toContain("- Add tests");
    expect(block).toContain("<!-- generated: 2026-04-28T12:00:00.000Z -->");
  });

  it("renders an empty section body with a clear placeholder", () => {
    const block = composeAIContextBlock(
      [
        { title: "Project Summary", body: "" },
        { title: "Architecture", body: "x" },
        { title: "Current State", body: "x" },
        { title: "Next Actions", body: "x" }
      ],
      new Date("2026-04-28T12:00:00.000Z")
    );
    expect(block).toMatch(/## Project Summary\n\n_No content yet._/);
  });
});

describe("spliceManagedBlock", () => {
  const block = "<!-- devmemory:managed:start -->\nNEW BLOCK\n<!-- devmemory:managed:end -->";

  it("creates new content when there is no existing file", () => {
    const outcome = spliceManagedBlock(null, block);
    expect(outcome.action).toBe("created");
    expect(outcome.content).toBe(`${block}\n`);
  });

  it("creates new content when existing file is empty", () => {
    const outcome = spliceManagedBlock("", block);
    expect(outcome.action).toBe("created");
  });

  it("replaces only the managed block when one is already present", () => {
    const existing = [
      "# CLAUDE.md",
      "",
      "Hand-written rules: keep responses short.",
      "",
      "<!-- devmemory:managed:start -->",
      "OLD BLOCK CONTENT",
      "<!-- devmemory:managed:end -->",
      "",
      "More hand-written notes after the block.",
      ""
    ].join("\n");

    const outcome = spliceManagedBlock(existing, block);

    expect(outcome.action).toBe("updated");
    expect(outcome.content).toContain("Hand-written rules: keep responses short.");
    expect(outcome.content).toContain("More hand-written notes after the block.");
    expect(outcome.content).not.toContain("OLD BLOCK CONTENT");
    expect(outcome.content).toContain("NEW BLOCK");
  });

  it("appends the managed block when no markers are present, preserving prior content", () => {
    const existing = "# CLAUDE.md\n\nMy hand-written rules.\n";
    const outcome = spliceManagedBlock(existing, block);

    expect(outcome.action).toBe("appended");
    expect(outcome.content.startsWith(existing)).toBe(true);
    expect(outcome.content).toContain("NEW BLOCK");
    expect(outcome.content).toContain(AI_CONTEXT_MANAGED_START);
    expect(outcome.content).toContain(AI_CONTEXT_MANAGED_END);
  });

  it("appends with a separating newline when the existing file does not end in one", () => {
    const existing = "no trailing newline";
    const outcome = spliceManagedBlock(existing, block);
    expect(outcome.action).toBe("appended");
    expect(outcome.content.startsWith("no trailing newline\n\n")).toBe(true);
  });
});

describe("inspectAIContextMemory", () => {
  let tempDir: string;
  let memoryDir: string;

  beforeEach(async () => {
    tempDir = await makeWorkspace();
    memoryDir = path.join(tempDir, DEFAULT_MEMORY_DIR);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns 'missing' when memory has not been initialized", async () => {
    const status = await inspectAIContextMemory(tempDir);
    expect(status.kind).toBe("missing");
  });

  it("returns 'placeholders' when the templates have not been replaced yet", async () => {
    await initializeMemory(tempDir);
    const status = await inspectAIContextMemory(tempDir);
    expect(status.kind).toBe("placeholders");
    if (status.kind === "placeholders") {
      expect(status.files.length).toBeGreaterThan(0);
    }
  });

  it("returns 'ok' with extracted section bodies after bootstrap is applied", async () => {
    await initializeMemory(tempDir);
    await applyBootstrapMemory(tempDir, REAL_BOOTSTRAP);

    const status = await inspectAIContextMemory(tempDir);
    expect(status.kind).toBe("ok");
    if (status.kind === "ok") {
      const titles = status.sections.map((s) => s.title);
      expect(titles).toEqual(["Project Summary", "Architecture", "Current State", "Next Actions"]);
      const summary = status.sections.find((s) => s.title === "Project Summary");
      expect(summary?.body).toContain("Real summary, no placeholders here.");
      // The H1 heading and managed marker from the source file must not leak into the body.
      expect(summary?.body).not.toMatch(/^# /m);
      expect(summary?.body).not.toContain("devmemory:managed");
    }
  });
});

describe("exportAIContextFiles", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeWorkspace();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates each requested target file when none exist", async () => {
    await initializeMemory(tempDir);
    await applyBootstrapMemory(tempDir, REAL_BOOTSTRAP);

    const results = await exportAIContextFiles(tempDir, {
      targets: AI_CONTEXT_TARGETS,
      generatedAt: new Date("2026-04-28T12:00:00.000Z")
    });

    expect(results).toHaveLength(AI_CONTEXT_TARGETS.length);
    for (const result of results) {
      expect(result.action).toBe("created");
      const content = await fs.readFile(result.filePath, "utf8");
      expect(content).toContain(AI_CONTEXT_MANAGED_START);
      expect(content).toContain("Real summary, no placeholders here.");
      expect(content).toContain(AI_CONTEXT_MANAGED_END);
    }

    // .github/copilot-instructions.md must exist with its parent dir created.
    const copilotPath = path.join(tempDir, ".github", "copilot-instructions.md");
    expect((await fs.stat(copilotPath)).isFile()).toBe(true);
  });

  it("preserves hand-written content outside the markers when updating an existing CLAUDE.md", async () => {
    await initializeMemory(tempDir);
    await applyBootstrapMemory(tempDir, REAL_BOOTSTRAP);

    const claudePath = path.join(tempDir, "CLAUDE.md");
    const handwritten = [
      "# CLAUDE.md",
      "",
      "Custom rules from the team:",
      "- Always reply in Portuguese.",
      "- Never run destructive commands.",
      "",
      "<!-- devmemory:managed:start -->",
      "STALE CONTENT THAT MUST BE REPLACED",
      "<!-- devmemory:managed:end -->",
      "",
      "Footer notes added by the lead.",
      ""
    ].join("\n");
    await fs.writeFile(claudePath, handwritten, "utf8");

    const claudeTarget = AI_CONTEXT_TARGETS.find((t) => t.id === "claude")!;
    const [result] = await exportAIContextFiles(tempDir, { targets: [claudeTarget] });

    expect(result.action).toBe("updated");
    const updated = await fs.readFile(claudePath, "utf8");
    expect(updated).toContain("Custom rules from the team:");
    expect(updated).toContain("- Always reply in Portuguese.");
    expect(updated).toContain("Footer notes added by the lead.");
    expect(updated).not.toContain("STALE CONTENT THAT MUST BE REPLACED");
    expect(updated).toContain("Real summary, no placeholders here.");
  });

  it("appends the managed block when an existing target file has no markers, preserving prior content", async () => {
    await initializeMemory(tempDir);
    await applyBootstrapMemory(tempDir, REAL_BOOTSTRAP);

    const agentsPath = path.join(tempDir, "AGENTS.md");
    const handwritten = "# AGENTS\n\nOnly use the staging branch for auto-merges.\n";
    await fs.writeFile(agentsPath, handwritten, "utf8");

    const agentsTarget = AI_CONTEXT_TARGETS.find((t) => t.id === "agents")!;
    const [result] = await exportAIContextFiles(tempDir, { targets: [agentsTarget] });

    expect(result.action).toBe("appended");
    const updated = await fs.readFile(agentsPath, "utf8");
    expect(updated.startsWith(handwritten)).toBe(true);
    expect(updated).toContain(AI_CONTEXT_MANAGED_START);
    expect(updated).toContain(AI_CONTEXT_MANAGED_END);
    expect(updated).toContain("Real summary, no placeholders here.");
  });

  it("is idempotent: a second export updates rather than re-appends", async () => {
    await initializeMemory(tempDir);
    await applyBootstrapMemory(tempDir, REAL_BOOTSTRAP);

    const claudeTarget = AI_CONTEXT_TARGETS.find((t) => t.id === "claude")!;
    const first = await exportAIContextFiles(tempDir, { targets: [claudeTarget] });
    expect(first[0].action).toBe("created");

    const second = await exportAIContextFiles(tempDir, { targets: [claudeTarget] });
    expect(second[0].action).toBe("updated");

    const claudePath = path.join(tempDir, "CLAUDE.md");
    const content = await fs.readFile(claudePath, "utf8");
    const startMatches = content.match(/devmemory:managed:start/g) ?? [];
    const endMatches = content.match(/devmemory:managed:end/g) ?? [];
    expect(startMatches).toHaveLength(1);
    expect(endMatches).toHaveLength(1);
  });

  it("refuses to export when memory has not been initialized", async () => {
    await expect(
      exportAIContextFiles(tempDir, { targets: [AI_CONTEXT_TARGETS[0]] })
    ).rejects.toThrow(/incomplete|missing/i);

    // Confirm no target files were written.
    await expect(fs.access(path.join(tempDir, "CLAUDE.md"))).rejects.toThrow();
  });

  it("refuses to export when memory still contains placeholder content", async () => {
    await initializeMemory(tempDir);
    await expect(
      exportAIContextFiles(tempDir, { targets: [AI_CONTEXT_TARGETS[0]] })
    ).rejects.toThrow(/placeholder/i);
    await expect(fs.access(path.join(tempDir, "CLAUDE.md"))).rejects.toThrow();
  });

  it("returns an empty array and writes nothing when no targets are passed", async () => {
    await initializeMemory(tempDir);
    await applyBootstrapMemory(tempDir, REAL_BOOTSTRAP);

    const results = await exportAIContextFiles(tempDir, { targets: [] });
    expect(results).toEqual([]);
    await expect(fs.access(path.join(tempDir, "CLAUDE.md"))).rejects.toThrow();
  });

  it("refuses to write targets outside the workspace", async () => {
    await initializeMemory(tempDir);
    await applyBootstrapMemory(tempDir, REAL_BOOTSTRAP);

    const outsidePath = path.join(tempDir, "..", "outside-context.md");
    await expect(
      exportAIContextFiles(tempDir, {
        targets: [
          {
            id: "claude",
            filePath: "../outside-context.md",
            label: "outside"
          }
        ]
      })
    ).rejects.toThrow(/inside the workspace/i);

    await expect(fs.access(outsidePath)).rejects.toThrow();
  });
});
