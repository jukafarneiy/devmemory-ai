# Scan This Project

DevMemory builds a local Markdown summary of your repo under `.ai-memory/`.

## What gets scanned

- **Source files** matching your stack (Node/TS, Python, Go, Rust, Ruby, PHP, Java, .NET, Swift, Flutter, Next.js, Django, FastAPI, Rails, …).
- **Docs** (`README.md`, `CHANGELOG.md`, `docs/**`).
- **CI workflows** (`.github/workflows/**`).

## What is excluded by default (~140 patterns)

- `.env*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, AWS / GCP / Azure credentials.
- `terraform.tfstate`, mobile signing keys, Firebase service accounts, WordPress/Rails secrets.
- `node_modules/`, `.venv/`, `target/`, `build/`, `dist/`, `.next/`, IDE caches, virtual envs.

## Output

The scan creates `.ai-memory/scan-report.md` listing every tracked and skipped file. No file content is ever included in the report — only paths.

> Nothing leaves your machine. There is no DevMemory backend.
