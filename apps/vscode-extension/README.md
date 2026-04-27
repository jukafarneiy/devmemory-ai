# DevMemory AI — VS Code Extension (Beta)

Local-first persistent memory for AI coding sessions. Everything DevMemory writes lives under `.ai-memory/` inside your workspace; nothing leaves your machine automatically.

## Install the beta (.vsix)

This beta is distributed as a `.vsix` file and is **not** on the Marketplace yet.

1. Build the package:
   ```bash
   npm install
   npm run package:vscode
   ```
   `package:vscode` runs `prepackage:vscode` automatically (build + tests) before invoking `vsce package`. The result is `apps/vscode-extension/devmemory-ai-vscode-0.1.0.vsix`.
2. In VS Code: `Extensions` view → `…` menu → **Install from VSIX…** → pick the `.vsix`.
3. Reload VS Code if prompted. A **DevMemory AI** icon appears in the Activity Bar.

> Or from the CLI: `code --install-extension apps/vscode-extension/devmemory-ai-vscode-0.1.0.vsix`.

## Guided flow (5 minutes)

Open the **DevMemory AI** view in the Activity Bar — the sidebar always shows the next recommended action. Run them top-to-bottom the first time:

1. **Set Up Memory** — scans the workspace and creates `.ai-memory/` with a manifest and starter files.
2. **Teach DevMemory About This Project** — copies a stack-aware prompt to your clipboard. Paste it into your AI assistant (Claude, Codex, etc.).
3. **Save Project Understanding** — pastes the AI's reply back. The extension validates the four required sections and writes them into memory.
4. **Start AI Session** — copies a fresh resume prompt that primes the AI with current memory.
5. **End AI Session** — copies a wrap-up prompt for the AI to fill in at the end of your session.
6. **Save Session Summary** — reads the AI's reply from the clipboard, shows a safety preview (warns on simulated content, missing files, destructive commands, or empty summaries), then logs the session and refreshes `current-state.md` and `tasks/next-actions.md`.
7. **Check Memory Quality** — audits the local store and writes `.ai-memory/health-check.md`.

## What gets written, where

Everything DevMemory creates is inside the workspace:

- `.ai-memory/manifest.json` — files DevMemory scanned.
- `.ai-memory/project-summary.md`, `architecture.md`, `current-state.md`, `tasks/next-actions.md` — managed memory files.
- `.ai-memory/sessions/` — one markdown log per saved session.
- `.ai-memory/decisions/`, `.ai-memory/issues/` — append-only logs for decisions and bugs.
- `.ai-memory/prompts/` — generated prompts you copy into your AI.
- `.ai-memory/health-check.md` — the most recent health-check report.
- `.ai-memory/quarantine/` — sessions you chose to set aside via *Quarantine Flagged Sessions*.

You can commit `.ai-memory/` to git or add it to `.gitignore` — both are valid choices.

## Privacy

DevMemory is local-first. See `PRIVACY.md` (shipped alongside this README in the extension package) for details on what is read, what is ignored (`.env`, `.git`, `.venv`, `node_modules`, etc.), and the fact that no data is uploaded.

## Reporting feedback during the beta

Open an issue in the project repository, or include the contents of `.ai-memory/health-check.md` when describing problems — it's the fastest way for us to understand the state of your memory store.
