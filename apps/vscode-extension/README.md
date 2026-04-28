# DevMemory AI — VS Code Extension (Beta)

**Local, auditable project memory for AI coding sessions in security-conscious engineering teams.**

DevMemory AI is a VS Code extension and a Markdown-based memory store that lives entirely inside your workspace. It makes the context you give an AI assistant — and the responses you bring back — written, reviewable, and portable across tools. Built for fintech, healthtech, govtech, defense, and consultancy teams whose AppSec or CISO requires local-first tooling and a clear audit trail of what AI sees and produces.

> **Marketplace Preview.** Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=devmemory-ai.devmemory-ai-vscode). Public preview beta license — see `LICENSE.md`.

---

## What it actually does

DevMemory AI scans your workspace (with strict, security-aware exclusions), produces a small set of human-readable Markdown files under `.ai-memory/`, and gives you a short, structured workflow for **starting a session, ending a session, and saving what changed**. The memory it produces is what *you* paste into your AI of choice; DevMemory itself never calls an AI API.

- **No network calls. No telemetry. No external APIs.** Verifiable in source: there is no HTTP client and no analytics dependency in the extension or its core.
- **Workspace-only writes.** Everything DevMemory produces is a file inside your repo (`.ai-memory/`). You can commit it, ignore it, or delete it at any time.
- **AI-agnostic.** Prompts go through your clipboard. Use Claude, Codex, Cursor's chat, Copilot, an on-prem LLM, or anything else that takes pasted input.
- **AI-response audit trail.** Saved sessions are validated (simulated content, destructive commands, missing files, empty summaries) and the warnings persist in the session log for later review.

## Install the beta

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=devmemory-ai.devmemory-ai-vscode), then reload VS Code if prompted.

For local testing or manual install, build the verified `.vsix`:

```bash
npm install
npm run package:vscode
```

`npm run package:vscode` runs build + tests, packages the extension with esbuild bundling, strips devDependencies from the shipped `package.json`, and verifies the resulting VSIX. Output: `apps/vscode-extension/devmemory-ai-vscode-0.1.1.vsix`.

Install in VS Code: `Extensions` view → `…` menu → **Install from VSIX…** → pick the `.vsix`. Or from the CLI:

```bash
code --install-extension apps/vscode-extension/devmemory-ai-vscode-0.1.1.vsix
```

A **DevMemory AI** icon appears in the Activity Bar.

## 5-step flow

![DevMemory AI sidebar with the guided next-step flow](https://raw.githubusercontent.com/jukafarneiy/devmemory-ai/main/apps/vscode-extension/media/marketplace/02-sidebar.png)

Open the **DevMemory AI** view in the Activity Bar — the sidebar always shows the next recommended action.

1. **Set Up Memory** — scans the workspace and creates `.ai-memory/` with a manifest, scan report, and starter files.
2. **Teach DevMemory About This Project** — copies a stack-aware prompt to your clipboard. Paste it into your AI; copy the AI's reply.
3. **Save Project Understanding** — pastes the AI's reply back. The extension validates the four required sections and writes them into project memory.
4. **Start AI Session** — copies a fresh resume prompt that primes the AI with the current memory. (Repeat at the start of every session.)
5. **End AI Session** → **Save Session Summary** — wraps the session, validates the AI's structured response (sim/destructive-cmd/missing-file/empty checks), and appends a session log under `.ai-memory/sessions/` while refreshing `current-state.md` and `tasks/next-actions.md`.

A separate **Check Memory Quality** command writes `.ai-memory/health-check.md` so you can periodically audit the local store.

## Security & local-first

- **No code leaves your machine via DevMemory.** When you paste a prompt into your AI assistant, the AI's own privacy policy applies — DevMemory has no role in that hop. If you use an on-prem LLM, your AI workflow can stay fully local; if you use an enterprise tenant of Claude / Azure OpenAI / Bedrock, your provider's approved controls and privacy terms apply.
- **Strict scan excludes.** ~140 patterns covering `.env*`, SSH keys, AWS / GCP / Azure credentials, database dumps, build artifacts, `node_modules`, `.git`, virtual envs, mobile signing keys, Terraform state, Firebase service accounts, and similar. Tested.
- **Workspace trust required.** Scans refuse to run until VS Code has marked the workspace as trusted.
- **Confirmation before scan.** `devmemory.confirmBeforeScan` (default `true`) shows a modal before any read-and-scaffold action.
- **Markdown you can review.** Memory files are plain Markdown. Run `git diff` against them, ask security to review them, archive them — they are just text.

See `PRIVACY.md` (shipped in the extension package) for the full statement.

## When DevMemory is — and isn't — for you

**It's a fit if you:**
- Work in fintech, healthtech, govtech, defense, or any environment where AppSec restricts cloud AI tools or requires data-egress controls.
- Already use an on-prem LLM, a private Bedrock / Azure OpenAI tenant, or a Llama-style self-hosted model and need a memory layer that doesn't depend on a vendor's "memory" feature.
- Switch between AI assistants (Claude, Codex, Cursor, Copilot, on-prem) and want one portable, version-controlled memory.
- Want a written, reviewable trail of what your AI was told, what it claimed to do, and what changed in the project.
- Prefer Markdown you can `git diff` over opaque binary indexes.

**It's probably not for you if:**
- You use Cursor or Claude Code without restriction and their built-in project context is enough.
- You expect the AI to be invoked automatically — DevMemory is a clipboard-driven workflow, not an agent.
- You need cross-machine memory sync today (see *Roadmap*).
- You need a web dashboard or a GUI to edit memory; today everything is files.

## How DevMemory compares

DevMemory **does not replace** the native context features of Claude Code, Cursor, or Copilot. It produces and audits the *structured context* you can feed into them.

| Tool | What it stores | Where memory lives | AI-agnostic? | Audit trail of AI replies |
|---|---|---|---|---|
| Anthropic `CLAUDE.md` | Free-form rules / notes | Repo file Claude Code reads automatically | No (Claude Code) | No |
| `AGENTS.md` (agentic conventions) | Free-form agent guidance | Repo file | Tool-by-tool | No |
| Cursor `.cursorrules` / Cursor memories | Rules + indexed project context | Repo + Cursor-managed indices | No (Cursor) | No |
| GitHub Copilot custom instructions | Per-user / per-repo prompt prefix | GitHub-side configuration | No (Copilot) | No |
| **DevMemory AI** | Project summary, architecture, current state, next actions, decisions log, bugs log, validated session logs | Local `.ai-memory/` (Markdown + JSON), git-versionable | Yes (clipboard) | Yes (validated, with warnings persisted) |

If you already maintain a hand-written `CLAUDE.md` or `.cursorrules` and you're happy, you don't need DevMemory. If you want that context **generated, validated, audited, and portable across AIs**, DevMemory is the layer that does it.

DevMemory and the native files coexist. Run **DevMemory AI: Export AI Context Files** to write a clearly marked block (`<!-- devmemory:managed:start --> … <!-- devmemory:managed:end -->`) into `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and (optionally) `.cursorrules`. Anything outside the markers is preserved on every export — your hand-written rules stay intact, and the managed block is updated in place when you re-run the command.

## Current limitations (be aware)

- **VS Code only.** No JetBrains, Neovim, or standalone CLI yet.
- **Single machine.** No sync between devs or between your laptop and desktop.
- **Clipboard-driven.** No automatic AI API integration. Each session is *copy-paste-into-AI, copy-paste-back*.
- **No team features.** No shared dashboard, no roles, no organization view.
- **Preview beta license.** See `LICENSE.md`.
- **No compliance certifications** (SOC 2, ISO 27001, etc.) — DevMemory's local-only design makes most of them not applicable, but no formal attestation exists today.

## Roadmap

**Planned (next):**
- E2E-encrypted memory sync between machines for the same user.
- Exportable audit log (CSV / PDF) of files read and AI replies validated.
- JetBrains port of the same workflow.
- Additional Marketplace screenshots and a short onboarding demo GIF.

**Not yet available — do not assume present:**
- Team workspaces / shared memory.
- Web dashboard.
- Direct AI API integration (auto-paste into Claude / OpenAI / Bedrock).
- SOC 2 / ISO certifications.
- Multi-project view across many repos.

## Reporting feedback during the beta

Open an issue in the project repository. When reporting problems, include the contents of `.ai-memory/health-check.md` — it's the fastest way to understand the state of your memory store.
