import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, resolveMemoryDir } from "./config";

export interface TelemetryEvent {
  ts: string;
  name: string;
  props: Record<string, string | number | boolean>;
}

export interface RecordEventOptions {
  enabled: boolean;
  rootDir: string;
  now?: Date;
}

const TELEMETRY_DIR_NAME = "telemetry";

const ALLOWED_PROP_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

const STRING_VALUE_MAX = 64;

export class TelemetryDisabledError extends Error {
  constructor() {
    super("telemetry is disabled");
    this.name = "TelemetryDisabledError";
  }
}

export async function recordEvent(
  name: string,
  props: Record<string, unknown>,
  options: RecordEventOptions
): Promise<void> {
  if (!options.enabled) {
    return;
  }
  const event = buildEvent(name, props, options.now ?? new Date());
  const filePath = await resolveTelemetryFilePath(options.rootDir, event.ts);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

export async function readTelemetry(rootDir: string): Promise<TelemetryEvent[]> {
  const dir = await resolveTelemetryDir(rootDir);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }
    throw error;
  }

  const events: TelemetryEvent[] = [];
  for (const entry of entries.sort()) {
    if (!entry.startsWith("events-") || !entry.endsWith(".jsonl")) {
      continue;
    }
    const raw = await fs.readFile(path.join(dir, entry), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line) as TelemetryEvent;
        if (parsed && typeof parsed.name === "string") {
          events.push(parsed);
        }
      } catch {
        // skip malformed lines silently
      }
    }
  }
  return events;
}

export async function clearTelemetry(rootDir: string): Promise<{ removed: number }> {
  const dir = await resolveTelemetryDir(rootDir);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if (isMissing(error)) {
      return { removed: 0 };
    }
    throw error;
  }

  let removed = 0;
  for (const entry of entries) {
    if (entry.startsWith("events-") && entry.endsWith(".jsonl")) {
      await fs.unlink(path.join(dir, entry));
      removed += 1;
    }
  }
  return { removed };
}

export async function exportTelemetryAsCsv(rootDir: string): Promise<string> {
  const events = await readTelemetry(rootDir);
  if (events.length === 0) {
    return "ts,name\n";
  }

  const propKeys = new Set<string>();
  for (const event of events) {
    for (const key of Object.keys(event.props ?? {})) {
      propKeys.add(key);
    }
  }
  const sortedKeys = Array.from(propKeys).sort();

  const headerRow = ["ts", "name", ...sortedKeys].map(csvEscape).join(",");
  const rows = events.map((event) => {
    const baseValues = [event.ts, event.name];
    const propValues = sortedKeys.map((key) => {
      const value = event.props?.[key];
      if (value === undefined || value === null) {
        return "";
      }
      return String(value);
    });
    return [...baseValues, ...propValues].map(csvEscape).join(",");
  });
  return [headerRow, ...rows, ""].join("\n");
}

export async function resolveTelemetryDir(rootDir: string): Promise<string> {
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  return path.join(memoryDir, TELEMETRY_DIR_NAME);
}

async function resolveTelemetryFilePath(rootDir: string, ts: string): Promise<string> {
  const dir = await resolveTelemetryDir(rootDir);
  const day = ts.slice(0, 10).replace(/-/g, "");
  return path.join(dir, `events-${day}.jsonl`);
}

function buildEvent(
  name: string,
  rawProps: Record<string, unknown>,
  now: Date
): TelemetryEvent {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("telemetry event name must be a non-empty string");
  }
  const cleanedName = name.trim().slice(0, 64);

  const props: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(rawProps ?? {})) {
    const key = rawKey.trim().toLowerCase();
    if (!ALLOWED_PROP_KEY_PATTERN.test(key)) {
      continue;
    }
    if (rawValue === undefined || rawValue === null) {
      continue;
    }
    if (typeof rawValue === "string") {
      props[key] = redactString(rawValue);
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      props[key] = rawValue;
    } else if (typeof rawValue === "boolean") {
      props[key] = rawValue;
    }
  }
  return { ts: now.toISOString(), name: cleanedName, props };
}

function redactString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (looksLikePath(trimmed)) {
    return "<redacted-path>";
  }
  if (looksLikeUrl(trimmed)) {
    return "<redacted-url>";
  }
  if (looksLikeEmail(trimmed)) {
    return "<redacted-email>";
  }
  if (looksLikeSecret(trimmed)) {
    return "<redacted-secret>";
  }
  return trimmed.slice(0, STRING_VALUE_MAX);
}

function looksLikePath(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("~/") || value.includes("\\")) {
    return true;
  }
  if (/^[A-Z]:[\\/]/i.test(value)) {
    return true;
  }
  return false;
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikeSecret(value: string): boolean {
  if (value.length < 24) {
    return false;
  }
  return /^[A-Za-z0-9_\-+/=]+$/.test(value);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}
