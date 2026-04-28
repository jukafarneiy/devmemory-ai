# Changelog

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
