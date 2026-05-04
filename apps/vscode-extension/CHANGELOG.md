# Changelog

## 0.3.1 — Marketplace listing refresh: paste-guard hero GIF (2026-05-04)

No functional code changes — pure listing refresh.

- New hero animation: `media/paste-guard.gif` (12 s, 1.0 MB) showing DevMemory blocking a 4-pattern destructive paste (`rm -rf`, `git reset --hard`, `git push --force`, `DROP DATABASE`) and the *Undo paste* recovery.
- Secondary animation: `media/paste-guard-keep.gif` (8 s, 875 KB) showing the *Keep with warning* alternative flow for the few cases where the developer knowingly proceeds.
- README rewrite: paste-guard becomes the lead visual; sidebar-v2.gif moves below into "The sidebar adapts to where you are".
- Marketplace listing now leads with the viral hook (destructive paste blocked) instead of the workflow demo.

If you have v0.3.0 installed, the upgrade is invisible — same 22 commands, same `@devmemory` chat participant, same MCP server.

## 0.3.0 — Sidebar v2, @devmemory chat participant, MCP server, git-aware memory (2026-05-04)

### New: Hybrid sidebar (webview hero + simplified TreeView)

The sidebar was a 17-item dashboard. It is now a single hero card with one primary CTA derived from your current state, plus two collapsed groups (`Today` / `Project memory` / `Settings & maintenance`). The state-aware primary action is one of: `Scan this project`, `Teach the AI about this project`, `Save what the AI told me`, `Resume an AI session`, or `Save what the AI did`.

- New view: `devmemory.heroView` (webview) — colors derive from your VS Code theme; refreshes every 30s.
- New view: `devmemory.actionsView` (TreeView) — three groups, project-memory and settings collapsed by default.
- `Refresh View`, `Add Manual Session Note`, and `Quarantine Flagged Sessions` are no longer shown in the sidebar (still available via Command Palette).

### New: Native walkthrough on first install

VS Code's `contributes.walkthroughs` shows a 4-step onboarding the first time DevMemory activates in a workspace: Scan → Paste guard demo → Resume an AI session → Connect Claude/Cursor/Cline/Continue. Re-open any time via `DevMemory AI: Open Welcome Walkthrough`.

### New: Aggressive vocabulary refresh (intent-language)

Every command title and message has been rewritten in user-intent language. No command IDs changed; existing keybindings keep working.

| Old | New |
|---|---|
| Set Up Memory | Scan This Project |
| Teach DevMemory About This Project | Teach The AI About This Project |
| Save Project Understanding | Save What The AI Told Me |
| Start AI Session | Resume AI Session |
| End AI Session | Wrap Up Session |
| Save Session Summary | Save What The AI Did |
| Check Memory Quality | Check Memory Health |
| Open Memory Files | Open Memory Folder |
| Add Session Summary | Add Manual Session Note |
| Export AI Context Files | Export Context To CLAUDE.md / AGENTS.md / Copilot / Cursor |

### New: Status bar surface (paste-guard count + memory age)

`$(book) DevMemory: 2d` shows how stale the local memory is; `$(shield) 3` shows how many destructive pastes the guard caught in this workspace this lifetime. Both are clickable and refresh every 30s.

### New: `@devmemory` chat participant in Copilot Chat / VS Code Chat

Type `@devmemory /resume` inside Copilot Chat (or any VS Code Chat host) and DevMemory streams the resume prompt directly into chat. **Zero clipboard hops.** Subcommands:

- `/resume` — inject a fresh resume prompt with current memory.
- `/decisions` — show the decisions log.
- `/architecture` — show the architecture summary.
- `/save-session <pasted-AI-response>` — validate and save a session.

DevMemory does not call any model — the participant only feeds context. Toggle with `devmemory.registerChatParticipant` (default `true`).

### New: 5 Language Model Tools (callable by Cline / Continue / Copilot agents)

Any chat agent that uses the VS Code Language Model Tool API can now call DevMemory automatically:

- `devmemory_getProjectSummary` — returns project-summary.md content.
- `devmemory_getArchitecture` — returns architecture.md content.
- `devmemory_getCurrentState` — returns current-state.md content.
- `devmemory_searchDecisions` — searches the decisions log.
- `devmemory_auditAiResponse` — runs the destructive-command validator on AI-produced text.

### New: MCP server (`devmemory.enableMcp`)

DevMemory now ships a self-contained MCP (Model Context Protocol) server at `dist/mcp-server.js`. Run **DevMemory AI: Enable MCP Server** to write `.vscode/mcp.json` with a managed block — Claude Code, Cursor (MCP-aware), Cline, Continue, and any MCP client auto-discover the server. Tools exposed: `memory.read`, `memory.search`, `memory.audit`, `memory.appendSession`. Resources: `devmemory://workspace/<section>`. Pure stdio JSON-RPC; never opens a network port; opt-in via setting `devmemory.exposeMcpServer`.

### New: Git-aware passive memory

DevMemory now subscribes to the built-in `vscode.git` API. After every commit, you get a low-key prompt: "DevMemory: you just committed '<msg>'. Save a session draft so the AI remembers this change?" Three options: `Wrap up & save`, `Not now`, `Don't ask for this commit`. Toggle with `devmemory.autoAttachContext` (default `true`).

### Other

- `engines.vscode` bumped to `^1.97.0` (chat participant + LM tools require it).
- `extension.ts` refactored from 1300 lines to ~660; views and helpers extracted into `src/views/`, `src/chat/`, `src/mcp/`, `src/audit/`, `src/guards/`.
- VSIX size: ~128 KB (under the 500 KB Marketplace verifier limit). Two bundles now: `extension.js` + `mcp-server.js`.
- Smoke tests cover all 22 commands plus the new chat-participant and walkthrough surfaces.

## 0.2.0 — Inline AI paste guard, FSL license, universal repositioning (2026-05-03)

### New: Inline AI paste guard

DevMemory now inspects every paste larger than 200 characters (configurable via `devmemory.pasteGuard.minChars`) for destructive shell commands and AI-hallucination markers before they land in your editor. Detection is local, vscode-free, and runs against an extended set of 22+ patterns:

- Filesystem destruction: `rm -rf`, `sudo rm`, `find / -delete`, `mkfs`, `dd if=/dev/zero of=/dev/sda`, `wipefs`, `chmod -R 777 /`, raw writes to block devices.
- Git destruction: `git reset --hard`, `git push --force(-with-lease)`, `git clean -fdx`, `git branch -D`.
- Database destruction: `DROP DATABASE/SCHEMA/TABLE`, `TRUNCATE TABLE`, `DELETE FROM <table>` without `WHERE`.
- System destruction: fork bombs, `shutdown`/`reboot`/`halt`/`poweroff`.
- Windows destruction: `format C:`, `rmdir /s /q C:\`, `del /f /s /q C:\*`.
- Remote-code shapes: `curl … | sh`, `eval $(curl …)`.
- Simulated content (`fake`, `simulação`, `fictitious`).

When a `blocking` finding is detected, DevMemory shows a modal with **Undo paste / Keep with warning / Add to allowlist** options. Tests, docs, and `.ai-memory/` are exempt by default (see `devmemory.pasteGuard.allowedFileGlobs`). Every event is appended to `.ai-memory/sessions/<ts>-paste-guard.md` so health checks can find them later. Disable per workspace with `DevMemory AI: Disable Paste Guard (Workspace)` or globally via `devmemory.pasteGuard.enabled`.

### New: Local-only telemetry (opt-in, off by default)

Flip `devmemory.telemetry.enabled` to start appending one JSON line per command/event to `.ai-memory/telemetry/events-YYYYMMDD.jsonl`. Strings that look like file paths, URLs, emails, or opaque secrets are scrubbed before write. Three new commands surface it: `View Local Telemetry`, `Export Local Telemetry (CSV)`, `Clear Local Telemetry`. **Never sent over the network.**

### New: 6 stack-aware technology profiles

`@devmemory/core` now ships with `nextjs`, `django`, `fastapi`, `rails`, `flutter-mobile`, and `rust-web` profiles (in addition to the existing 11). First-run scan now produces useful include/exclude rules for those stacks out of the box.

### Breaking / cleanup

- `MemoryConfig.llmProvider` field removed (it was unused since 0.1.0). Existing `.ai-memory/config.json` files keep working — the field is silently ignored when present.
- License switched from `DevMemory AI Beta License` (which forbade commercial use and redistribution) to **Functional Source License 1.1 with Apache 2.0 future grant** (FSL-1.1-Apache-2.0). The codebase auto-converts to Apache 2.0 on **2028-04-28**. Permitted Purpose covers internal use, education, research, and any commercial use that is not a "Competing Use" (offering DevMemory or a substantially similar product as a service). See `LICENSE.md`.
- `NOTICE.md` added at the repo root with third-party attribution and trademark acknowledgements.

### Repositioning

- Hero copy now leads with universal developer pain ("AI keeps forgetting your codebase, suggesting `rm -rf`") instead of compliance jargon. The compliance posture lives in a focused subsection and `docs/positioning.md`.
- Marketplace listing rewritten: 18 keywords (was 14), gallery banner, `qna: marketplace`, `version: 0.2.0` (no longer `preview: true`).

### Tests

- 184 vitest cases in `@devmemory/core` (was 116) — adds full coverage for paste-guard validators, simulation detection, and local telemetry redaction/rotation.
- 5 mocha smoke tests in the VS Code extension host (was 4) — adds a paste-guard insertion smoke test.

## 0.1.2 — Marketplace icon refresh (2026-04-28)

- Replaced the Marketplace / extension icon with the DevMemory AI waveform mark.
- Kept the Activity Bar icon aligned with the same visual identity.

## 0.1.1 — Marketplace Preview copy update (2026-04-28)

- Published as a Visual Studio Marketplace Preview extension under the `devmemory-ai` publisher.
- Updated README and license language from closed-beta / pre-Marketplace wording to public-preview wording.
- Added the Marketplace sidebar screenshot to the extension README.

## 0.1.0 — First beta (2026-04-28)

First installable beta of the DevMemory AI VS Code extension. Initially distributed as a verified `.vsix`.

### Positioning

DevMemory AI is positioned as **local, auditable project memory for AI coding sessions in security-conscious engineering teams** (fintech, healthtech, govtech, defense, consultancies under NDA). Workspace-only, no telemetry, no network, AI-agnostic via clipboard.

### Guided flow

- **Set Up Memory** — workspace scan with ~140 strict exclusion patterns and `.ai-memory/` scaffold.
- **Teach DevMemory About This Project** / **Save Project Understanding** — bootstrap memory with help from any AI assistant via clipboard.
- **Start AI Session** — generates a resume prompt that primes the AI with current project memory.
- **End AI Session** / **Save Session Summary** — wrap-up prompt and validated apply step that updates `current-state.md`, `tasks/next-actions.md`, and writes a session log under `.ai-memory/sessions/`.
- **Check Memory Quality** — writes `.ai-memory/health-check.md` and surfaces missing files, leftover placeholders, sessions with warnings, and manifest issues.
- **Quarantine Flagged Sessions** — moves session logs containing a `## DevMemory Warnings` block into `.ai-memory/quarantine/sessions/`.
- **Export AI Context Files** — writes a clearly marked managed block (`<!-- devmemory:managed:start --> … <!-- devmemory:managed:end -->`) into `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and (optionally) `.cursorrules`. Existing human content outside the markers is preserved on every export.

### Safety guardrails

- Sidebar always exposes the single next recommended action.
- *Save Session Summary* runs a preview that warns on:
  - simulated/fictitious content (e.g. `simulação`, `fake`, `fictitious`),
  - destructive commands in `COMMANDS_RUN` (`rm -rf`, `git reset --hard`, `drop database`),
  - paths in `FILES_TOUCHED` that don't exist in the workspace,
  - sessions that look empty or non-informative (all sections `None`/empty, including bulleted `- None`, or `CURRENT_STATE` reduced to generic "no changes / no work / known issues: none" phrases).
- Warnings never block the apply — they're persisted into the session log under `## DevMemory Warnings` so health checks can find them.
- *Export AI Context Files* refuses to write when memory is missing or still contains placeholder content; never overwrites human-authored content outside the managed markers.

### Packaging & verification

- Extension is bundled with esbuild into a single `dist/extension.js`, so the `.vsix` does not need to ship `node_modules` or the `@devmemory/core` workspace package.
- `npm run package:vscode` from the repo root produces and **verifies** the `.vsix` (cross-platform, yauzl-based: required files present, forbidden paths absent, packaged `package.json` shape is correct, size under 500 KB).
- 116 unit tests in core, 4 smoke tests inside the VS Code extension host (via `@vscode/test-electron`).
