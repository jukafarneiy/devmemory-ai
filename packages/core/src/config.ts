import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG } from "./defaults";
import type { MemoryConfig } from "./types";

export function resolveMemoryDir(rootDir: string, config: Pick<MemoryConfig, "memoryDir">): string {
  return path.resolve(rootDir, config.memoryDir);
}

export async function loadConfig(rootDir: string): Promise<MemoryConfig> {
  const defaultConfigPath = path.join(rootDir, DEFAULT_CONFIG.memoryDir, "config.json");

  try {
    const raw = await fs.readFile(defaultConfigPath, "utf8");
    return normalizeConfig(JSON.parse(raw));
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

export async function writeConfig(rootDir: string, config: MemoryConfig): Promise<string> {
  const memoryDir = resolveMemoryDir(rootDir, config);
  await fs.mkdir(memoryDir, { recursive: true });

  const configPath = path.join(memoryDir, "config.json");
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return configPath;
}

export function normalizeConfig(input: Partial<MemoryConfig>): MemoryConfig {
  return {
    ...DEFAULT_CONFIG,
    ...input,
    version: input.version ?? DEFAULT_CONFIG.version,
    memoryDir: input.memoryDir || DEFAULT_CONFIG.memoryDir,
    mode: "local",
    include: input.include?.length ? input.include : DEFAULT_CONFIG.include,
    exclude: mergeUnique(DEFAULT_CONFIG.exclude, input.exclude ?? []),
    maxFileBytes: input.maxFileBytes ?? DEFAULT_CONFIG.maxFileBytes,
    auditFileReads: input.auditFileReads ?? DEFAULT_CONFIG.auditFileReads,
    llmProvider: input.llmProvider ?? DEFAULT_CONFIG.llmProvider
  };
}

function mergeUnique<T>(first: T[], second: T[]): T[] {
  return Array.from(new Set([...first, ...second]));
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
