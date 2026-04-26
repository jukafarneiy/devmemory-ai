#!/usr/bin/env node
import process from "node:process";
import { addSessionSummary, generateResumePrompt, initializeMemory, scanProject } from "./index";

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  const rootDir = process.cwd();

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "init") {
    const result = await initializeMemory(rootDir);
    console.log(`DevMemory AI initialized: ${result.memoryDir}`);
    console.log(`Tracked files: ${result.scan.files.length}`);
    return;
  }

  if (command === "scan") {
    const result = await scanProject(rootDir);
    console.log(JSON.stringify({ files: result.files.length, skipped: result.skipped.length }, null, 2));
    return;
  }

  if (command === "prompt" && args[0] === "resume") {
    const result = await generateResumePrompt(rootDir);
    console.log(result.prompt);
    return;
  }

  if (command === "session" && args[0] === "add") {
    const summary = args.slice(1).join(" ").trim();
    const result = await addSessionSummary(rootDir, { summary });
    console.log(`Session saved: ${result.sessionPath}`);
    return;
  }

  throw new Error(`Unknown command: ${[command, ...args].join(" ")}`);
}

function printHelp(): void {
  console.log(`DevMemory AI

Commands:
  devmemory init
  devmemory scan
  devmemory prompt resume
  devmemory session add "summary text"
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
