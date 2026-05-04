# Resume An AI Session

The resume prompt primes whatever AI you're using with the current project memory: project summary, architecture, current state, recent decisions, next actions.

## Two ways to use it

### A. Inside Copilot Chat / VS Code Chat (no clipboard)

Type `@devmemory /resume` in the chat. DevMemory streams the resume prompt directly into chat. The model that answers is whatever is selected in the chat.

### B. Copy-paste into any other AI

Run `Resume AI Session` from the sidebar or palette. The prompt lands on your clipboard. Paste into Claude Code, Cursor, Cline, Continue, ChatGPT, Bedrock, Llama — anything that takes pasted input.

## What the prompt contains

- Stack-aware "you are continuing work on this project" preamble.
- The latest contents of `project-summary.md`, `current-state.md`, `architecture.md`, `commands.md`, and `tasks/next-actions.md`, with managed-marker headers stripped.
- Privacy rules: do not request or expose secrets / credentials / tokens / private databases.

The prompt also asks the AI to restate the current objective and propose the smallest safe next step — that single line catches most context-loss issues right away.
