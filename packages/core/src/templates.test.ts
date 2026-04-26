import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./defaults";
import {
  MANAGED_MARKER,
  bootstrapPromptTemplate,
  commandsTemplate,
  createManifest,
  extractTextPrompt,
  healthCheckTemplate,
  projectSummaryTemplate,
  resumePromptTemplate,
  scanReportTemplate,
  sessionEndPromptTemplate
} from "./templates";
import type { ScanResult } from "./types";

function buildScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    rootDir: "/tmp/example",
    scannedAt: "2026-04-25T12:00:00.000Z",
    config: DEFAULT_CONFIG,
    files: [
      { path: "app.py", bytes: 120, mtimeMs: 0, sha256: "a" },
      { path: "requirements.txt", bytes: 30, mtimeMs: 0, sha256: "b" },
      { path: "templates/index.html", bytes: 200, mtimeMs: 0, sha256: "c" }
    ],
    skipped: [
      { path: ".env", reason: "excluded" },
      { path: ".venv/lib/secret.py", reason: "excluded" },
      { path: "uploads/image.png", reason: "excluded" },
      { path: "notes.txt", reason: "not-included" },
      { path: "huge.bin", reason: "too-large", detail: "9000000 bytes" }
    ],
    detectedProfiles: [{ id: "python", label: "Python" }],
    ...overrides
  };
}

describe("scanReportTemplate", () => {
  it("includes detected technologies, counts and per-reason breakdown", () => {
    const report = scanReportTemplate(buildScanResult());

    expect(report).toContain("# Scan Report");
    expect(report).toContain("Detected technologies: Python");
    expect(report).toContain("Tracked files: 3");
    expect(report).toContain("Skipped files: 5");
    expect(report).toContain("- excluded: 3");
    expect(report).toContain("- not-included: 1");
    expect(report).toContain("- too-large: 1");
    expect(report).toContain("- read-error: 0");
  });

  it("lists tracked and skipped paths but never file content", () => {
    const report = scanReportTemplate(buildScanResult());

    expect(report).toContain("- app.py (120 bytes)");
    expect(report).toContain("- templates/index.html (200 bytes)");
    expect(report).toContain("- .env [excluded]");
    expect(report).toContain("- huge.bin [too-large] — 9000000 bytes");
    expect(report).toContain(
      "No file content is included in this report. It only lists local paths and scan decisions."
    );
    expect(report).not.toContain("sha256");
  });

  it("falls back to a clear note when no technology is detected", () => {
    const report = scanReportTemplate(buildScanResult({ detectedProfiles: [] }));
    expect(report).toContain("Detected technologies: none recognized");
  });

  it("caps the listed file sections at 100 entries", () => {
    const manyFiles = Array.from({ length: 150 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      bytes: 1,
      mtimeMs: 0,
      sha256: String(index)
    }));
    const report = scanReportTemplate(buildScanResult({ files: manyFiles }));

    expect(report).toContain("src/file-0.ts");
    expect(report).toContain("src/file-99.ts");
    expect(report).not.toContain("src/file-100.ts");
  });
});

describe("createManifest", () => {
  it("includes detected profiles in the manifest", () => {
    const manifest = createManifest(buildScanResult());
    expect(manifest.detectedProfiles).toEqual([{ id: "python", label: "Python" }]);
    expect(manifest.skippedCount).toBe(5);
    expect(manifest.files).toHaveLength(3);
  });
});

describe("commandsTemplate", () => {
  it("emits Python commands when Python is detected", () => {
    const output = commandsTemplate(buildScanResult());
    expect(output).toContain("pip install -r requirements.txt");
    expect(output).toContain("pytest");
    expect(output).not.toContain("npm install");
    expect(output.startsWith(MANAGED_MARKER)).toBe(true);
  });

  it("emits multiple stack blocks for polyglot repos", () => {
    const output = commandsTemplate(
      buildScanResult({
        detectedProfiles: [
          { id: "node", label: "Node.js" },
          { id: "go", label: "Go" }
        ]
      })
    );
    expect(output).toContain("npm install");
    expect(output).toContain("go test ./...");
  });

  it("falls back to a generic placeholder when nothing is detected", () => {
    const output = commandsTemplate(buildScanResult({ detectedProfiles: [] }));
    expect(output).toContain("### Generic");
    expect(output).toContain("# install dependencies");
  });

  it("does not contain the legacy placeholder string", () => {
    const output = commandsTemplate(buildScanResult());
    expect(output).not.toContain("Record commands that future AI sessions should know.");
  });
});

describe("projectSummaryTemplate", () => {
  it("starts with the managed marker and avoids legacy placeholder strings", () => {
    const output = projectSummaryTemplate(buildScanResult());
    expect(output.startsWith(MANAGED_MARKER)).toBe(true);
    expect(output).not.toContain("Describe the product goal here");
    expect(output).not.toContain("Package manifest detected");
  });

  it("only lists files coming from scan.files", () => {
    const output = projectSummaryTemplate(buildScanResult());
    expect(output).toContain("- app.py");
    expect(output).toContain("- templates/index.html");
    expect(output).not.toContain(".venv");
    expect(output).not.toContain("uploads/image.png");
  });
});

describe("bootstrapPromptTemplate", () => {
  it("includes detected technologies and tracked file paths", () => {
    const output = bootstrapPromptTemplate(buildScanResult());
    expect(output).toContain("Detected technologies: Python.");
    expect(output).toContain("- app.py");
    expect(output).toContain("- requirements.txt");
    expect(output).toContain("- templates/index.html");
    expect(output).toContain("## PROJECT_SUMMARY");
    expect(output).toContain("## ARCHITECTURE");
    expect(output).toContain("## CURRENT_STATE");
    expect(output).toContain("## NEXT_ACTIONS");
  });

  it("does not include any file content", () => {
    const scan = buildScanResult({
      files: [
        { path: "secrets.py", bytes: 999, mtimeMs: 0, sha256: "deadbeef" },
        { path: "app.py", bytes: 120, mtimeMs: 0, sha256: "abc" }
      ]
    });
    const output = bootstrapPromptTemplate(scan);
    expect(output).not.toContain("deadbeef");
    expect(output).not.toContain("sha256");
    expect(output).toMatch(/Do not include any secrets/);
  });

  it("instructs the user to click Save Project Understanding (no Apply Bootstrap Memory)", () => {
    const output = bootstrapPromptTemplate(buildScanResult());
    expect(output).toContain("Save Project Understanding");
    expect(output).not.toContain("Apply Bootstrap Memory");
  });

  it("notes truncation when there are more than 200 tracked files", () => {
    const manyFiles = Array.from({ length: 250 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      bytes: 1,
      mtimeMs: 0,
      sha256: String(index)
    }));
    const output = bootstrapPromptTemplate(buildScanResult({ files: manyFiles }));
    expect(output).toContain("src/file-0.ts");
    expect(output).toContain("src/file-199.ts");
    expect(output).not.toContain("src/file-200.ts");
    expect(output).toContain("50 additional tracked files omitted");
  });
});

describe("healthCheckTemplate", () => {
  it("includes status, checks, warnings and recommendations", () => {
    const output = healthCheckTemplate({
      generatedAt: "2026-04-25T18:00:00.000Z",
      status: "needs-review",
      warnings: ["project-summary.md contains placeholder text \"Summarize what this project is\"."],
      checks: [
        { id: "memory-dir", label: ".ai-memory directory", status: "pass", detail: "Found." },
        {
          id: "placeholders",
          label: "Managed files free of placeholders",
          status: "warn",
          detail: "1 placeholder occurrence(s) found in managed files."
        }
      ]
    });

    expect(output).toContain("# Memory Health Check");
    expect(output).toContain("Status: needs-review");
    expect(output).toContain("## Checks");
    expect(output).toContain("- [PASS] .ai-memory directory");
    expect(output).toContain("- [WARN] Managed files free of placeholders");
    expect(output).toContain("## Warnings");
    expect(output).toContain("placeholder text");
    expect(output).toContain("## Recommendations");
    expect(output).toContain("Teach DevMemory About This Project");
  });

  it("returns a healthy recommendation when status is healthy", () => {
    const output = healthCheckTemplate({
      generatedAt: "2026-04-25T18:00:00.000Z",
      status: "healthy",
      warnings: [],
      checks: [
        { id: "memory-dir", label: ".ai-memory directory", status: "pass", detail: "Found." }
      ]
    });
    expect(output).toContain("Status: healthy");
    expect(output).toContain("Memory looks healthy");
  });
});

describe("sessionEndPromptTemplate", () => {
  it("requests every required section heading", () => {
    const output = sessionEndPromptTemplate();
    for (const heading of [
      "## SESSION_SUMMARY",
      "## CHANGES_MADE",
      "## FILES_TOUCHED",
      "## DECISIONS",
      "## BUGS_FIXED",
      "## COMMANDS_RUN",
      "## CURRENT_STATE",
      "## NEXT_ACTIONS"
    ]) {
      expect(output).toContain(heading);
    }
  });

  it("instructs the assistant to redact secrets and write None for empty sections", () => {
    const output = sessionEndPromptTemplate();
    expect(output).toMatch(/Do not include secrets/);
    expect(output).toMatch(/write \"None\"/);
  });

  it("instructs the user to click Save Session Summary (no Apply Session Update)", () => {
    const output = sessionEndPromptTemplate();
    expect(output).toContain("Save Session Summary");
    expect(output).not.toContain("Apply Session Update");
  });
});

describe("extractTextPrompt", () => {
  it("returns only the first text fenced block content", () => {
    const output = extractTextPrompt([
      "# Wrapper",
      "",
      "Before",
      "",
      "```text",
      "Line one",
      "Line two",
      "```",
      "",
      "After"
    ].join("\n"));

    expect(output).toBe(["Line one", "Line two"].join("\n"));
  });

  it("falls back to trimmed markdown when no text fence exists", () => {
    expect(extractTextPrompt("  plain prompt  ")).toBe("plain prompt");
  });
});

describe("resumePromptTemplate", () => {
  it("strips the managed marker and the leading H1 from each section", () => {
    const sectionContent = [
      MANAGED_MARKER,
      "",
      "# Project Summary",
      "",
      "Body text that should remain."
    ].join("\n");

    const output = resumePromptTemplate([{ title: "Project Summary", content: sectionContent }]);

    expect(output).not.toContain(MANAGED_MARKER);
    expect(output).toContain("## Project Summary");
    expect(output).toContain("Body text that should remain.");
    const projectHeadingMatches = output.match(/^# Project Summary$/gm) ?? [];
    expect(projectHeadingMatches).toHaveLength(0);
  });

  it("skips sections whose body becomes empty after marker/H1 stripping", () => {
    const onlyMarker = `${MANAGED_MARKER}\n\n# Empty\n`;
    const output = resumePromptTemplate([
      { title: "Empty", content: onlyMarker },
      { title: "Real", content: `${MANAGED_MARKER}\n\n# Real\n\nKept.` }
    ]);

    expect(output).not.toContain("## Empty");
    expect(output).toContain("## Real");
    expect(output).toContain("Kept.");
  });
});
