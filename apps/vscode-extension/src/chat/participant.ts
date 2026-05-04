import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import {
  generateResumePrompt,
  loadConfig,
  resolveMemoryDir,
  validateAiResponse
} from "@devmemory/core";

const PARTICIPANT_ID = "devmemory.assistant";

export function registerChatParticipant(context: vscode.ExtensionContext): vscode.Disposable | undefined {
  if (!isChatApiAvailable()) {
    return undefined;
  }

  const enabled = vscode.workspace
    .getConfiguration("devmemory")
    .get<boolean>("registerChatParticipant", true);
  if (!enabled) {
    return undefined;
  }

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = new vscode.ThemeIcon("book");
  context.subscriptions.push(participant);
  return participant;
}

function isChatApiAvailable(): boolean {
  return typeof (vscode as { chat?: unknown }).chat !== "undefined" &&
    typeof (vscode.chat as { createChatParticipant?: unknown }).createChatParticipant === "function";
}

const handler: vscode.ChatRequestHandler = async (request, _context, stream, token) => {
  const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!rootDir) {
    stream.markdown(
      "**DevMemory needs a workspace folder.** Open a project first, then try again.\n"
    );
    return {};
  }

  if (token.isCancellationRequested) return {};

  switch (request.command) {
    case "resume":
      await handleResume(rootDir, stream);
      return {};
    case "decisions":
      await handleSection(rootDir, stream, "decisions/decisions.md", "Decisions");
      return {};
    case "architecture":
      await handleSection(rootDir, stream, "architecture.md", "Architecture");
      return {};
    case "save-session":
      await handleSaveSession(rootDir, stream, request.prompt);
      return {};
    default:
      await handleDefault(rootDir, stream, request.prompt);
      return {};
  }
};

async function handleResume(rootDir: string, stream: vscode.ChatResponseStream): Promise<void> {
  try {
    const result = await generateResumePrompt(rootDir);
    stream.markdown("**DevMemory resume prompt** — local memory only, no network calls.\n\n");
    stream.markdown(stripCodeFence(result.prompt));
    stream.button({
      command: "devmemory.generateSessionEndPrompt",
      title: "Wrap up this session"
    });
  } catch (error) {
    stream.markdown(`Could not build resume prompt: ${formatError(error)}`);
  }
}

async function handleSection(
  rootDir: string,
  stream: vscode.ChatResponseStream,
  relativePath: string,
  title: string
): Promise<void> {
  try {
    const config = await loadConfig(rootDir);
    const memoryDir = resolveMemoryDir(rootDir, config);
    const filePath = path.join(memoryDir, relativePath);
    const raw = await fs.readFile(filePath, "utf8");
    stream.markdown(`### ${title}\n\n`);
    stream.markdown(stripManagedHeader(raw));
    stream.button({
      command: "vscode.open",
      title: `Open .ai-memory/${relativePath}`,
      arguments: [vscode.Uri.file(filePath)]
    });
  } catch (error) {
    if (isMissing(error)) {
      stream.markdown(
        `\`.ai-memory/${relativePath}\` does not exist yet. Run **DevMemory: Scan This Project** and **Teach The AI About This Project** first.\n`
      );
      stream.button({
        command: "devmemory.initializeProject",
        title: "Scan this project"
      });
    } else {
      stream.markdown(`Could not read \`.ai-memory/${relativePath}\`: ${formatError(error)}`);
    }
  }
}

async function handleSaveSession(
  rootDir: string,
  stream: vscode.ChatResponseStream,
  prompt: string
): Promise<void> {
  if (!prompt.trim()) {
    stream.markdown(
      "Provide the structured session-end response after `@devmemory /save-session`. Or run **DevMemory: Wrap Up Session** to get a fresh prompt template.\n"
    );
    stream.button({
      command: "devmemory.generateSessionEndPrompt",
      title: "Build a wrap-up prompt"
    });
    return;
  }

  const findings = validateAiResponse(prompt);
  if (findings.length > 0) {
    stream.markdown("⚠ DevMemory **found risks** in the response — review before saving:\n\n");
    for (const f of findings.slice(0, 5)) {
      stream.markdown(`- [${f.severity}] ${f.message}\n`);
    }
    stream.markdown("\nIf the warnings are intentional, copy the response and click Save.\n\n");
  } else {
    stream.markdown("DevMemory found no destructive shapes in the response. ");
  }

  await vscode.env.clipboard.writeText(prompt);
  stream.markdown("The full response has been **copied to your clipboard**. Click below to save it.\n");
  stream.button({
    command: "devmemory.applySessionUpdate",
    title: "Save what the AI did"
  });
}

async function handleDefault(rootDir: string, stream: vscode.ChatResponseStream, prompt: string): Promise<void> {
  stream.markdown(
    [
      "**`@devmemory`** is the local memory layer for this project. I never call a model — I only feed your AI structured memory.\n",
      "Available subcommands:\n",
      "- `/resume` — inject a fresh resume prompt with current memory.",
      "- `/decisions` — show the decisions log.",
      "- `/architecture` — show the architecture summary.",
      "- `/save-session <pasted-AI-response>` — validate and save a session.\n"
    ].join("\n")
  );

  if (prompt.trim()) {
    stream.markdown("\n_Tip: I don't answer free-form prompts. Try one of the subcommands above._\n");
  }

  // Also offer the most useful action depending on memory state.
  const memoryDir = resolveMemoryDir(rootDir, await loadConfig(rootDir));
  try {
    await fs.access(path.join(memoryDir, "manifest.json"));
    stream.button({ command: "devmemory.generateResumePrompt", title: "Resume an AI session" });
  } catch {
    stream.button({ command: "devmemory.initializeProject", title: "Scan this project" });
  }
}

function stripCodeFence(value: string): string {
  const match = value.match(/```text\r?\n([\s\S]*?)\r?\n```/);
  return match ? match[1].trim() : value.trim();
}

function stripManagedHeader(value: string): string {
  return value.replace(/<!--\s*devmemory:managed[\s\S]*?-->/g, "").replace(/^\s*\n/, "").trim();
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT"
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
