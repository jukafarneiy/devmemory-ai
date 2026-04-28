export { DEFAULT_CONFIG, DEFAULT_EXCLUDE_PATTERNS, DEFAULT_INCLUDE_PATTERNS, DEFAULT_MEMORY_DIR } from "./defaults";
export { loadConfig, normalizeConfig, resolveMemoryDir, writeConfig } from "./config";
export {
  AI_CONTEXT_MANAGED_END,
  AI_CONTEXT_MANAGED_START,
  AI_CONTEXT_TARGETS,
  composeAIContextBlock,
  exportAIContextFiles,
  inspectAIContextMemory,
  spliceManagedBlock
} from "./aiContextExport";
export type {
  AIContextMemoryStatus,
  AIContextTarget,
  AIContextWriteResult,
  ExportAIContextOptions,
  SectionSnapshot,
  SpliceOutcome
} from "./aiContextExport";
export { matchesAnyGlob, matchesGlob, toPosixPath } from "./glob";
export {
  addSessionSummary,
  applyBootstrapMemory,
  applySessionUpdate,
  generateBootstrapPrompt,
  generateResumePrompt,
  generateSessionEndPrompt,
  initializeMemory,
  parseSessionUpdatePreview,
  quarantineFlaggedSessions,
  rescanMemory,
  runMemoryHealthCheck
} from "./memory";
export type {
  ApplySessionUpdateOptions,
  SessionUpdatePreview,
  SessionUpdatePreviewSection
} from "./memory";
export { scanProject } from "./scanner";
export {
  LEGACY_PLACEHOLDER_MARKERS,
  MANAGED_MARKER,
  bootstrapPromptTemplate,
  extractTextPrompt,
  healthCheckTemplate,
  isManagedOrLegacyPlaceholder,
  scanReportTemplate,
  sessionEndPromptTemplate
} from "./templates";
export {
  DEFAULT_TECHNOLOGY_PROFILES,
  buildExcludePatternsForProfiles,
  buildIncludePatternsForProfiles,
  detectTechnologyProfiles
} from "./technologyProfiles";
export type { TechnologyProfile } from "./technologyProfiles";
export type {
  DetectedTechnology,
  FileRecord,
  HealthCheckEntry,
  InitializeMemoryResult,
  Manifest,
  MemoryConfig,
  MemoryHealthCheckResult,
  ResumePromptResult,
  ScanResult,
  SessionSummaryInput,
  SessionSummaryResult,
  SkippedFile,
  SkippedReason,
  SkippedReasonCounts
} from "./types";
