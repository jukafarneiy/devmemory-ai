# DevMemory AI — Tracked Engineering Debt

This file lists deliberate trade-offs taken during the v0.2 "Three Bets" sprint. Each entry exists because the right move was to ship the user-visible feature *now* and revisit the cleanup later.

## High priority

### 1. `apps/vscode-extension/src/extension.ts` is 1300+ lines

**Symptom:** All 18 commands, the tree provider, the state machine, status bar, pending-action persistence, and now paste-guard / telemetry / audit wiring live in one file.

**Why we did not refactor:** The Three Bets plan explicitly excluded refactoring. Splitting it touches every command ID and risks a regression on Marketplace install hour.

**Recommended next step (post-launch):** Split into:
- `src/activation.ts` — top-level `activate` / `deactivate` and registration table.
- `src/commands/<name>.ts` — one file per command (already done for `audit/commands.ts` and `guards/pasteGuard.ts`).
- `src/views/memoryView.ts` — `DevMemoryTreeProvider`.
- `src/state.ts` — `FlowState`, `readPendingAction`, `setPendingAction`, placeholder/review detection.
- `src/commands/ids.ts` — single source of truth for command identifiers, imported by both `extension.ts` and `package.json` generation.

Acceptance: every existing smoke test passes unchanged.

### 2. `pasteGuard` allowlist regex compilation is naive

**Symptom:** `loadAllowlist` instantiates `new RegExp(entry)` with no flags or sanitization. A user-edited allowlist file with an unanchored or catastrophic regex could either swallow real findings or DOS the editor on long pastes.

**Recommended next step:** wrap user regex with `new RegExp(entry, "i")`, anchor to substring match by default, and add a 200ms timeout via `re-safe` or a manual `vm.runInNewContext` wrapper.

### 3. PasteGuard insert-detection heuristic is per-change-event, not per-paste

**Symptom:** `vscode.workspace.onDidChangeTextDocument` fires once per `TextDocumentContentChangeEvent`. A multi-cursor paste or multi-line edit produces several events that the guard treats independently. Findings track by inserted-text length, not by clipboard origin.

**Recommended next step:** subscribe to `vscode.commands.executeCommand("editor.action.clipboardPasteAction")` via the proposed `vscode.window.onDidPaste` API (when stable), or correlate consecutive change events within a 50ms window into a single virtual paste.

## Medium priority

### 4. Audit pack export folder is not zipped

**Symptom:** `devmemory.exportAuditPack` writes a folder, not a `.zip`. To attach to a vendor questionnaire, the user must zip it manually.

**Why:** Adding `archiver` (or similar) to runtime deps would push the bundled `dist/extension.js` past the 500 KB Marketplace verifier limit (zip libraries pull in zlib bindings + tar fallback that aren't free).

**Recommended next step:** either (a) shell out to the system `zip` / PowerShell `Compress-Archive` (avoids a Node dep), or (b) write a minimal stored-only ZIP encoder by hand (~120 lines, pure Node, fits the bundle budget).

### 5. Telemetry CSV export does not handle multi-day spread well

**Symptom:** `exportTelemetryAsCsv` reads every `events-*.jsonl`, concatenates, and emits one CSV. For a workspace with months of events, this is fine on disk but no incremental export.

**Recommended next step:** add a `--since=YYYY-MM-DD` option once anyone needs it. Today, premature optimization.

### 6. Marketplace icon is still placeholder

**Symptom:** `apps/vscode-extension/media/icon.png` is the previous DevMemory waveform mark; the `crea_beer_logo.jpg` in the repo root is unrelated dead-weight.

**Recommended next step:** commission new icon (chip + diff lines). Drop `crea_beer_logo.jpg`. Add the recorded GIFs (`paste-guard.gif`, `session-resume.gif`, `audit-pack.png`, `marketplace-banner.png`) referenced by the new README.

### 7. `devmemory.viewPasteGuardLog` opens the latest log only

**Symptom:** It opens whichever `*-paste-guard.md` is alphabetically last in `.ai-memory/sessions/`. Older logs are accessible only via *Open Memory Files* / file explorer.

**Recommended next step:** swap to `vscode.window.createQuickPick` over the entries when there are >1, falling back to direct open on the single-entry case.

## Low priority

### 8. `MemoryConfig.version` still pinned to 1 even after schema additions

The schema-version field has not been bumped despite the new fields nestled in the runtime (paste guard, telemetry). This is intentional — those fields live in `package.json` settings, not in `.ai-memory/config.json` — but worth flagging if we ever do add stored config keys.

### 9. README references `media/marketplace/02-sidebar.png` which still has the old screenshot

The image file exists; the screenshot it shows still reflects v0.1.x copy. Re-take after the icon refresh.

### 10. No JetBrains, Neovim, CLI ports yet

Roadmap items, not regressions. Mentioned explicitly in `apps/vscode-extension/README.md` "What's not here yet".

---

## Items deliberately NOT on this list (please do not "fix")

- Clipboard-driven workflow → still core to the AI-agnostic moat. MCP server (planned v0.4) supplements; it does not replace.
- Single-workspace memory → planned v0.5 multi-workspace work.
- Manual `verify.sh` (Bash) instead of bundled verifier → keeps the verify path inspectable; users can read 30 lines of shell + Node easily.
