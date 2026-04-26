import crypto from "node:crypto";
import type { Dirent, Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, resolveMemoryDir } from "./config";
import { matchesAnyGlob, toPosixPath } from "./glob";
import {
  buildExcludePatternsForProfiles,
  buildIncludePatternsForProfiles,
  detectTechnologyProfiles,
  type TechnologyProfile
} from "./technologyProfiles";
import type {
  DetectedTechnology,
  FileRecord,
  MemoryConfig,
  ScanResult,
  SkippedFile
} from "./types";

interface CandidateFile {
  absolutePath: string;
  relativePath: string;
}

export async function scanProject(rootDir: string, config?: MemoryConfig): Promise<ScanResult> {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedConfig = config ?? (await loadConfig(resolvedRoot));
  const skipped: SkippedFile[] = [];

  const candidates = await collectCandidatePaths(resolvedRoot, resolvedConfig.exclude, skipped);
  const candidateRelativePaths = candidates.map((candidate) => candidate.relativePath);

  const detectedProfiles = detectTechnologyProfiles(candidateRelativePaths);
  const finalIncludePatterns = mergeUnique(
    resolvedConfig.include,
    buildIncludePatternsForProfiles(detectedProfiles)
  );
  const finalExcludePatterns = mergeUnique(
    resolvedConfig.exclude,
    buildExcludePatternsForProfiles(detectedProfiles)
  );

  const files: FileRecord[] = [];

  for (const candidate of candidates) {
    if (matchesAnyGlob(candidate.relativePath, finalExcludePatterns)) {
      skipped.push({ path: candidate.relativePath, reason: "excluded" });
      continue;
    }

    if (finalIncludePatterns.length > 0 && !matchesAnyGlob(candidate.relativePath, finalIncludePatterns)) {
      skipped.push({ path: candidate.relativePath, reason: "not-included" });
      continue;
    }

    let stat: Stats;

    try {
      stat = await fs.stat(candidate.absolutePath);
    } catch (error) {
      skipped.push({ path: candidate.relativePath, reason: "read-error", detail: String(error) });
      continue;
    }

    if (stat.size > resolvedConfig.maxFileBytes) {
      skipped.push({ path: candidate.relativePath, reason: "too-large", detail: `${stat.size} bytes` });
      continue;
    }

    try {
      const content = await fs.readFile(candidate.absolutePath);
      await auditFileRead(resolvedRoot, resolvedConfig, candidate.relativePath, stat.size);

      files.push({
        path: candidate.relativePath,
        bytes: stat.size,
        mtimeMs: stat.mtimeMs,
        sha256: crypto.createHash("sha256").update(content).digest("hex")
      });
    } catch (error) {
      skipped.push({ path: candidate.relativePath, reason: "read-error", detail: String(error) });
    }
  }

  files.sort((left, right) => left.path.localeCompare(right.path));

  return {
    rootDir: resolvedRoot,
    scannedAt: new Date().toISOString(),
    config: resolvedConfig,
    files,
    skipped,
    detectedProfiles: detectedProfiles.map(toDetectedTechnology)
  };
}

async function collectCandidatePaths(
  rootDir: string,
  excludePatterns: string[],
  skipped: SkippedFile[]
): Promise<CandidateFile[]> {
  const candidates: CandidateFile[] = [];

  await walk(rootDir);

  return candidates;

  async function walk(currentDir: string): Promise<void> {
    let entries: Dirent[];

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toPosixPath(path.relative(rootDir, absolutePath));

      if (!relativePath) {
        continue;
      }

      if (entry.isDirectory()) {
        if (matchesAnyGlob(`${relativePath}/__dir__`, excludePatterns)) {
          skipped.push({ path: `${relativePath}/`, reason: "excluded" });
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      candidates.push({ absolutePath, relativePath });
    }
  }
}

function toDetectedTechnology(profile: TechnologyProfile): DetectedTechnology {
  return { id: profile.id, label: profile.label };
}

function mergeUnique<T>(first: T[], second: T[]): T[] {
  return Array.from(new Set([...first, ...second]));
}

async function auditFileRead(
  rootDir: string,
  config: MemoryConfig,
  relativePath: string,
  bytes: number
): Promise<void> {
  if (!config.auditFileReads) {
    return;
  }

  const memoryDir = resolveMemoryDir(rootDir, config);
  const auditDir = path.join(memoryDir, "audit");
  await fs.mkdir(auditDir, { recursive: true });

  const event = {
    timestamp: new Date().toISOString(),
    action: "read-for-hash",
    path: relativePath,
    bytes
  };

  await fs.appendFile(path.join(auditDir, "file-access-log.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}
