#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import yauzl from "yauzl";

const EXTENSION_PACKAGE_PATH = resolve("apps/vscode-extension/package.json");
const extensionPackage = JSON.parse(readFileSync(EXTENSION_PACKAGE_PATH, "utf8"));
const VSIX_PATH = resolve(
  `apps/vscode-extension/${extensionPackage.name}-${extensionPackage.version}.vsix`
);

const REQUIRED_FILES = [
  "extension/package.json",
  "extension/readme.md",
  "extension/changelog.md",
  "extension/LICENSE.md",
  "extension/PRIVACY.md",
  "extension/dist/extension.js",
  "extension/media/icon.png",
  "extension/media/devmemory.svg"
];

const FORBIDDEN_PATTERNS = [
  { label: "node_modules/", test: (p) => /(?:^|\/)node_modules\//.test(p) },
  { label: "src/",          test: (p) => /(?:^|\/)src\//.test(p) },
  { label: ".env files",    test: (p) => /(?:^|\/)\.env(\..+)?$/.test(p) },
  { label: ".ai-memory/",   test: (p) => /(?:^|\/)\.ai-memory\//.test(p) },
  { label: ".claude/",      test: (p) => /(?:^|\/)\.claude\//.test(p) },
  { label: ".map files",    test: (p) => /\.map$/.test(p) },
  { label: ".tsbuildinfo",  test: (p) => /\.tsbuildinfo$/.test(p) },
  { label: ".ts files",     test: (p) => /\.ts$/.test(p) }
];

const SIZE_LIMIT_BYTES = 500 * 1024;

const results = [];
const record = (group, label, ok, detail = "") => {
  results.push({ group, label, ok, detail });
};

if (!existsSync(VSIX_PATH)) {
  console.error(`✗ VSIX not found: ${VSIX_PATH}`);
  console.error('  Run "npm run package:vscode" first.');
  process.exit(1);
}

const sizeBytes = statSync(VSIX_PATH).size;
const sizeKb = (sizeBytes / 1024).toFixed(2);

let entries;
let pkgRaw;
try {
  ({ entries, pkgRaw } = await readVsix(VSIX_PATH));
} catch (err) {
  console.error(`✗ Failed to read VSIX: ${err.message}`);
  process.exit(1);
}

for (const required of REQUIRED_FILES) {
  record("required files", required, entries.includes(required));
}

for (const { label, test } of FORBIDDEN_PATTERNS) {
  const hits = entries.filter(test);
  const detail = hits.length > 0 ? `found: ${hits.slice(0, 3).join(", ")}` : "";
  record("forbidden patterns", `no ${label}`, hits.length === 0, detail);
}

let pkg;
try {
  if (pkgRaw === null) {
    throw new Error("extension/package.json was not found inside the VSIX");
  }
  pkg = JSON.parse(pkgRaw);
} catch (err) {
  record("package.json shape", "extract & parse extension/package.json", false, err.message);
  printReport();
  console.error("\nFAIL — could not read packaged package.json.");
  process.exit(1);
}

const hasCoreDep = Boolean(pkg.dependencies && pkg.dependencies["@devmemory/core"]);
record("package.json shape", "no dependencies['@devmemory/core']", !hasCoreDep);

const hasFileLink = JSON.stringify(pkg).includes("file:../../");
record("package.json shape", 'no "file:../../" workspace links', !hasFileLink);

record("package.json shape", 'has "icon"',       Boolean(pkg.icon));
record("package.json shape", 'has "license"',    Boolean(pkg.license));
record("package.json shape", 'has "repository"', Boolean(pkg.repository));
record(
  "package.json shape",
  'no "activationEvents"',
  !Object.prototype.hasOwnProperty.call(pkg, "activationEvents")
);

record(
  "size limit",
  `< ${(SIZE_LIMIT_BYTES / 1024).toFixed(0)} KB`,
  sizeBytes < SIZE_LIMIT_BYTES,
  `actual: ${sizeKb} KB`
);

printReport();

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\nFAIL — ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log("\nPASS — VSIX is ready to install.");

function printReport() {
  console.log("DevMemory AI VSIX verification");
  console.log(`  vsix:  ${VSIX_PATH}`);
  console.log(`  size:  ${sizeKb} KB`);
  console.log(`  files: ${entries.length}`);
  console.log("");
  let lastGroup = "";
  for (const r of results) {
    if (r.group !== lastGroup) {
      console.log(`${r.group}:`);
      lastGroup = r.group;
    }
    const mark = r.ok ? "✓" : "✗";
    const detail = r.detail ? `  (${r.detail})` : "";
    console.log(`  ${mark} ${r.label}${detail}`);
  }
}

function readVsix(vsixPath) {
  const buffer = readFileSync(vsixPath);
  return new Promise((resolveP, rejectP) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return rejectP(err);

      const entries = [];
      let pkgRaw = null;
      let aborted = false;

      const fail = (cause) => {
        if (aborted) return;
        aborted = true;
        try { zipfile.close(); } catch {}
        rejectP(cause);
      };

      zipfile.on("error", fail);
      zipfile.on("end", () => {
        if (aborted) return;
        resolveP({ entries, pkgRaw });
      });

      zipfile.on("entry", (entry) => {
        if (aborted) return;
        const isDirectory = /\/$/.test(entry.fileName);
        if (!isDirectory) {
          entries.push(entry.fileName);
        }

        if (entry.fileName !== "extension/package.json") {
          zipfile.readEntry();
          return;
        }

        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) return fail(streamErr);
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", fail);
          stream.on("end", () => {
            pkgRaw = Buffer.concat(chunks).toString("utf8");
            zipfile.readEntry();
          });
        });
      });

      zipfile.readEntry();
    });
  });
}
