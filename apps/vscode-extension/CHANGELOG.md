# Changelog

## 0.1.0 — First beta (2026-04-27)

First installable beta of the DevMemory AI VS Code extension. Distributed as a `.vsix`; not on the Marketplace yet.

### Guided flow

- **Set Up Memory** — workspace scan and `.ai-memory/` scaffold.
- **Teach DevMemory About This Project** / **Save Project Understanding** — bootstrap memory with help from any AI assistant via clipboard.
- **Start AI Session** — generates a resume prompt that primes the AI with current project memory.
- **End AI Session** / **Save Session Summary** — wrap-up prompt and validated apply step that updates `current-state.md`, `tasks/next-actions.md`, and writes a session log under `.ai-memory/sessions/`.
- **Check Memory Quality** — writes `.ai-memory/health-check.md` and surfaces missing files, leftover placeholders, sessions with warnings, and manifest issues.
- **Quarantine Flagged Sessions** — moves session logs containing a `## DevMemory Warnings` block into `.ai-memory/quarantine/sessions/`.

### Safety guardrails

- Sidebar always exposes the single next recommended action.
- *Save Session Summary* runs a preview that warns on:
  - simulated/fictitious content (e.g. `simulação`, `fake`, `fictitious`),
  - destructive commands in `COMMANDS_RUN` (`rm -rf`, `git reset --hard`, `drop database`),
  - paths in `FILES_TOUCHED` that don't exist in the workspace,
  - sessions that look empty or non-informative (all sections `None`/empty, including bulleted `- None`, or `CURRENT_STATE` reduced to generic "no changes / no work / known issues: none" phrases).
- Warnings never block the apply — they're persisted into the session log under `## DevMemory Warnings` so health checks can find them.

### Packaging

- Extension is bundled with esbuild into a single `dist/extension.js`, so the `.vsix` does not need to ship `node_modules` or the `@devmemory/core` workspace package.
- `npm run package:vscode` from the repo root produces the `.vsix`.
