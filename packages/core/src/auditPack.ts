import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, resolveMemoryDir } from "./config";

export type AuditEntryKind = "session" | "bootstrap" | "paste-guard" | "audit-export";

export interface AuditEntry {
  ts: string;
  kind: AuditEntryKind;
  fileSha256: string;
  summary: string;
  signature: string;
}

export interface AppendAuditEntryInput {
  rootDir: string;
  kind: AuditEntryKind;
  filePath?: string;
  summary: string;
  now?: Date;
}

export interface VerifyOutcome {
  total: number;
  verified: number;
  failures: Array<{ index: number; reason: string }>;
}

export interface AuditKeyMaterial {
  publicKeyPem: string;
  publicKeyPath: string;
  privateKeyPath: string;
}

const AUDIT_DIR = path.join(".audit");
const KEYPAIR_FILE = "keypair.json";
const PUBLIC_KEY_FILE = "public-key.pem";
const LOG_FILE = "log.jsonl";

interface KeypairFile {
  version: 1;
  algorithm: "ed25519";
  createdAt: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

export async function ensureAuditKeypair(rootDir: string): Promise<AuditKeyMaterial> {
  const auditDir = await resolveAuditDir(rootDir);
  await fs.mkdir(auditDir, { recursive: true });
  const keypairPath = path.join(auditDir, KEYPAIR_FILE);
  const publicKeyPath = path.join(auditDir, PUBLIC_KEY_FILE);

  let parsed: KeypairFile | null = null;
  try {
    const raw = await fs.readFile(keypairPath, "utf8");
    parsed = JSON.parse(raw) as KeypairFile;
    if (!parsed.publicKeyPem || !parsed.privateKeyPem || parsed.algorithm !== "ed25519") {
      parsed = null;
    }
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
  }

  if (!parsed) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
    const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    parsed = {
      version: 1,
      algorithm: "ed25519",
      createdAt: new Date().toISOString(),
      publicKeyPem,
      privateKeyPem
    };
    await fs.writeFile(keypairPath, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
    await fs.writeFile(publicKeyPath, publicKeyPem);
  }

  return {
    publicKeyPem: parsed.publicKeyPem,
    publicKeyPath,
    privateKeyPath: keypairPath
  };
}

export async function appendAuditEntry(input: AppendAuditEntryInput): Promise<AuditEntry | null> {
  const auditDir = await resolveAuditDir(input.rootDir);
  await fs.mkdir(auditDir, { recursive: true });

  const keypairPath = path.join(auditDir, KEYPAIR_FILE);
  let keypair: KeypairFile;
  try {
    const raw = await fs.readFile(keypairPath, "utf8");
    keypair = JSON.parse(raw) as KeypairFile;
  } catch (error) {
    if (isMissing(error)) {
      await ensureAuditKeypair(input.rootDir);
      const raw = await fs.readFile(keypairPath, "utf8");
      keypair = JSON.parse(raw) as KeypairFile;
    } else {
      throw error;
    }
  }

  const ts = (input.now ?? new Date()).toISOString();
  const fileSha256 = input.filePath ? await sha256OfFile(input.filePath) : sha256OfText(input.summary);
  const summary = redactSummary(input.summary);
  const signedBytes = canonicalSignedBytes({ ts, kind: input.kind, fileSha256, summary });
  const privateKey = crypto.createPrivateKey(keypair.privateKeyPem);
  const signatureBuf = crypto.sign(null, signedBytes, privateKey);
  const signature = signatureBuf.toString("base64");

  const entry: AuditEntry = { ts, kind: input.kind, fileSha256, summary, signature };
  const logPath = path.join(auditDir, LOG_FILE);
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export async function verifyAuditLog(
  jsonlPath: string,
  publicKeyPemOrPath: string
): Promise<VerifyOutcome> {
  const publicKeyPem = await resolvePublicKey(publicKeyPemOrPath);
  const publicKey = crypto.createPublicKey(publicKeyPem);

  let raw: string;
  try {
    raw = await fs.readFile(jsonlPath, "utf8");
  } catch {
    return { total: 0, verified: 0, failures: [{ index: -1, reason: "log file not found" }] };
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  let verified = 0;
  const failures: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      const entry = JSON.parse(line) as AuditEntry;
      if (!entry || typeof entry.signature !== "string") {
        failures.push({ index: i, reason: "missing signature" });
        continue;
      }
      const signedBytes = canonicalSignedBytes({
        ts: entry.ts,
        kind: entry.kind,
        fileSha256: entry.fileSha256,
        summary: entry.summary
      });
      const ok = crypto.verify(null, signedBytes, publicKey, Buffer.from(entry.signature, "base64"));
      if (ok) {
        verified += 1;
      } else {
        failures.push({ index: i, reason: "signature did not verify" });
      }
    } catch (err) {
      failures.push({ index: i, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { total: lines.length, verified, failures };
}

export async function readAuditEntries(rootDir: string): Promise<AuditEntry[]> {
  const auditDir = await resolveAuditDir(rootDir);
  const logPath = path.join(auditDir, LOG_FILE);
  let raw: string;
  try {
    raw = await fs.readFile(logPath, "utf8");
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }
    throw error;
  }
  const entries: AuditEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      // skip malformed
    }
  }
  return entries;
}

export async function resolveAuditDir(rootDir: string): Promise<string> {
  const config = await loadConfig(rootDir);
  const memoryDir = resolveMemoryDir(rootDir, config);
  return path.join(memoryDir, AUDIT_DIR);
}

export const VERIFY_SH_TEMPLATE = `#!/usr/bin/env bash
# DevMemory AI — audit log verifier (FSL-1.1-Apache-2.0).
# Usage: bash verify.sh log.jsonl public-key.pem
set -euo pipefail
LOG="\${1:-log.jsonl}"
KEY="\${2:-public-key.pem}"
if [ ! -f "\$LOG" ]; then echo "FAIL: log file not found: \$LOG" >&2; exit 1; fi
if [ ! -f "\$KEY" ]; then echo "FAIL: public key not found: \$KEY" >&2; exit 1; fi
node -e "$(cat <<'JS'
const crypto = require('node:crypto');
const fs = require('node:fs');
const log = process.argv[1];
const keyPath = process.argv[2];
const publicKey = crypto.createPublicKey(fs.readFileSync(keyPath, 'utf8'));
const lines = fs.readFileSync(log, 'utf8').split(/\\r?\\n/).filter(Boolean);
let verified = 0;
const failures = [];
for (let i = 0; i < lines.length; i++) {
  let entry;
  try { entry = JSON.parse(lines[i]); } catch (e) { failures.push([i, 'parse']); continue; }
  if (!entry || typeof entry.signature !== 'string') { failures.push([i, 'no-signature']); continue; }
  const canonical = JSON.stringify({ ts: entry.ts, kind: entry.kind, fileSha256: entry.fileSha256, summary: entry.summary });
  const ok = crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKey, Buffer.from(entry.signature, 'base64'));
  if (ok) verified++; else failures.push([i, 'bad-signature']);
}
if (failures.length === 0) {
  console.log('OK: ' + verified + ' entries verified');
  process.exit(0);
} else {
  console.error('FAIL: ' + failures.length + ' of ' + lines.length + ' entries failed');
  for (const [i, reason] of failures.slice(0, 5)) console.error('  line ' + (i + 1) + ': ' + reason);
  process.exit(1);
}
JS
)" "\$LOG" "\$KEY"
`;

function canonicalSignedBytes(parts: {
  ts: string;
  kind: AuditEntryKind;
  fileSha256: string;
  summary: string;
}): Buffer {
  return Buffer.from(JSON.stringify(parts), "utf8");
}

async function sha256OfFile(filePath: string): Promise<string> {
  try {
    const raw = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(raw).digest("hex");
  } catch {
    return "";
  }
}

function sha256OfText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function redactSummary(value: string): string {
  const trimmed = value.trim().slice(0, 480);
  return trimmed.replace(/[A-Za-z0-9_\-+/=]{32,}/g, "<redacted-secret>");
}

async function resolvePublicKey(value: string): Promise<string> {
  if (value.includes("BEGIN PUBLIC KEY")) {
    return value;
  }
  return await fs.readFile(value, "utf8");
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}
