import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import {
  VERIFY_SH_TEMPLATE,
  appendAuditEntry,
  ensureAuditKeypair,
  readAuditEntries,
  resolveAuditDir,
  verifyAuditLog
} from "@devmemory/core";
import { renderAuditHtmlReport } from "./exportPdf";

export async function exportAuditPackCommand(): Promise<void> {
  const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!rootDir) {
    await vscode.window.showErrorMessage("Open a workspace folder before exporting an audit pack.");
    return;
  }

  const km = await ensureAuditKeypair(rootDir);
  const auditDir = await resolveAuditDir(rootDir);
  const entries = await readAuditEntries(rootDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const exportRoot = path.join(auditDir, `export-${stamp}`);
  await fs.mkdir(exportRoot, { recursive: true });

  const sourceLog = path.join(auditDir, "log.jsonl");
  const targetLog = path.join(exportRoot, "log.jsonl");
  try {
    const raw = await fs.readFile(sourceLog, "utf8");
    await fs.writeFile(targetLog, raw, "utf8");
  } catch {
    await fs.writeFile(targetLog, "", "utf8");
  }
  await fs.writeFile(path.join(exportRoot, "public-key.pem"), km.publicKeyPem);
  await fs.writeFile(path.join(exportRoot, "verify.sh"), VERIFY_SH_TEMPLATE, { mode: 0o755 });

  const report = renderAuditHtmlReport({
    workspaceName: vscode.workspace.workspaceFolders?.[0]?.name ?? path.basename(rootDir),
    generatedAt: new Date(),
    entries,
    publicKeyPem: km.publicKeyPem
  });
  await fs.writeFile(path.join(exportRoot, "report.html"), report, "utf8");

  await appendAuditEntry({
    rootDir,
    kind: "audit-export",
    summary: `audit pack exported (${entries.length} entries) → ${path.relative(rootDir, exportRoot)}`
  }).catch(() => {});

  const action = await vscode.window.showInformationMessage(
    `DevMemory audit pack exported to ${path.relative(rootDir, exportRoot)} — ${entries.length} signed entries. Open the HTML report or run verify.sh to validate.`,
    "Open Report",
    "Reveal in Finder"
  );
  if (action === "Open Report") {
    await vscode.env.openExternal(vscode.Uri.file(path.join(exportRoot, "report.html")));
  } else if (action === "Reveal in Finder") {
    await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(exportRoot));
  }
}

export async function verifyAuditPackCommand(): Promise<void> {
  const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!rootDir) {
    await vscode.window.showErrorMessage("Open a workspace folder before verifying the audit log.");
    return;
  }
  const km = await ensureAuditKeypair(rootDir);
  const auditDir = await resolveAuditDir(rootDir);
  const result = await verifyAuditLog(path.join(auditDir, "log.jsonl"), km.publicKeyPath);

  if (result.failures.length === 0) {
    await vscode.window.showInformationMessage(
      `DevMemory audit log verified. ${result.verified} of ${result.total} entries are intact.`
    );
    return;
  }
  const sample = result.failures
    .slice(0, 3)
    .map((f) => (f.index === -1 ? f.reason : `line ${f.index + 1}: ${f.reason}`))
    .join("; ");
  await vscode.window.showWarningMessage(
    `DevMemory audit log: ${result.failures.length} of ${result.total} entries failed to verify. Examples: ${sample}`
  );
}
