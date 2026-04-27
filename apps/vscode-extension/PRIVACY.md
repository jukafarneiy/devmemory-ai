# Privacy

DevMemory AI is **local-first**. The extension never uploads your files, prompts, or memory to any server. Everything happens on your machine, inside the workspace you have open in VS Code.

## What DevMemory reads

When you run *Set Up Memory* or *Teach DevMemory About This Project*, the extension scans the active workspace to build a manifest of project files. The scan is read-only and is bounded by an ignore list.

## What is ignored

The scanner skips, by default:

- `node_modules/`, `.venv/`, `venv/`, virtual envs and dependency caches
- `.git/`, `.hg/`, `.svn/`
- `dist/`, `build/`, `out/`, `coverage/`, `.next/`, `.turbo/`, `.cache/`
- `.env` files and any path that looks like a secret store
- `.ai-memory/` itself (so memory never feeds back into the manifest)
- `.claude/`, other tool-specific local state directories
- Binary files and anything beyond a configured size threshold

If a file isn't scanned, it isn't read. The scan report (`.ai-memory/scan-report.md`) tells you exactly which files were tracked.

## What DevMemory writes

All writes are inside the workspace, under `.ai-memory/`:

- `manifest.json`, `scan-report.md`, `project-summary.md`, `architecture.md`, `current-state.md`, `tasks/next-actions.md`
- `sessions/`, `decisions/`, `issues/`, `quarantine/`
- `prompts/` (prompts you copy into your AI assistant)
- `health-check.md`

You can commit `.ai-memory/` to git or add it to `.gitignore` — your call.

## What is NOT done

- No telemetry. The extension does not collect usage data.
- No network calls. The extension does not contact any server, including Anthropic, OpenAI, or any "DevMemory" backend (there isn't one).
- No automatic uploads. Prompts are placed on your clipboard so **you** decide which AI to paste them into.
- No background scanning. Scans only run when you explicitly trigger a command that asks for them.
- No reading outside the workspace. The extension never reads files outside the folder you have open.

## You're in control

- `devmemory.confirmBeforeScan` (default: `true`) — asks for confirmation before running the workspace scan.
- *Save Session Summary* always shows a preview with warnings (simulated content, destructive commands, missing files, empty summaries) before writing anything.
- *Check Memory Quality* and *Quarantine Flagged Sessions* are read-only / move-only — they never reach out to the network.
- You can delete `.ai-memory/` at any time to wipe DevMemory's local state.

## Reporting concerns

If you find anything in the extension that looks like it leaves your machine, please open an issue with the steps to reproduce. We'll treat it as a privacy bug.
