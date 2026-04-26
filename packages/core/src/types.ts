export type MemoryMode = "local";

export type LlmProvider = "manual" | "openai" | "anthropic" | "custom";

export interface MemoryConfig {
  version: number;
  memoryDir: string;
  mode: MemoryMode;
  include: string[];
  exclude: string[];
  maxFileBytes: number;
  auditFileReads: boolean;
  llmProvider: LlmProvider;
}

export interface FileRecord {
  path: string;
  bytes: number;
  mtimeMs: number;
  sha256: string;
}

export interface SkippedFile {
  path: string;
  reason: "excluded" | "not-included" | "too-large" | "read-error";
  detail?: string;
}

export interface DetectedTechnology {
  id: string;
  label: string;
}

export interface ScanResult {
  rootDir: string;
  scannedAt: string;
  config: MemoryConfig;
  files: FileRecord[];
  skipped: SkippedFile[];
  detectedProfiles: DetectedTechnology[];
}

export type SkippedReason = SkippedFile["reason"];

export type SkippedReasonCounts = Record<SkippedReason, number>;

export interface Manifest {
  version: number;
  generatedAt: string;
  files: FileRecord[];
  skippedCount: number;
  detectedProfiles: DetectedTechnology[];
}

export interface InitializeMemoryResult {
  memoryDir: string;
  manifestPath: string;
  filesWritten: string[];
  scan: ScanResult;
}

export interface ResumePromptResult {
  prompt: string;
  promptPath: string;
}

export interface SessionSummaryInput {
  title?: string;
  summary: string;
  changedFiles?: string[];
  decisions?: string[];
  nextActions?: string[];
}

export interface SessionSummaryResult {
  sessionPath: string;
}

export interface HealthCheckEntry {
  id: string;
  label: string;
  status: "pass" | "warn";
  detail: string;
}

export interface MemoryHealthCheckResult {
  generatedAt: string;
  status: "healthy" | "needs-review";
  warnings: string[];
  checks: HealthCheckEntry[];
}
