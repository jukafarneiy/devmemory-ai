export type RiskSeverity = "warning" | "blocking";

export interface RiskFinding {
  severity: RiskSeverity;
  rule: string;
  message: string;
  match?: string;
  line?: number;
}

export interface ValidateAiResponseOptions {
  minLength?: number;
  patterns?: ReadonlyArray<DestructivePattern>;
  detectSimulation?: boolean;
}

export interface DestructivePattern {
  pattern: RegExp;
  label: string;
  severity?: RiskSeverity;
}

export const SIMULATION_PATTERN = /\b(?:simula[çc][aã]o|simulation|fake|fict[ií]cio|fictitious)\b/i;

export const NONE_LINE_PATTERN = /^none\.?$/i;

export const GENERIC_CURRENT_STATE_PHRASES: readonly RegExp[] = [
  /^no project changes were made(?: in this session)?\.?$/i,
  /^no work is currently in progress(?: from this session)?\.?$/i,
  /^known issues:\s*none\.?$/i,
  /^no known issues were identified(?: in this session)?\.?$/i
];

export const SESSION_DESTRUCTIVE_PATTERNS: ReadonlyArray<DestructivePattern> = [
  { pattern: /\brm\s+-rf\b/i, label: "rm -rf", severity: "blocking" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, label: "git reset --hard", severity: "warning" },
  { pattern: /\bdrop\s+database\b/i, label: "drop database", severity: "blocking" }
];

export const PASTE_DESTRUCTIVE_PATTERNS: ReadonlyArray<DestructivePattern> = [
  { pattern: /\brm\s+-(?:rf|fr|Rf|fR)\b/i, label: "rm -rf", severity: "blocking" },
  { pattern: /\brm\s+-r\s+--?force\b/i, label: "rm -r --force", severity: "blocking" },
  { pattern: /\bsudo\s+rm\b/i, label: "sudo rm", severity: "blocking" },
  { pattern: /\bfind\s+\/[^\n|]*\s+-delete\b/i, label: "find / -delete", severity: "blocking" },
  { pattern: /\bmkfs(?:\.[\w-]+)?\s+\/dev\b/i, label: "mkfs on device", severity: "blocking" },
  {
    pattern: /\bdd\s+(?=[^\n]*\bif=\/dev\/(?:zero|random|urandom)\b)(?=[^\n]*\bof=\/dev\b)[^\n]+/i,
    label: "dd to block device",
    severity: "blocking"
  },
  { pattern: />\s*\/dev\/(?:sd[a-z]|nvme\d+n\d+|hd[a-z])/i, label: "raw write to block device", severity: "blocking" },
  { pattern: /\bwipefs\b/i, label: "wipefs", severity: "blocking" },
  { pattern: /\bchmod\s+-R\s+0?777\s+\//, label: "chmod -R 777 /", severity: "blocking" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, label: "git reset --hard", severity: "warning" },
  { pattern: /\bgit\s+push\s+(?:-f|--force(?:-with-lease)?)\b/i, label: "git push --force", severity: "warning" },
  { pattern: /\bgit\s+clean\s+-[a-z]*f[a-z]*[dx]?\b/i, label: "git clean -fdx", severity: "warning" },
  { pattern: /\bgit\s+branch\s+-D\b/i, label: "git branch -D", severity: "warning" },
  { pattern: /\bdrop\s+(?:database|schema|table)\b/i, label: "DROP DATABASE/SCHEMA/TABLE", severity: "blocking" },
  { pattern: /\btruncate\s+table\b/i, label: "TRUNCATE TABLE", severity: "blocking" },
  { pattern: /\bdelete\s+from\s+\w+(?!\s+where)\s*(?:;|$)/im, label: "DELETE FROM <table> (no WHERE)", severity: "blocking" },
  { pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, label: "fork bomb", severity: "blocking" },
  { pattern: /\b(?:shutdown\s+-[hH]\b|poweroff\b|halt\b|reboot\b)/i, label: "shutdown/reboot", severity: "warning" },
  { pattern: /\bformat\s+[A-Z]:/i, label: "format C:", severity: "blocking" },
  { pattern: /\brmdir\s+\/s\s+\/q\s+[A-Z]:/i, label: "rmdir /s /q C:\\", severity: "blocking" },
  { pattern: /\bdel\s+\/[fsq](?:\s+\/[fsq])*\s+[A-Z]:\\?\*/i, label: "del /f /s /q C:\\*", severity: "blocking" },
  { pattern: /\bcurl\s+[^\n|]+\|\s*(?:sh|bash|zsh|fish)\b/i, label: "curl | sh (remote execution)", severity: "warning" },
  { pattern: /\beval\s+\$\(\s*curl\b/i, label: "eval $(curl …)", severity: "warning" }
];

export function detectSimulatedContent(text: string): RiskFinding | null {
  const match = SIMULATION_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  return {
    severity: "warning",
    rule: "simulation",
    message: `Text appears to contain simulated/fictitious content (matched "${match[0]}").`,
    match: match[0],
    line: lineOf(text, match.index)
  };
}

export function detectDestructiveCommands(
  text: string,
  patterns: ReadonlyArray<DestructivePattern> = PASTE_DESTRUCTIVE_PATTERNS
): RiskFinding[] {
  const findings: RiskFinding[] = [];
  const seen = new Set<string>();
  for (const entry of patterns) {
    const match = entry.pattern.exec(text);
    if (!match) {
      continue;
    }
    if (seen.has(entry.label)) {
      continue;
    }
    seen.add(entry.label);
    findings.push({
      severity: entry.severity ?? "blocking",
      rule: "destructive-command",
      message: `Detected destructive command: ${entry.label}.`,
      match: match[0],
      line: lineOf(text, match.index)
    });
  }
  return findings;
}

export function validateAiResponse(
  text: string,
  options: ValidateAiResponseOptions = {}
): RiskFinding[] {
  if (typeof text !== "string") {
    return [];
  }
  const minLength = options.minLength ?? 0;
  if (text.length < minLength) {
    return [];
  }

  const findings: RiskFinding[] = [];

  if (options.detectSimulation !== false) {
    const sim = detectSimulatedContent(text);
    if (sim) {
      findings.push(sim);
    }
  }

  const cmds = detectDestructiveCommands(text, options.patterns);
  for (const finding of cmds) {
    findings.push(finding);
  }

  return findings;
}

export function highestSeverity(findings: ReadonlyArray<RiskFinding>): RiskSeverity | null {
  if (findings.some((f) => f.severity === "blocking")) {
    return "blocking";
  }
  if (findings.length > 0) {
    return "warning";
  }
  return null;
}

function lineOf(text: string, index: number): number {
  if (index < 0 || index > text.length) {
    return 1;
  }
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}
