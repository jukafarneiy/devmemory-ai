# DevMemory AI

**Stop your AI from forgetting your codebase. And from suggesting `rm -rf`.**

DevMemory is a VS Code extension that gives Claude Code, Copilot, Cursor, Cline, Continue, and on-prem LLMs a persistent, auditable memory of *your* repo — and blocks destructive commands before you paste them in.

> No telemetry by default. No network calls. Everything is plain Markdown under `.ai-memory/`. Open the file, `git diff` it, delete it. Your machine, your files.

![DevMemory paste guard blocking a destructive paste from an AI — `rm -rf`, `git push --force`, `DROP DATABASE` all caught before the text lands in your editor](https://github.com/jukafarneiy/devmemory-ai/raw/main/apps/vscode-extension/media/paste-guard.gif)

**Works with:** Claude Code · GitHub Copilot · Cursor · Cline · Continue · Codeium / Windsurf · on-prem LLMs (Llama, Bedrock, Azure OpenAI, …) — anything you can paste a prompt into.

---

## What you actually get today

1. **Auto-generated `CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `copilot-instructions.md`** that *coexist* with your hand-written rules. DevMemory only writes inside its markers; everything you write outside them is preserved on every export.
2. **Inline paste guard.** When you paste anything an AI gave you with `rm -rf`, `drop database`, `git push --force`, fork bombs, `format C:`, `dd if=/dev/zero of=/dev/sda`, `curl … | sh`, or any of 20+ other destructive shapes, DevMemory blocks it modally before it lands in your editor and offers an Undo. Tests, docs, and `.ai-memory/` are exempt.
3. **One-click resume prompt.** Click *Start AI Session* in the sidebar; the extension reads your local memory, builds a fresh resume prompt, and copies it to your clipboard. Paste into any chat. No re-explaining the project.
4. **Session capture, validated.** *End AI Session* copies a structured wrap-up prompt; you paste the AI's reply back, and DevMemory validates the response (`rm -rf`, simulated content, missing files, empty summaries) **before** appending the session log and refreshing your `current-state.md` and `tasks/next-actions.md`.
5. **Local memory health check.** Audits the `.ai-memory/` store for placeholders, missing files, and sessions saved with warnings. Writes a plain-Markdown report.
6. **Optional local-only telemetry.** Off by default. When you flip `devmemory.telemetry.enabled` on, DevMemory appends events (durations, command names, paste-guard hits) to `.ai-memory/telemetry/events-YYYYMMDD.jsonl`. Inspect, export, or wipe it with one click. **Never sent over the network.**

## The sidebar adapts to where you are

The hero CTA at the top of the sidebar changes automatically as your memory progresses — *Scan this project* → *Teach the AI* → *Save what the AI told me* → *Resume an AI session* → *Save what the AI did*. No more digging through 17 menu items to find what's next.

![DevMemory AI sidebar — the hero CTA changes automatically when you click Scan](https://github.com/jukafarneiy/devmemory-ai/raw/main/apps/vscode-extension/media/sidebar-v2.gif)

## Three pains it solves

| Pain | Without DevMemory | With DevMemory |
|---|---|---|
| The AI forgets your architecture every session | Re-explain the codebase. Hope it doesn't hallucinate. | Click *Resume AI Session* → prompt with your real architecture lands on clipboard, or use `@devmemory /resume` in chat. |
| The AI invents files / functions / decisions | Catch it in code review (or not). | Saving the session triggers a validator that flags simulated content and references to missing files. |
| The AI proposes `rm -rf` or `DROP DATABASE` | Read carefully before pasting. Hope. | DevMemory blocks the paste modally. One click to undo. |

## How DevMemory compares

DevMemory does **not** replace the native chat in Claude Code, Cursor, or Copilot. It produces and audits the *context* you feed into them — and adds the safety net those tools don't.

| | Copilot | Cursor | Cline / Continue | Cody | **DevMemory** |
|---|:---:|:---:|:---:|:---:|:---:|
| Local-only memory | – | – | – | – | ✓ |
| Inline destructive-paste guard | – | – | – | – | ✓ |
| Multi-AI portable memory (CLAUDE.md / AGENTS.md / cursorrules / copilot) | – | – | – | – | ✓ |
| Audit trail of AI replies | – | – | – | – | ✓ (Markdown + signed log) |
| Telemetry off by default | – | – | – | – | ✓ |
| Open core (FSL → Apache 2.0) | – | – | partial | – | ✓ |

Already maintaining a hand-written `CLAUDE.md` and you're happy? Keep it. Run *DevMemory: Export AI Context Files* and DevMemory will only manage the block between its markers — your handwritten rules stay untouched.

## Install

[![Install from Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/devmemory-ai.devmemory-ai-vscode?label=Marketplace&logo=visual-studio-code&color=0E639C)](https://marketplace.visualstudio.com/items?itemName=devmemory-ai.devmemory-ai-vscode)

```
code --install-extension devmemory-ai.devmemory-ai-vscode
```

A **DevMemory AI** icon appears in the Activity Bar. Open it and the sidebar always shows your next recommended action.

For local development / building from source:

```bash
npm install
npm run package:vscode
code --install-extension apps/vscode-extension/devmemory-ai-vscode-0.3.0.vsix --force
```

## Five-step flow

A native walkthrough opens on first install (or anytime via *DevMemory AI: Open Welcome Walkthrough*) so you can do all five steps without leaving the editor:

![DevMemory AI welcome walkthrough — 4 steps with rich content right inside VS Code](https://github.com/jukafarneiy/devmemory-ai/raw/main/apps/vscode-extension/media/walkthrough.gif)

1. **Scan This Project** — scans the workspace (with strict, security-aware exclusions) and creates `.ai-memory/`.
2. **Teach The AI About This Project** → **Save What The AI Told Me** — bootstraps `project-summary`, `architecture`, `current-state`, and `next-actions` using your AI of choice (clipboard or `@devmemory` chat).
3. **Resume AI Session** — copies a fresh resume prompt that primes the AI with current memory.
4. **Wrap Up Session** → **Save What The AI Did** — appends a session log (validated). Updates `current-state.md` and `tasks/next-actions.md`.
5. **Check Memory Health** — audits the local store and writes `.ai-memory/health-check.md`.

## For security-conscious teams

DevMemory was originally built for fintech, healthtech, govtech, defense, and consultancies under NDA. The core posture stays the same:

- **No network calls. No telemetry by default.** Verifiable in source — there is no HTTP client and no analytics dependency in the extension.
- **Workspace-only writes.** All output is inside `.ai-memory/`. Commit it, ignore it, archive it — your call.
- **~140 default exclude patterns** for secrets, credentials, build artifacts, virtual envs, signing keys, Terraform state, mobile config, IDE caches.
- **Workspace trust required** before any scan. Confirmation modal before initial setup.
- **Audit trail in plain Markdown.** Diff it. Review it. No opaque indices.
- **Optional signed audit pack** (coming in v0.3): one-click export of every session log and every paste-guard event, signed with a project-local ed25519 key.

See `PRIVACY.md` for the full statement.

## Talk to DevMemory from inside chat — `@devmemory`

Type `@devmemory /resume` inside Copilot Chat or any VS Code Chat host and DevMemory injects a fresh resume prompt **directly into the chat**. No clipboard, no context switch.

![DevMemory @devmemory chat participant inside Copilot Chat — subcommands /resume, /decisions, /architecture, /save-session](https://github.com/jukafarneiy/devmemory-ai/raw/main/apps/vscode-extension/media/chat-participant.gif)

| Subcommand | What it does |
|---|---|
| `/resume` | Streams the current resume prompt into chat. |
| `/decisions` | Shows your decisions log. |
| `/architecture` | Shows the architecture summary. |
| `/save-session <pasted-AI-response>` | Validates the response (destructive commands, simulation, missing files) and saves it. |

DevMemory **does not call a model itself** — the participant only feeds local context. Your AI host stays in charge of which model answers.

## Connect any MCP-aware client (Claude Code, Cursor, Cline, Continue)

Run **DevMemory AI: Enable MCP Server** and DevMemory writes `.vscode/mcp.json` (managed block — your other entries are preserved). Claude Code / Cursor / Cline / Continue auto-discover four tools:

- `memory.read` — read a section (`project-summary`, `architecture`, `current-state`, `next-actions`, `decisions`, `bugs`).
- `memory.search` — search decisions and bugs logs.
- `memory.audit` — run the destructive-command validator on any text.
- `memory.appendSession` — save a session draft from inside the agent.

The server is pure stdio JSON-RPC. **Never opens a network port.** Opt-in via `devmemory.exposeMcpServer`.

## What's not here yet

- **E2E-encrypted memory sync** for teams (server-side; opt-in) — on the v0.5 roadmap.
- **JetBrains and Neovim ports** — planned, not started.
- **Cursor as a first-class chat host** — `@devmemory` works in Copilot Chat today; Cursor support depends on Cursor's chat-participant support.

If any of these are blockers, file an issue. We prioritize what real users need.

## License

Functional Source License 1.1, with an Apache 2.0 future grant ([FSL-1.1-Apache-2.0](LICENSE.md)). Free for any internal, educational, and non-competing commercial use. Auto-converts to Apache 2.0 on **2028-04-28**.

## Reporting issues

[https://github.com/jukafarneiy/devmemory-ai/issues](https://github.com/jukafarneiy/devmemory-ai/issues) — please include `.ai-memory/health-check.md` for any "memory looks weird" reports.
