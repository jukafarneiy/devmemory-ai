import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, resolveMemoryDir } from "@devmemory/core";

const ALLOWLIST_FILE = "paste-guard-allowlist.json";

interface AllowlistFile {
  version: 1;
  patterns: string[];
}

export async function loadAllowlist(rootDir: string): Promise<RegExp[]> {
  const filePath = await resolveAllowlistPath(rootDir);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  let parsed: AllowlistFile;
  try {
    parsed = JSON.parse(raw) as AllowlistFile;
  } catch {
    return [];
  }

  const patterns: RegExp[] = [];
  for (const entry of parsed.patterns ?? []) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    try {
      patterns.push(new RegExp(entry));
    } catch {
      // Skip invalid regex entries silently — they should not crash the extension.
    }
  }
  return patterns;
}

export async function appendAllowlist(rootDir: string, patternSource: string): Promise<void> {
  const filePath = await resolveAllowlistPath(rootDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  let current: AllowlistFile = { version: 1, patterns: [] };
  try {
    const raw = await fs.readFile(filePath, "utf8");
    current = JSON.parse(raw) as AllowlistFile;
    if (!Array.isArray(current.patterns)) {
      current.patterns = [];
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error;
    }
  }

  if (!current.patterns.includes(patternSource)) {
    current.patterns.push(patternSource);
  }
  await fs.writeFile(filePath, `${JSON.stringify({ version: 1, patterns: current.patterns }, null, 2)}\n`, "utf8");
}

export async function resolveAllowlistPath(rootDir: string): Promise<string> {
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  return path.join(memoryDir, ALLOWLIST_FILE);
}

export function isAllowed(text: string, allowlist: ReadonlyArray<RegExp>): boolean {
  for (const re of allowlist) {
    if (re.test(text)) {
      return true;
    }
  }
  return false;
}
