# DevMemory AI

**Stop your AI from forgetting your codebase. And from suggesting `rm -rf`.**

DevMemory is a VS Code extension that gives Claude Code, Copilot, Cursor, Cline, Continue, and on-prem LLMs a persistent, auditable memory of *your* repo — and blocks destructive commands before you paste them in.

> No telemetry by default. No network calls. Everything is plain Markdown under `.ai-memory/`. Open the file, `git diff` it, delete it. Your machine, your files.

[![Install from Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/devmemory-ai.devmemory-ai-vscode?label=Marketplace&logo=visual-studio-code&color=0E639C)](https://marketplace.visualstudio.com/items?itemName=devmemory-ai.devmemory-ai-vscode)

**Works with:** Claude Code · GitHub Copilot · Cursor · Cline · Continue · Codeium / Windsurf · on-prem LLMs (Llama, Bedrock, Azure OpenAI, …) — anything you can paste a prompt into.

---

## What you actually get today

1. **Auto-generated `CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `copilot-instructions.md`** that *coexist* with your hand-written rules. DevMemory only writes inside its markers; everything you write outside them is preserved on every export.
2. **Inline paste guard.** When the AI gives you a snippet with `rm -rf`, `drop database`, `git push --force`, fork bombs, `format C:`, `dd if=/dev/zero of=/dev/sda`, `curl … | sh`, or any of 20+ other destructive shapes, DevMemory blocks the paste modally and offers an Undo. Tests, docs, and `.ai-memory/` are exempt.
3. **One-click resume prompt** for any chat (Claude Code, Copilot Chat, Cursor, Cline, Continue, ChatGPT, on-prem) — DevMemory reads your local memory and copies a fresh, structured prompt to the clipboard.
4. **Session capture, validated.** *End AI Session* copies a structured wrap-up prompt; you paste the AI's reply back, and DevMemory validates the response (`rm -rf`, simulated content, missing files, empty summaries) **before** appending the session log and refreshing your `current-state.md`.
5. **Local memory health check** that surfaces placeholders, missing files, and sessions saved with warnings.
6. **Optional local-only telemetry**, off by default. When you flip `devmemory.telemetry.enabled` on, DevMemory appends events (durations, command names, paste-guard hits) to `.ai-memory/telemetry/events-YYYYMMDD.jsonl`. Inspect, export, or wipe it with one click. **Never sent over the network.**

## Three pains it solves

| Pain | Without DevMemory | With DevMemory |
|---|---|---|
| The AI forgets your architecture every session | Re-explain the codebase. Hope it doesn't hallucinate. | Click *Start AI Session* → prompt with your real architecture lands on clipboard. |
| The AI invents files / functions / decisions | Catch it in code review (or not). | Saving the session triggers a validator that flags simulated content and references to missing files. |
| The AI proposes `rm -rf` or `DROP DATABASE` | Read carefully before pasting. Hope. | DevMemory blocks the paste modally. One click to undo. |

## Repository layout

This monorepo contains:

- `packages/core` — pure-Node, vscode-free library with the scanner (~140 secret exclusion patterns), Markdown templates, AI-response validators (`rm -rf`/simulation/missing-file detection), telemetry log writer, and exporter for CLAUDE.md / AGENTS.md / .cursorrules / copilot-instructions.md.
- `apps/vscode-extension` — the VS Code extension: sidebar UI, command palette entries, paste guard, telemetry surface.
- `docs/dev-memory-ai-product-spec.md` — product spec.
- `docs/positioning.md` — positioning, ICP, and honest competitive comparison.

## Install

```
code --install-extension devmemory-ai.devmemory-ai-vscode
```

Or build from source:

```bash
npm install
npm run package:vscode
code --install-extension apps/vscode-extension/devmemory-ai-vscode-0.2.0.vsix --force
```

A **DevMemory AI** icon appears in the Activity Bar.

## Five-step flow

1. **Set Up Memory** — scans the workspace and creates `.ai-memory/`.
2. **Teach DevMemory About This Project** → **Save Project Understanding** — bootstraps memory using any AI (clipboard hop).
3. **Start AI Session** — copies a fresh resume prompt to clipboard.
4. **End AI Session** → **Save Session Summary** — validates and appends a session log.
5. **Check Memory Quality** — audits the local store and writes a health report.

## How DevMemory compares

| | Copilot | Cursor | Cline / Continue | Cody | **DevMemory** |
|---|:---:|:---:|:---:|:---:|:---:|
| Local-only memory | – | – | – | – | ✓ |
| Inline destructive-paste guard | – | – | – | – | ✓ |
| Multi-AI portable memory | – | – | – | – | ✓ |
| Audit trail of AI replies | – | – | – | – | ✓ |
| Telemetry off by default | – | – | – | – | ✓ |
| Open core | – | – | partial | – | ✓ (FSL → Apache 2.0) |

Already maintaining a hand-written `CLAUDE.md` and happy? Keep it. Run *DevMemory: Export AI Context Files* and DevMemory will only manage the block between its markers — your handwritten rules stay untouched.

## For security-conscious teams

DevMemory was originally designed for fintech, healthtech, govtech, defense, and consultancies under NDA. The compliance posture is documented in `docs/positioning.md`. In short:

- No network calls. No telemetry by default. Verifiable in source.
- Workspace-only writes inside `.ai-memory/`.
- Workspace trust required before any scan; confirmation modal before initial setup.
- ~140 default exclude patterns for secrets, credentials, build artifacts.
- Audit trail in plain Markdown — diffable, reviewable, archive-friendly.
- Optional signed audit pack (ed25519, coming in v0.3).

## What's not here yet

- **Chat-participant integration** (`@devmemory` inside Copilot Chat / VS Code Chat) — coming in v0.3.
- **MCP server** so Claude Code, Cursor, Cline, Continue can pull memory without clipboard — coming in v0.4.
- **E2E-encrypted sync** for teams — on the v0.5 roadmap.
- **JetBrains and Neovim ports** — planned, not started.

## License

Functional Source License 1.1, with an Apache 2.0 future grant — see [LICENSE.md](LICENSE.md). Free for any internal, educational, or non-competing commercial use. Auto-converts to Apache 2.0 on **2028-04-28**.

---

## For developers

### First commands

```bash
npm install
npm run build
```

Open `apps/vscode-extension` in VS Code and press `F5` to launch an Extension Development Host.

### Build the VSIX

```bash
npm install
npm run package:vscode
```

`npm run package:vscode`:
1. `prepackage:vscode` — `tsc -b` build + `vitest run` test suite (auto-fired by npm).
2. `npm run package -w apps/vscode-extension` — runs `scripts/package-vsix.mjs`, which calls `vscode:prepublish` (esbuild bundle), strips devDependencies from the packaged `package.json`, and runs `vsce package --no-dependencies`.
3. `npm run verify:vscode-package` — `scripts/verify-vsix.mjs` re-opens the VSIX and asserts: required files present, forbidden paths absent, packaged `package.json` shape correct, VSIX under 500 KB.

Output: `apps/vscode-extension/devmemory-ai-vscode-0.2.0.vsix`.

### Tests

```bash
npm test                       # vitest, the @devmemory/core test suite (~180 cases incl. paste-guard validators)
npm run test:vscode-extension  # mocha smoke inside @vscode/test-electron
```

The first VS Code smoke run downloads VS Code (~200 MB) into `apps/vscode-extension/.vscode-test/` and is cached.

### Memory health check

*Check Memory Quality* writes `.ai-memory/health-check.md`. The check is read-only beyond writing the report itself — it never re-scans the project and never modifies the managed memory files.
