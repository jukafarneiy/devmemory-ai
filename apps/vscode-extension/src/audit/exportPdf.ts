import type { AuditEntry } from "@devmemory/core";

interface ReportInputs {
  workspaceName: string;
  generatedAt: Date;
  entries: AuditEntry[];
  publicKeyPem: string;
}

export function renderAuditHtmlReport(input: ReportInputs): string {
  const stats = computeStats(input.entries);
  const range = stats.firstTs && stats.lastTs ? `${stats.firstTs} → ${stats.lastTs}` : "—";
  const rowsHtml = input.entries
    .map((entry, idx) => rowHtml(idx + 1, entry))
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>DevMemory AI — Audit Pack — ${escapeHtml(input.workspaceName)}</title>
<style>
  :root {
    --bg: #0b1220;
    --fg: #f5f7fa;
    --muted: #9aa6b8;
    --accent: #2ee6a6;
    --warn: #f0a020;
    --bad: #ef4444;
    --line: #1e2a44;
    --mono: ui-monospace, "SFMono-Regular", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--fg);
    font-family: var(--sans); line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .page { max-width: 960px; margin: 0 auto; padding: 48px 32px 96px; }
  header h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; }
  header p { margin: 0; color: var(--muted); font-size: 14px; }
  .hero { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
  .stat {
    background: rgba(255,255,255,0.04); border: 1px solid var(--line);
    border-radius: 8px; padding: 16px;
  }
  .stat dt { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0; }
  .stat dd { margin: 6px 0 0; font-size: 22px; font-weight: 600; font-feature-settings: "tnum"; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  td.mono { font-family: var(--mono); font-size: 12px; word-break: break-all; }
  .kind { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; letter-spacing: 0.04em; }
  .kind-session    { background: rgba(46,230,166,0.15); color: var(--accent); }
  .kind-bootstrap  { background: rgba(124,92,255,0.18); color: #b8a4ff; }
  .kind-paste-guard{ background: rgba(239,68,68,0.18); color: #fca5a5; }
  .kind-audit-export { background: rgba(255,255,255,0.08); color: var(--muted); }
  details { background: rgba(255,255,255,0.03); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin: 24px 0; }
  details summary { cursor: pointer; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
  details pre { font-family: var(--mono); font-size: 11px; background: #0a0f1c; padding: 16px; border-radius: 6px; overflow-x: auto; color: var(--fg); }
  footer { margin-top: 48px; color: var(--muted); font-size: 12px; }
  footer code { font-family: var(--mono); }
  @media print {
    :root { --bg: #fff; --fg: #111; --muted: #555; --line: #ddd; --accent: #0a8; }
    body { background: #fff; color: #111; }
    .stat { background: #f7f8fa; }
    details pre { background: #f3f4f6; color: #111; }
  }
</style>
</head>
<body>
<main class="page">
  <header>
    <h1>DevMemory AI — Audit Pack</h1>
    <p>Workspace: <strong>${escapeHtml(input.workspaceName)}</strong> · Generated: ${escapeHtml(input.generatedAt.toISOString())}</p>
  </header>

  <dl class="hero">
    <div class="stat"><dt>Total events</dt><dd>${stats.total}</dd></div>
    <div class="stat"><dt>Sessions</dt><dd>${stats.byKind.session ?? 0}</dd></div>
    <div class="stat"><dt>Paste-guard hits</dt><dd>${stats.byKind["paste-guard"] ?? 0}</dd></div>
    <div class="stat"><dt>Bootstraps</dt><dd>${stats.byKind.bootstrap ?? 0}</dd></div>
  </dl>

  <p style="color: var(--muted); font-size: 13px;">Date range: ${escapeHtml(range)}</p>

  <h2 style="margin-top: 32px; font-size: 18px;">Events</h2>
  <table>
    <thead><tr>
      <th style="width: 36px;">#</th>
      <th>Timestamp</th>
      <th>Kind</th>
      <th>Summary</th>
      <th>SHA-256</th>
    </tr></thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="5" style="color: var(--muted); padding: 24px;">No audit events yet.</td></tr>`}
    </tbody>
  </table>

  <details>
    <summary>How to verify this audit pack independently</summary>
    <p style="margin-top: 12px;">Inside the audit pack folder, run:</p>
    <pre>bash verify.sh log.jsonl public-key.pem</pre>
    <p>Each entry's signature is verified against the public key embedded in <code>public-key.pem</code>. The signature covers the canonical JSON of <code>{ts, kind, fileSha256, summary}</code>; tampering with any of those fields invalidates the signature.</p>
  </details>

  <details>
    <summary>Public key (Ed25519)</summary>
    <pre>${escapeHtml(input.publicKeyPem.trim())}</pre>
  </details>

  <footer>
    Generated by DevMemory AI ·
    <a style="color: var(--accent);" href="https://github.com/jukafarneiy/devmemory-ai">github.com/jukafarneiy/devmemory-ai</a>
    · Local-first by design — this report was assembled on your machine, with no network calls.
  </footer>
</main>
</body>
</html>
`;
}

function rowHtml(index: number, entry: AuditEntry): string {
  return `<tr>
    <td>${index}</td>
    <td class="mono">${escapeHtml(entry.ts)}</td>
    <td><span class="kind kind-${escapeHtml(entry.kind)}">${escapeHtml(entry.kind)}</span></td>
    <td>${escapeHtml(entry.summary)}</td>
    <td class="mono" title="${escapeHtml(entry.fileSha256)}">${escapeHtml(entry.fileSha256.slice(0, 12))}…</td>
  </tr>`;
}

function computeStats(entries: ReadonlyArray<AuditEntry>): {
  total: number;
  byKind: Record<string, number>;
  firstTs: string | null;
  lastTs: string | null;
} {
  const byKind: Record<string, number> = {};
  for (const entry of entries) {
    byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1;
  }
  return {
    total: entries.length,
    byKind,
    firstTs: entries[0]?.ts ?? null,
    lastTs: entries[entries.length - 1]?.ts ?? null
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
