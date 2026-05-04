# Paste Guard

Whenever you paste a chunk of text larger than 200 characters into a project file, DevMemory inspects it locally for destructive shapes. If a `blocking` finding is present, the paste is intercepted and you get a modal with three options: **Undo paste**, **Keep with warning**, or **Add to allowlist**.

## What gets blocked

- `rm -rf`, `sudo rm`, `find / -delete`, `mkfs`, `dd if=/dev/zero of=/dev/sda`, `wipefs`, `chmod -R 777 /`
- `git reset --hard`, `git push --force`, `git clean -fdx`, `git branch -D` (warning)
- `DROP DATABASE / SCHEMA / TABLE`, `TRUNCATE TABLE`, `DELETE FROM <table>` without a `WHERE`
- Fork bombs, `shutdown` / `reboot`
- `format C:`, `rmdir /s /q`, `del /f /s /q`
- `curl … | sh`, `eval $(curl …)`

## Where it does not run

By default the guard skips test files, Markdown, and `.ai-memory/` (configurable in `devmemory.pasteGuard.allowedFileGlobs`). Tests and docs intentionally include destructive patterns as examples.

## Audit log

Every catch appends a line to `.ai-memory/sessions/<ts>-paste-guard.md` so the *Check Memory Health* command can flag patterns later.
