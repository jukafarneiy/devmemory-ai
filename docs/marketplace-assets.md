# Marketplace assets — capture checklist

> **Status:** none of these assets exist yet. The extension's Marketplace listing will be text-only until at least the **Required** items below are captured.
>
> **Where they live:** `apps/vscode-extension/media/marketplace/`. That folder exists and is **excluded from the VSIX** by `.vscodeignore` so listing assets do not bloat the package.
>
> **How they are referenced:** Marketplace listings render Markdown images by absolute URL. Once captured, reference each asset via the GitHub raw URL of this folder, not via relative paths. Example: `https://raw.githubusercontent.com/<owner>/devmemory-ai/main/apps/vscode-extension/media/marketplace/02-sidebar.png`.
>
> **README updates only when files exist.** Do **not** add image references to the extension README until the corresponding file lands in `media/marketplace/`. Broken images on a Marketplace listing look worse than no images.

---

## Required (must have before flipping `"private": false`)

### 1. Sidebar screenshot — primary UX surface

- **File:** `apps/vscode-extension/media/marketplace/02-sidebar.png`
- **Format:** PNG, no transparency
- **Dimensions:** 1280 × 800 (or 2× retina at 2560 × 1600 if you can compress under 500 KB)
- **Max size:** 500 KB after compression
- **What it must show:**
  - The DevMemory AI Activity Bar icon, selected.
  - The Project Memory view fully expanded with all four groups visible: **Next Step**, **Daily Workflow**, **Review & Maintenance**, **Advanced**.
  - The status block at the top showing *Memory status: Ready*, *Detected technologies* with a real stack name (e.g. `TypeScript, Node.js`), *Memory quality: Healthy*, and *Next recommended action* pointing at *Start AI Session*.
  - At least one editor pane open in the background showing a representative file (a `current-state.md` is ideal).
- **Capture state:** initialize and bootstrap a clean demo workspace (see *Capture environment* below) so the sidebar reaches the *Ready* state.

### 2. Animated demo — guided onboarding

- **File:** `apps/vscode-extension/media/marketplace/demo-onboarding.gif`
- **Format:** GIF (broadest compatibility) or animated WebP
- **Dimensions:** 800 × 500
- **Max size:** 5 MB (Marketplace tolerates more, but slow listings convert worse)
- **Length:** 15 – 25 seconds, looped
- **Frames to capture, in order:**
  1. Sidebar in the *Not set up* state.
  2. Click **Set Up Memory** → confirmation modal → *Initialize* → toast *"Memory set up. Next: Teach DevMemory About This Project"* with the *Teach DevMemory* button visible.
  3. Click **Teach DevMemory About This Project** → toast *"Bootstrap prompt copied to clipboard…"* with the *Save Project Understanding* button visible.
  4. Cut to a fake AI-response paste (you can pre-load the clipboard with a known good response from `packages/core/src/aiContextExport.test.ts` `REAL_BOOTSTRAP`).
  5. Click **Save Project Understanding** → confirmation modal → *Save* → sidebar transitions to *Ready* with *Memory quality: Healthy*.
- **Recording tooling:** Kap, LICEcap, or `asciinema → agg` if you prefer terminal-style. Keep frame rate ≤ 15 fps to stay under 5 MB.

---

## Recommended (high impact, low effort)

### 3. Save Session Summary safety preview

- **File:** `apps/vscode-extension/media/marketplace/05-session-warnings.png`
- **Dimensions:** 1280 × 720
- **What it must show:** the *Save Session Summary* modal preview with at least two warnings visible (e.g. "Session summary appears empty or non-informative" and "Files Touched lists paths that do not exist…"), with the **Save Anyway** and **Cancel** buttons.
- **Why this matters for the listing:** this is the single image that communicates the *audit trail* differentiator. Capture it.
- **How to reproduce the warnings:** copy a session-end response that has `## SESSION_SUMMARY\nNone\n## CHANGES_MADE\n- None\n## FILES_TOUCHED\n- src/does-not-exist.ts\n## CURRENT_STATE\n- No project changes were made\n## NEXT_ACTIONS\nNone` to the clipboard, then run *Save Session Summary*.

### 4. Health check report

- **File:** `apps/vscode-extension/media/marketplace/06-health-check.png`
- **Dimensions:** 1280 × 720
- **What it must show:** `.ai-memory/health-check.md` open in an editor pane, with the *Status: needs-review* line visible and at least one warning ("placeholder text", "session logs flagged with DevMemory Warnings", or "manifest.json tracks 0 files") visible in the body.

### 5. Export AI Context Files quickpick

- **File:** `apps/vscode-extension/media/marketplace/07-export-quickpick.png`
- **Dimensions:** 1280 × 600
- **What it must show:** the multi-select QuickPick produced by *DevMemory AI: Export AI Context Files*, with all four targets visible (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursorrules`) and the first three checked, `.cursorrules` unchecked.
- **Why this matters:** it visualises the coexistence story with Claude Code, Codex, Copilot, and Cursor in a single frame.

---

## Optional (polish; capture if you have the time)

### 6. Hero / banner

- **File:** `apps/vscode-extension/media/marketplace/01-hero.png`
- **Dimensions:** 1280 × 640
- **What it must show:** a wide, marketing-grade composition — sidebar + an open `current-state.md` + the AI-context-export QuickPick in the corner. Title-text overlay optional ("Local, auditable project memory for AI coding sessions").
- This goes at the **very top** of the Marketplace listing, before the description text.

### 7. Set Up Memory confirmation modal

- **File:** `apps/vscode-extension/media/marketplace/03-setup-modal.png`
- **Dimensions:** 1280 × 720
- **What it must show:** the *DevMemory AI will scan only allowed project files…* warning modal, with the *Initialize* button visible. Demonstrates the confirm-before-scan default.

### 8. Teach DevMemory clipboard hand-off

- **File:** `apps/vscode-extension/media/marketplace/04-save-project-understanding.png`
- **Dimensions:** 1280 × 720
- **What it must show:** the toast *"Bootstrap prompt copied to clipboard. Paste it into your AI assistant, copy the AI's response, then click Save Project Understanding."* with both action buttons visible.

---

## Capture environment (do this once, reuse across all assets)

1. **Clean demo workspace.** Create a throwaway folder (e.g. `~/devmemory-demo/`) with a recognizable but neutral stack — a small TypeScript Node service is ideal. Avoid screenshotting any real client repo.
2. **Disable other extensions** during capture so the sidebar and notifications are uncluttered. Run VS Code with `code --disable-extensions --extensionDevelopmentPath=apps/vscode-extension` (or use the bundled VSIX in a clean profile).
3. **Theme:** pick **Dark Modern** for screenshots and the demo GIF; it gives the highest contrast and is what the largest share of users see daily. If you also want a light variant, append `-light` to the filename (e.g. `02-sidebar-light.png`) and reference it conditionally in the README only if both exist.
4. **Window chrome:** maximize the window, hide the Activity Bar tooltip, hide the breadcrumbs (`View → Appearance → Breadcrumbs`), and set zoom to 100%.
5. **Real but neutral content:**
   - Workspace folder name: `devmemory-demo` (no client/company name).
   - Files visible in editors: `current-state.md` and `architecture.md` produced by *Save Project Understanding* with the canned response in `packages/core/src/aiContextExport.test.ts` (`REAL_BOOTSTRAP`).
6. **Hide PII:** before capturing, double-check the file tree, terminal, status bar, and Git branch indicator for personal info, real account names, real client names, or anything in a `.env`.

## Privacy & legal pre-publish review

Walk every captured asset through this list before referencing it from the README:

- [ ] No real email addresses, names, repo names, or company names visible.
- [ ] No GitHub username badge in the corner that identifies the maintainer.
- [ ] No tokens or API keys in any visible terminal, file tree, or notification.
- [ ] No `.env` content visible — even if just the filename in the explorer.
- [ ] No third-party trademarks shown in a way that suggests endorsement (Anthropic, OpenAI, GitHub, Microsoft, JetBrains).
- [ ] Each file ≤ 500 KB after compression. Use `pngquant 256` for PNGs and `gifsicle -O3 --colors 128` for GIFs.
- [ ] Total `media/marketplace/` folder ≤ 5 MB.
- [ ] Filenames match this checklist exactly so future maintainers can find and replace them.

## Where to insert in the README — once the files exist

Do **not** add these references until the corresponding file lands in `media/marketplace/`. Use absolute GitHub raw URLs in the Markdown so the Marketplace renderer resolves them.

Replace `<owner>` with the actual GitHub owner before pasting.

### Snippet A — sidebar screenshot, near the "5-step flow" heading

```markdown
![DevMemory AI sidebar with the guided next-step flow](https://raw.githubusercontent.com/<owner>/devmemory-ai/main/apps/vscode-extension/media/marketplace/02-sidebar.png)
```

### Snippet B — demo GIF, immediately after the 5-step list

```markdown
![Guided onboarding: Set Up Memory → Teach DevMemory → Save Project Understanding](https://raw.githubusercontent.com/<owner>/devmemory-ai/main/apps/vscode-extension/media/marketplace/demo-onboarding.gif)
```

### Snippet C — session safety preview, in the "Security & local-first" section

```markdown
![Save Session Summary preview showing DevMemory warnings](https://raw.githubusercontent.com/<owner>/devmemory-ai/main/apps/vscode-extension/media/marketplace/05-session-warnings.png)
```

### Snippet D — health check report, in the "Security & local-first" section, below Snippet C

```markdown
![Memory health check report writing .ai-memory/health-check.md](https://raw.githubusercontent.com/<owner>/devmemory-ai/main/apps/vscode-extension/media/marketplace/06-health-check.png)
```

### Snippet E — Export AI Context Files quickpick, in the "How DevMemory compares" section

```markdown
![Export AI Context Files multi-select picker](https://raw.githubusercontent.com/<owner>/devmemory-ai/main/apps/vscode-extension/media/marketplace/07-export-quickpick.png)
```

### Snippet F — hero, at the very top of the README, immediately after the headline paragraph and before the "> Beta" callout (optional)

```markdown
![DevMemory AI: local, auditable project memory for AI coding sessions](https://raw.githubusercontent.com/<owner>/devmemory-ai/main/apps/vscode-extension/media/marketplace/01-hero.png)
```

## Out-of-scope items flagged for follow-up (no action taken in this pass)

- **`LICENSE.md` redistribution clause** still forbids third-party distribution; the Marketplace cannot host the binary as written. Adding a Marketplace carve-out paragraph (or switching to a permissive license for the beta) is a deliberate legal change for the maintainer to make. Out of scope here per the brief.
- **`"private": true`** in `apps/vscode-extension/package.json` remains intentionally on so `vsce publish` cannot fire by accident.
- **Repository URL** (`github.com/jukafarneiy/devmemory-ai`) presence/visibility is not verified from this environment.
- **`PRIVACY.md`** matches the current README and `package.json` description; no changes required for marketplace readiness.

Once the assets above are captured and the legal items are resolved, this doc can be deleted or replaced with a "How we capture marketing assets" runbook.
