import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendAuditEntry,
  ensureAuditKeypair,
  readAuditEntries,
  resolveAuditDir,
  verifyAuditLog
} from "./auditPack";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "devmemory-audit-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("auditPack — keypair lifecycle", () => {
  it("creates a fresh ed25519 keypair on first call and reuses it on subsequent calls", async () => {
    const a = await ensureAuditKeypair(tempDir);
    const b = await ensureAuditKeypair(tempDir);
    expect(a.publicKeyPem).toBe(b.publicKeyPem);
    expect(a.publicKeyPem).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(a.publicKeyPem).toMatch(/-----END PUBLIC KEY-----/);
  });

  it("writes the public key to a sidecar file for distribution", async () => {
    const km = await ensureAuditKeypair(tempDir);
    const pubFromFile = await fs.readFile(km.publicKeyPath, "utf8");
    expect(pubFromFile.trim()).toBe(km.publicKeyPem.trim());
  });
});

describe("auditPack — append + verify happy path", () => {
  it("appends a signed entry and verifies it", async () => {
    const km = await ensureAuditKeypair(tempDir);
    const entry = await appendAuditEntry({
      rootDir: tempDir,
      kind: "session",
      summary: "fixed bug X by editing file Y",
      now: new Date("2026-05-03T12:00:00Z")
    });
    expect(entry).not.toBeNull();
    expect(entry?.signature).toBeTruthy();

    const auditDir = await resolveAuditDir(tempDir);
    const result = await verifyAuditLog(path.join(auditDir, "log.jsonl"), km.publicKeyPath);
    expect(result.total).toBe(1);
    expect(result.verified).toBe(1);
    expect(result.failures).toHaveLength(0);
  });

  it("verifies multiple entries in order", async () => {
    const km = await ensureAuditKeypair(tempDir);
    for (const kind of ["bootstrap", "session", "session", "paste-guard"] as const) {
      await appendAuditEntry({
        rootDir: tempDir,
        kind,
        summary: `event ${kind}`
      });
    }

    const entries = await readAuditEntries(tempDir);
    expect(entries).toHaveLength(4);

    const auditDir = await resolveAuditDir(tempDir);
    const result = await verifyAuditLog(path.join(auditDir, "log.jsonl"), km.publicKeyPath);
    expect(result.total).toBe(4);
    expect(result.verified).toBe(4);
  });
});

describe("auditPack — tamper detection", () => {
  it("flags a tampered summary as a verification failure", async () => {
    const km = await ensureAuditKeypair(tempDir);
    await appendAuditEntry({ rootDir: tempDir, kind: "session", summary: "original" });

    const auditDir = await resolveAuditDir(tempDir);
    const logPath = path.join(auditDir, "log.jsonl");
    const original = await fs.readFile(logPath, "utf8");
    const tampered = original.replace(/"summary":"original"/, '"summary":"forged"');
    await fs.writeFile(logPath, tampered);

    const result = await verifyAuditLog(logPath, km.publicKeyPath);
    expect(result.verified).toBe(0);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0].reason).toMatch(/signature/);
  });

  it("flags a totally re-signed line as failure when verifying with the original key", async () => {
    const km = await ensureAuditKeypair(tempDir);
    await appendAuditEntry({ rootDir: tempDir, kind: "session", summary: "ok" });

    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), "devmemory-audit-other-"));
    try {
      await ensureAuditKeypair(otherDir);
      await appendAuditEntry({ rootDir: otherDir, kind: "session", summary: "from-other-repo" });
      const otherLog = path.join(await resolveAuditDir(otherDir), "log.jsonl");
      const result = await verifyAuditLog(otherLog, km.publicKeyPath);
      expect(result.verified).toBe(0);
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });
});

describe("auditPack — graceful failure modes", () => {
  it("returns a failure when the log does not exist", async () => {
    const km = await ensureAuditKeypair(tempDir);
    const result = await verifyAuditLog(path.join(tempDir, "missing.jsonl"), km.publicKeyPath);
    expect(result.total).toBe(0);
    expect(result.verified).toBe(0);
    expect(result.failures.length).toBe(1);
  });

  it("auto-creates a keypair on first appendAuditEntry without a prior ensureAuditKeypair call", async () => {
    const entry = await appendAuditEntry({ rootDir: tempDir, kind: "session", summary: "auto-init" });
    expect(entry).not.toBeNull();

    const auditDir = await resolveAuditDir(tempDir);
    const km = await ensureAuditKeypair(tempDir);
    const result = await verifyAuditLog(path.join(auditDir, "log.jsonl"), km.publicKeyPath);
    expect(result.verified).toBe(1);
  });

  it("redacts long opaque secret-like strings inside the summary before signing", async () => {
    const fakeToken = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";
    const entry = await appendAuditEntry({
      rootDir: tempDir,
      kind: "session",
      summary: `committed token ${fakeToken} to file`
    });
    expect(entry?.summary).not.toContain(fakeToken);
    expect(entry?.summary).toContain("<redacted-secret>");
  });
});
