#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PKG_PATH = resolve("package.json");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

run("npm", ["run", "vscode:prepublish"]);

const original = readFileSync(PKG_PATH, "utf8");
const parsed = JSON.parse(original);

const sanitized = { ...parsed };
delete sanitized.devDependencies;
delete sanitized.scripts;

writeFileSync(PKG_PATH, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");

let exitCode = 0;
try {
  const result = spawnSync("npx", ["vsce", "package", "--no-dependencies"], {
    stdio: "inherit",
    shell: false
  });
  if (result.error) {
    throw result.error;
  }
  exitCode = typeof result.status === "number" ? result.status : 1;
} finally {
  writeFileSync(PKG_PATH, original, "utf8");
}

process.exit(exitCode);
