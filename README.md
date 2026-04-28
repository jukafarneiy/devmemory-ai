# DevMemory AI

**Local, auditable project memory for AI coding sessions in security-conscious engineering teams.**

DevMemory AI is a VS Code extension and a Markdown-based memory store that lives entirely inside your workspace. It produces and audits the *structured context* you feed into any AI assistant — Claude, Codex, Cursor, Copilot, on-prem LLMs — without ever calling them itself. Built for fintech, healthtech, govtech, defense, and consultancy teams whose AppSec or CISO requires local-first tooling and a clear audit trail of what AI sees and produces.

> **Beta.** Distributed as a `.vsix`, not on the Marketplace yet. Closed beta license — see `LICENSE.md`.

This monorepo contains:

- `packages/core` — safe local scanning, `.ai-memory/` file generation, prompt composition, AI-response validation, health check, quarantine.
- `apps/vscode-extension` — the VS Code commands and sidebar that drive the workflow.
- `docs/dev-memory-ai-product-spec.md` — the product specification that guided the MVP.
- `docs/positioning.md` — current positioning, ICP, honest comparison vs. neighbouring tools.

## What it actually does

- **No network calls. No telemetry. No external APIs.** Verifiable in source: there is no HTTP client and no analytics dependency in the extension or its core. The only "integration" with an AI is **you** copying a prompt to your clipboard and pasting it.
- **Workspace-only writes.** Everything DevMemory produces is inside `.ai-memory/`. You can commit it, ignore it, or delete it. It's just files.
- **AI-agnostic by design.** Prompts and responses go through your clipboard. Use Claude, Codex, Cursor's chat, Copilot, an on-prem LLM, anything that takes pasted input.
- **AI-response audit trail.** Saved sessions are validated for simulated content, destructive commands (`rm -rf`, `git reset --hard`, `drop database`), missing files, and empty summaries. Warnings persist in the session log, never silently dropped.
- **Strict scan excludes.** ~140 patterns covering `.env*`, SSH keys, AWS / GCP / Azure credentials, database dumps, build artifacts, `node_modules`, virtual envs, mobile signing keys, Terraform state, Firebase service accounts. All tested.

## When DevMemory is — and isn't — for you

**It's a fit if you:**
- Work in a regulated environment (fintech, healthtech, govtech, defense) where AppSec restricts cloud AI tooling or requires data-egress controls.
- Already use an on-prem LLM, a private Bedrock / Azure OpenAI tenant, or a Llama-style self-hosted model and need a memory layer that doesn't live inside a vendor.
- Switch between AI assistants and want one portable, version-controlled memory.
- Want a written, reviewable trail of what your AI was told and what it claimed.

**It's probably not for you if:**
- You use Cursor or Claude Code without restriction and their built-in project context is enough.
- You expect the AI to be invoked automatically — DevMemory is a clipboard workflow, not an agent.
- You need cross-machine sync today (planned, not built).
- You need a web dashboard or GUI to edit memory; today everything is files.

## How DevMemory compares

DevMemory **does not replace** the native context features of Claude Code, Cursor, or Copilot. It produces and audits the structured context you can feed into any of them.

| Tool | What it stores | Where memory lives | AI-agnostic? | Audit trail of AI replies |
|---|---|---|---|---|
| Anthropic `CLAUDE.md` | Free-form rules / notes | Repo file Claude Code reads automatically | No (Claude Code) | No |
| `AGENTS.md` (agentic conventions) | Free-form agent guidance | Repo file | Tool-by-tool | No |
| Cursor `.cursorrules` / memories | Rules + indexed project context | Repo + Cursor-managed indices | No (Cursor) | No |
| GitHub Copilot custom instructions | Per-user / per-repo prompt prefix | GitHub-side configuration | No (Copilot) | No |
| **DevMemory AI** | Project summary, architecture, current state, next actions, decisions log, bugs log, validated session logs | Local `.ai-memory/` (Markdown + JSON), git-versionable | Yes (clipboard) | Yes (validated, with warnings persisted) |

If you already maintain a hand-written `CLAUDE.md` or `.cursorrules` and you're happy, you don't need DevMemory. If you want that context **generated, validated, audited, and portable across AIs**, DevMemory is the layer that does it.

DevMemory and the native files coexist. Run **DevMemory AI: Export AI Context Files** to write a clearly marked block (`<!-- devmemory:managed:start --> … <!-- devmemory:managed:end -->`) into `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and (optionally) `.cursorrules`. Anything outside the markers is preserved on every export — your hand-written rules stay intact, and the managed block is updated in place when you re-run the command.

## 5-step flow

Open the **DevMemory AI** view in the Activity Bar. The sidebar always shows the next recommended action.

1. **Set Up Memory** — scans the workspace and creates `.ai-memory/`.
2. **Teach DevMemory About This Project** → **Save Project Understanding** — copies a stack-aware prompt to your clipboard, you paste into your AI, copy the reply, click Save.
3. **Start AI Session** — copies a fresh resume prompt that primes the AI with current memory.
4. **End AI Session** → **Save Session Summary** — copies a wrap-up prompt, you paste into the AI, copy the structured response back. The extension validates it (simulated content, destructive commands, missing files, empty summaries) and appends a session log.
5. **Check Memory Quality** — audits the local store for placeholders, missing files, and sessions applied with warnings; writes `.ai-memory/health-check.md`.

## Current limitations

- **VS Code only.** No JetBrains, Neovim, or standalone CLI yet.
- **Single machine.** No sync between devs or between your laptop and desktop.
- **Clipboard-driven.** No automatic AI API integration.
- **No team features.** No shared dashboard, no roles, no organization view.
- **Beta license.** Closed beta — see `LICENSE.md`. Not on the Marketplace yet.
- **No compliance certifications** (SOC 2, ISO 27001) — DevMemory's local-only design makes most of them not applicable, but no formal attestation exists today.

## Roadmap

**Planned (next):**
- E2E-encrypted memory sync between machines for the same user.
- Exportable audit log (CSV / PDF) of files read and AI replies validated.
- JetBrains port of the same workflow.
- Public Marketplace listing once the closed beta concludes.

**Not yet available — do not assume present:**
- Team workspaces / shared memory.
- Web dashboard.
- Direct AI API integration (auto-paste into Claude / OpenAI / Bedrock).
- SOC 2 / ISO certifications.
- Multi-project view across many repos.

---

## For developers

### First commands

```bash
npm install
npm run build
```

Open `apps/vscode-extension` in VS Code and press `F5` to launch an Extension Development Host. You can also open the monorepo root and use the included `Run DevMemory AI Extension` launch configuration.

### Build the beta VSIX

```bash
npm install
npm run package:vscode
```

`npm run package:vscode` is the single command that runs the full beta pipeline:

1. `prepackage:vscode` — `tsc -b` build + `vitest run` test suite (auto-fired by npm).
2. `npm run package -w apps/vscode-extension` — runs `scripts/package-vsix.mjs`, which calls `vscode:prepublish` (esbuild bundle), strips devDependencies from the packaged `package.json`, and runs `vsce package --no-dependencies`. The source `package.json` on disk is restored even if `vsce` fails.
3. `npm run verify:vscode-package` — runs `scripts/verify-vsix.mjs`, which re-opens the produced VSIX and asserts:
   - required files (`package.json`, `readme.md`, `changelog.md`, `LICENSE.md`, `PRIVACY.md`, `dist/extension.js`, `media/icon.png`, `media/devmemory.svg`) are present;
   - forbidden paths (`node_modules/`, `src/`, `.env*`, `.ai-memory/`, `.claude/`, source maps, `.tsbuildinfo`, any `.ts`) are absent;
   - the packaged `package.json` has no runtime `@devmemory/core` dependency, no `file:../../` workspace links, and includes `icon`, `license`, `repository`, while having no `activationEvents`;
   - the VSIX is under 500 KB.

The output is `apps/vscode-extension/devmemory-ai-vscode-0.1.0.vsix`. Install with `code --install-extension <path>` or via VS Code's *Install from VSIX…* action. Nothing is published to the Marketplace.

### Extension smoke tests

```bash
npm run test:vscode-extension
```

Spawns a headless VS Code via `@vscode/test-electron`, opens a throwaway temp workspace with `README.md`, `package.json`, `src/index.ts`, and a fake `.env`, then runs Mocha smoke tests inside the extension host. The suite asserts:

- the extension activates without error,
- all expected commands (`devmemory.initializeProject`, `…generateBootstrapPrompt`, `…applyBootstrapMemory`, `…generateResumePrompt`, `…generateSessionEndPrompt`, `…applySessionUpdate`, `…runHealthCheck`) are registered,
- `devmemory.initializeProject` creates `.ai-memory/manifest.json` and `.ai-memory/scan-report.md` in the temp workspace, and the fake `.env` is **not** tracked,
- `devmemory.generateResumePrompt` writes `.ai-memory/prompts/resume-prompt.md`.

The first run downloads VS Code (~200 MB) into `apps/vscode-extension/.vscode-test/` and is cached for subsequent runs. The test workspace is created and removed under the OS temp dir, so the repo stays clean. Test files compile to `dist/test/` and are excluded from the VSIX.

### Sidebar (Guided UX)

The extension contributes a **DevMemory AI** view container in the Activity Bar. Open it and you'll see a guided flow rather than a bare list of commands.

**Status block (top of the view):**

- *Memory status* — Not set up / Needs project understanding / Ready / Needs review.
- *Detected technologies* — read from `.ai-memory/manifest.json`.
- *Memory quality* — Healthy / Needs project understanding / Needs review / Not run yet.
- *Next recommended action* — the label of the single button under "Next Step".

**Grouped actions:**

- **Next Step** — the single most important next click for the current state.
- **Daily Workflow** — *Start AI Session*, *End AI Session*, *Save Session Summary*.
- **Review & Maintenance** — *Check Memory Quality*, *View Scan Report*, *Open Memory Files*.
- **Advanced** — *Save Project Understanding*, *Refresh View*.

The view refreshes automatically after any command that changes memory; the title-bar refresh button (or `DevMemory AI: Refresh View`) forces a manual refresh.

### Memory health check

*Check Memory Quality* writes `.ai-memory/health-check.md` and surfaces:

- Missing or stale files (`manifest.json`, `scan-report.md`, `project-summary.md`, `architecture.md`, `current-state.md`, `tasks/next-actions.md`, `prompts/resume-prompt.md`).
- Placeholder text still left over from initialization (e.g. "Replace these placeholders", "Document the main modules", "Summarize what this project is").
- Session logs written via *Save Session Summary* that include a `## DevMemory Warnings` block.
- Edge states such as a manifest with zero tracked files or invalid JSON.

If the status is `needs-review`, the report's **Recommendations** section points to the specific commands that fix each warning. The check is read-only beyond writing the report itself — it never re-scans the project and never modifies the managed memory files.
