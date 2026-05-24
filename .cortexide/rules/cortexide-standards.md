# CortexIDE Engineering Standards

This file is auto-injected into every CortexIDE agent session for this workspace.
Rules defined here take precedence over the agent's default preferences.

## Code Quality

- **TypeScript strict mode** is mandatory. Never use `any` or `unknown` without explicit narrowing.
- All `catch` blocks must re-throw, fire an error event, or surface a user notification. Silent swallowing is a bug.
- No hardcoded hex colors in React components — use `var(--cortex-*, fallback)` CSS custom properties.

## Architecture Layers

This codebase has three strictly enforced layers:
- `common/` — platform-agnostic. No DOM, no Node, no Electron APIs.
- `browser/` — DOM + VS Code browser APIs. No Node.
- `electron-main/` — Node + Electron only. No DOM.

Never import `browser/` from `common/`, or `electron-main/` from `browser/`.

## Security Rules

- All child processes must be spawned via `spawn(command, argsArray)` — never via string interpolation.
- Never log, telemetry, or transmit API keys. Route all credentials through `ICortexideSettingsService`.
- Run `secretDetectionService.scan()` on all user content before it reaches an LLM provider.

## Testing

- Every new `IService` needs at least one unit test.
- New IPC channels need integration smoke tests.

## PR Checklist

Before every PR:
1. `npm run buildreact` — zero errors
2. `npx tsc --noEmit --skipLibCheck` — zero errors  
3. No hardcoded colors, no `console.log` debug statements
4. No `@ts-ignore` without explanation comment
