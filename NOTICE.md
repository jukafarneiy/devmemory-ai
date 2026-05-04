# NOTICE

DevMemory AI
Copyright (c) 2026 DevMemory AI authors and contributors.

This product is distributed under the Functional Source License, Version 1.1, with an Apache 2.0 future grant (FSL-1.1-Apache-2.0). See `LICENSE.md` for the full text and the conversion date.

## Third-party software

The DevMemory AI VS Code extension and its `@devmemory/core` package contain or depend on the following third-party components. Each is used under the terms of its respective license.

### Runtime dependencies (bundled into the extension)

| Component | License | Source |
|---|---|---|
| Node.js standard library (used at runtime) | MIT | https://nodejs.org/ |

The extension's bundled `dist/extension.js` is produced by esbuild and contains only first-party DevMemory code plus references to the VS Code API (provided by the host editor at runtime). It does not embed third-party runtime dependencies.

### Build / development dependencies (not shipped to end users)

| Component | License | Source |
|---|---|---|
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| esbuild | MIT | https://github.com/evanw/esbuild |
| vitest | MIT | https://github.com/vitest-dev/vitest |
| mocha | MIT | https://github.com/mochajs/mocha |
| @vscode/test-electron | MIT | https://github.com/microsoft/vscode-test |
| @vscode/vsce | MIT | https://github.com/microsoft/vscode-vsce |
| yauzl | MIT | https://github.com/thejoshwolfe/yauzl |
| @types/node, @types/vscode, @types/mocha | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

### Visual assets

- The DevMemory AI logo, sidebar icon, and Marketplace banner are © 2026 DevMemory AI authors and may not be reused outside of distributing this extension as-is.

### Trademarks

- Anthropic, Claude, Claude Code: trademarks of Anthropic PBC.
- GitHub, Copilot: trademarks of GitHub, Inc. and Microsoft Corporation.
- Cursor: trademark of Anysphere, Inc.
- Cline, Continue, Cody: trademarks of their respective owners.
- Visual Studio Code, VS Code: trademarks of Microsoft Corporation.

DevMemory AI is not affiliated with any of the above. Trademarks appear here only to identify compatibility — never to claim endorsement.

## Reporting

To report a license question, security issue, or attribution mistake, open an issue at https://github.com/jukafarneiy/devmemory-ai/issues.
