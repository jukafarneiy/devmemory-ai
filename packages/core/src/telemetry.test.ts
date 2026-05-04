import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearTelemetry,
  exportTelemetryAsCsv,
  readTelemetry,
  recordEvent,
  resolveTelemetryDir
} from "./telemetry";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "devmemory-tel-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("telemetry — opt-in semantics", () => {
  it("does NOT write any file when enabled is false", async () => {
    await recordEvent("command.invoked", { command: "x" }, { enabled: false, rootDir: tempDir });
    const events = await readTelemetry(tempDir);
    expect(events).toHaveLength(0);

    const dir = await resolveTelemetryDir(tempDir);
    let exists = true;
    try {
      await fs.access(dir);
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it("appends a JSONL event when enabled is true", async () => {
    const now = new Date("2026-05-03T12:00:00.000Z");
    await recordEvent(
      "command.invoked",
      { command: "set_up_memory", duration_ms: 12 },
      { enabled: true, rootDir: tempDir, now }
    );
    const events = await readTelemetry(tempDir);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("command.invoked");
    expect(events[0].props.command).toBe("set_up_memory");
    expect(events[0].props.duration_ms).toBe(12);
    expect(events[0].ts).toBe("2026-05-03T12:00:00.000Z");
  });

  it("rotates to a new file per UTC day", async () => {
    await recordEvent("a", {}, { enabled: true, rootDir: tempDir, now: new Date("2026-05-03T23:59:59Z") });
    await recordEvent("b", {}, { enabled: true, rootDir: tempDir, now: new Date("2026-05-04T00:00:01Z") });

    const dir = await resolveTelemetryDir(tempDir);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".jsonl")).sort();
    expect(files).toEqual(["events-20260503.jsonl", "events-20260504.jsonl"]);
  });
});

describe("telemetry — redaction", () => {
  const baseOpts = (): { enabled: true; rootDir: string; now: Date } => ({
    enabled: true,
    rootDir: tempDir,
    now: new Date("2026-05-03T12:00:00Z")
  });

  it("redacts absolute POSIX paths", async () => {
    await recordEvent("x", { source: "/Users/alice/secret/file.ts" }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.source).toBe("<redacted-path>");
  });

  it("redacts Windows paths", async () => {
    await recordEvent("x", { source: "C:\\Users\\Bob\\file.ts" }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.source).toBe("<redacted-path>");
  });

  it("redacts home-relative paths", async () => {
    await recordEvent("x", { source: "~/projects/foo" }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.source).toBe("<redacted-path>");
  });

  it("redacts URLs", async () => {
    await recordEvent("x", { url: "https://example.com/?q=1" }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.url).toBe("<redacted-url>");
  });

  it("redacts emails", async () => {
    await recordEvent("x", { email: "alice@example.com" }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.email).toBe("<redacted-email>");
  });

  it("redacts long opaque secret-like strings", async () => {
    const fake = "abc123ABC456_-+/abc123ABCdef456789";
    await recordEvent("x", { token: fake }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.token).toBe("<redacted-secret>");
  });

  it("preserves short non-sensitive strings", async () => {
    await recordEvent("x", { command: "set_up_memory" }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.command).toBe("set_up_memory");
  });

  it("rejects illegal prop keys silently", async () => {
    await recordEvent(
      "x",
      { "Invalid Key": "v", "ok_key": "v2" },
      baseOpts()
    );
    const events = await readTelemetry(tempDir);
    expect(events[0].props["Invalid Key"]).toBeUndefined();
    expect(events[0].props.ok_key).toBe("v2");
  });

  it("ignores undefined and null values", async () => {
    await recordEvent("x", { a: undefined, b: null, c: 1 }, baseOpts());
    const events = await readTelemetry(tempDir);
    expect(events[0].props.a).toBeUndefined();
    expect(events[0].props.b).toBeUndefined();
    expect(events[0].props.c).toBe(1);
  });
});

describe("telemetry — read / export / clear", () => {
  it("readTelemetry returns [] when nothing was recorded", async () => {
    const events = await readTelemetry(tempDir);
    expect(events).toEqual([]);
  });

  it("exportTelemetryAsCsv returns a header-only CSV when empty", async () => {
    const csv = await exportTelemetryAsCsv(tempDir);
    expect(csv).toBe("ts,name\n");
  });

  it("exportTelemetryAsCsv includes one row per event", async () => {
    await recordEvent("a.b", { x: 1, y: "hi" }, { enabled: true, rootDir: tempDir, now: new Date("2026-05-03Z") });
    await recordEvent("c.d", { z: true }, { enabled: true, rootDir: tempDir, now: new Date("2026-05-03Z") });
    const csv = await exportTelemetryAsCsv(tempDir);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("ts,name,x,y,z");
    expect(lines).toHaveLength(3);
  });

  it("clearTelemetry removes all event files", async () => {
    await recordEvent("a", {}, { enabled: true, rootDir: tempDir, now: new Date("2026-05-03Z") });
    await recordEvent("b", {}, { enabled: true, rootDir: tempDir, now: new Date("2026-05-04Z") });
    const result = await clearTelemetry(tempDir);
    expect(result.removed).toBe(2);
    expect(await readTelemetry(tempDir)).toHaveLength(0);
  });
});

describe("telemetry — schema enforcement", () => {
  it("rejects an empty event name", async () => {
    await expect(
      recordEvent("", {}, { enabled: true, rootDir: tempDir })
    ).rejects.toThrow(/non-empty/);
  });
});
