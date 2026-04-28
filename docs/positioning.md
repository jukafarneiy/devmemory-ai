# DevMemory AI — Positioning & Market Validation (v0.1)

> Status: **Marketplace Preview**, no paying customers yet. This doc records the current position the project is taking — not aspirational claims.

## One-line positioning

**Local, auditable project memory for AI coding sessions in security-conscious engineering teams.**

## Ideal Customer Profile (ICP)

**Tier 1 — primary buyer.** Engineering teams of 5–50 developers in:

- Fintech and payments (PCI-DSS, SOC 2 in scope).
- Healthtech and life sciences (HIPAA, HDS, GDPR Art. 9).
- Govtech, defense contractors, and public-sector consultancies (FedRAMP-adjacent, ITAR, IL4/5, ISO 27001).
- Consultancies and agencies handling client code under NDA where SaaS AI tooling is restricted by contract.

The deciding stakeholders are typically a **head of platform engineering** or a **CISO / AppSec lead** who has either explicitly blocked Cursor / Claude Code / Copilot or is evaluating compensating controls.

**Tier 2 — secondary buyer.** Teams using on-prem or private-tenant LLMs (AWS Bedrock private endpoints, Azure OpenAI dedicated, on-prem Llama / Mistral) who need a memory layer that doesn't depend on a vendor's "memory" feature.

**Tier 3 — free / community.** OSS developers, indie hackers, and security researchers who value local-first by principle. Not the buyer; the credibility funnel.

## What we are not

- Not a replacement for Cursor, Claude Code, or Copilot. DevMemory does not generate code, complete code, or call an AI on its own.
- Not an agent framework. There is no autonomous loop and no tool-calling.
- Not a SaaS. There is no backend; everything is local files.
- Not a memory store inside an AI vendor's product. The memory is in your repo, in Markdown, on your machine.

## Differentiator hierarchy

Ordered by how defensible each is:

1. **Local-first, no network calls, no telemetry, verifiable in source.** Strongest claim. Most enterprise AI tooling cannot say this without an asterisk. Tested and grep-able.
2. **AI-response audit trail.** Saved sessions are validated (simulated content, destructive commands, missing files, empty summaries). Warnings persist in the session log; nothing is silently dropped.
3. **AI-agnostic by design.** Clipboard-based hand-off means the same memory works with Claude, Codex, Cursor, Copilot, on-prem LLMs. No tool lock-in.
4. **Markdown you can `git diff`.** The whole memory store is human-readable and version-controllable. Security and compliance can review it without a special viewer.
5. **Strict scan excludes** (`.env*`, keys, credentials, build artifacts) — table stakes for any code scanner, but explicitly tested here.

Items 1 and 2 are the only ones with real defensibility. The others are good hygiene that competitors could match in a sprint.

## What we removed from the messaging (and why)

The previous tagline was *"Local-first persistent memory for AI-assisted software projects"*. It described a feature, not a buyer pain. We removed:

- **"Persistent memory for AI-assisted projects"** — too generic; collides with everything from Cursor to Copilot to Claude Memory.
- **Implied claim of token savings** — true in some flows, unprovable for the buyer at install time, invites a "vs. Claude prompt-caching" debate we don't need to win to be useful.
- **Implied claim of being a productivity multiplier** — without telemetry we cannot evidence it, and the clipboard workflow has real friction.
- **"Multi-AI memory layer"** as a headline — kept as a feature, not as the lead. Buyers don't sign POs for "multi-AI"; they sign POs for "approved by AppSec".

## Honest comparison

DevMemory does not replace these — it organizes the structured context you can feed into them.

| Tool | What it stores | Where memory lives | AI-agnostic? | Audit trail of AI replies |
|---|---|---|---|---|
| Anthropic `CLAUDE.md` | Free-form rules / notes | Repo file Claude Code reads automatically | No (Claude Code) | No |
| `AGENTS.md` (agentic conventions) | Free-form agent guidance | Repo file | Tool-by-tool | No |
| Cursor `.cursorrules` / Cursor memories | Rules + indexed project context | Repo + Cursor-managed indices | No (Cursor) | No |
| GitHub Copilot custom instructions | Per-user / per-repo prompt prefix | GitHub-side configuration | No (Copilot) | No |
| **DevMemory AI** | Project summary, architecture, current state, next actions, decisions, bugs, validated session logs | Local `.ai-memory/` (Markdown + JSON), git-versionable | Yes (clipboard) | Yes (validated, warnings persisted) |

If a team already maintains a hand-written `CLAUDE.md` or `.cursorrules` and is satisfied, they don't need DevMemory. The DevMemory pitch only lands when one or more of: (a) AppSec restricts the cloud tool, (b) the team uses multiple AIs, or (c) compliance asks for a written record of what AI was told.

## Validation status

- **Build / tests:** 116 unit tests in core, 4 smoke tests in the extension host, build green on macOS.
- **Distribution:** Public Visual Studio Marketplace Preview listing plus verified `.vsix` builds.
- **Users:** no adoption data yet beyond the maintainers and first public listing.
- **Buyer interviews:** **not conducted.** This positioning is a hypothesis derived from internal product audit, not from primary research. Validation steps below are required before claiming product-market fit.

## Validation plan (next, not yet run)

1. 10 conversations with platform engineering or AppSec leads in Tier 1 industries. Goal: confirm the pain (cloud AI is restricted) and the willingness to use a local Markdown memory layer instead of waiting for vendor features.
2. 3 internal pilots with consultancies / agencies who already maintain notes by hand. Goal: confirm the audit-trail value lands and the clipboard friction is tolerable.
3. OSS launch (Show HN) once the comparison table and the "When DevMemory is / isn't for you" section are in the marketplace listing. Goal: stars and qualified inbound from regulated industry.

Three-month sanity metric: ≥1,500 GitHub stars **or** ≥5,000 marketplace installs **or** ≥3 qualified CISO/platform-eng conversations from regulated employers. If none, the ICP is wrong and the product needs to pivot.

## Pricing hypothesis (not yet implemented)

Documented for planning, not for marketing:

- **Free OSS core** — extension VS Code, scan, prompts, validation, single-machine. Acquisition + credibility.
- **Team SaaS** — $15 / seat / month, billed annually, minimum 5 seats. Adds E2E-encrypted sync, exportable audit log, multi-project dashboard, email support.
- **Enterprise contract** — $25K–$50K / year. Adds on-prem deployment of the sync component, SLA, integrations with Bedrock / Vertex / on-prem LLMs, signed compliance review, SSO.

No individual SaaS tier ($9 / month) — the math does not compete with Cursor's $20 (which includes the AI). The product position is "tooling for serious teams", and a $9 plan undermines that.
