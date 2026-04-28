# DevMemory AI

DevMemory AI is a local-first memory layer for AI-assisted software projects.

This scaffold contains:

- `packages/core`: safe local scanning, `.ai-memory` file generation, and prompt composition.
- `apps/vscode-extension`: VS Code commands that call the core package.
- `docs/dev-memory-ai-product-spec.md`: the product specification that guides the MVP.

## First Commands

```bash
npm install
npm run build
```

Then open `apps/vscode-extension` in VS Code and press `F5` to launch an Extension Development Host.

You can also open the monorepo root in VS Code and use the included `Run DevMemory AI Extension` launch configuration.

## Build the beta VSIX

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

## Sidebar (Guided UX)

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

## Recommended Flow

A new user should follow this loop, all available from the sidebar:

1. **Set Up Memory** — scans the workspace, creates `.ai-memory/`, writes a manifest and starter memory files.
2. **Teach DevMemory About This Project** — generates a stack-aware prompt and copies it to your clipboard. Paste it into Claude, Codex, etc.

   After this step the sidebar pivots: *Next recommended action* becomes **Save Project Understanding**, which appears at the top of *Next Step* until you save the AI's reply. Copy the AI response and click that button; the extension reads from your clipboard, validates the four sections, and writes them into project memory. You no longer need to remember any "Apply" command.
3. **Start AI Session** — generates the resume prompt that primes the AI with current project memory.
4. **End AI Session** — copies a wrap-up prompt to your clipboard. Paste it into the AI at the end of your session.

   After the end-session prompt is generated, the sidebar pivots: *Next recommended action* becomes **Save Session Summary**, which appears at the top of *Next Step* until you save the AI's reply. You no longer need to remember any "Apply" command.
5. **Save Session Summary** — reads the AI's response from the clipboard, asks for confirmation (with safety preview), writes a session log under `.ai-memory/sessions/`, refreshes `current-state.md` and `tasks/next-actions.md`, and regenerates the resume prompt.
6. **Check Memory Quality** — audits the local store for placeholders, missing files and sessions applied with warnings, writing `.ai-memory/health-check.md`.

## Memory Health Check

*Check Memory Quality* writes `.ai-memory/health-check.md` and surfaces:

- Missing or stale files (`manifest.json`, `scan-report.md`, `project-summary.md`, `architecture.md`, `current-state.md`, `tasks/next-actions.md`, `prompts/resume-prompt.md`).
- Placeholder text still left over from initialization (e.g. "Replace these placeholders", "Document the main modules", "Summarize what this project is").
- Session logs written via *Save Session Summary* that include a `## DevMemory Warnings` block.
- Edge states such as a manifest with zero tracked files or invalid JSON.

If the status is `needs-review`, the report's **Recommendations** section points to the specific commands that fix each warning. The check is read-only beyond writing the report itself — it never re-scans the project and never modifies the managed memory files.
