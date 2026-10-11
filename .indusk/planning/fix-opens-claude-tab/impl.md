---
title: "fix-opens-claude-tab"
date: 2026-10-10
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
falsification: skipped
falsification_reason: "A tiny change to where one action opens (Sandy, 2026-10-10: 'yes a tiny plan'); A1 and A2 cover both targets and the fallback, A3 the real editor."
cleanup: skipped
cleanup_reason: "One new action variant in fix.ts and its application in extension.ts; nothing to decompose."
audit: skipped
audit_reason: "A tiny plan whose one promise is tested directly by its two unit rows and one live check."
---

# fix-opens-claude-tab

## Goal

Fix with Claude opens a Claude Code tab in VS Code when the Claude Code extension is installed; the terminal remains the fallback.

## Scope

### In Scope
- `apps/vscode-extension/src/core/fix.ts`: a `claudeTab` action, chosen from the context.
- `apps/vscode-extension/src/extension.ts`: tell the core whether this is VS Code and whether Claude Code is installed; open the link.

### Out of Scope
- The cockpit's fix action.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1, A2 red | `fixAction` in the core |
| Build Phase 1 | the `claudeTab` action and its application; A3 live | Test Phase 1's rows |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | In VS Code with Claude Code installed, the fix opens `vscode://anthropic.claude-code/open?prompt=…` whose decoded prompt is exactly the prompt the terminal would have sent — the promise, symptom, trace link and tests — even when `claude` is not on the PATH | Test Phase 1 | Build Phase 1 | written | unit | promise: a-fix-opens-in-the-claude-code-tab | apps/vscode-extension/src/core/fix-tab.test.ts |
| A2 | In Cursor, or without the Claude Code extension, the fix starts `claude` in a terminal exactly as before, and with neither the extension nor `claude` on the PATH it says how to install Claude Code | Test Phase 1 | Build Phase 1 | written | unit | promise: a-fix-opens-in-the-claude-code-tab | apps/vscode-extension/src/core/fix-tab.test.ts |
| A3 | Clicking Fix with Claude on a broken promise in VS Code opens a Claude Code tab with the prompt filled in | Build Phase 1 | Build Phase 1 | planned | live check | a live check of VS Code and the Claude Code extension, which no unit can reach: Sandy clicks it once and the result is recorded under Build Phase 1 | .indusk/planning/fix-opens-claude-tab/impl.md |

## Checklist

### Test Phase 1: A1 and A2, red

**Tier**: med

- [x] Confirm this plan's worktree (`git worktree list` shows `plan/fix-opens-claude-tab`)
- [x] A1, A2 in `apps/vscode-extension/src/core/fix-tab.test.ts` against `fixAction`, passing the new context fields (`host: "vscode" | "other"`, `claudeCodeExtension: boolean`) — the core ignores unknown fields today, so the file loads and A1 fails on its assertion (it gets a terminal action); A2 passes today for the terminal cases and is the guard that they stay
- [x] A1 red on its own assertion; A2's terminal cases recorded as passing today; rows set `written`
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Test Phase 1 Verification

- [x] A1, A2 are `written`, A1 red on its assertion (`cd apps/vscode-extension && pnpm exec vitest run src/core/fix-tab.test.ts`)

### Build Phase 1: Open the Claude Code tab

**Tier**: med

- [x] `core/fix.ts`: `FixAction` gains `{ claudeTab: { uri: string } }`; `fixAction` returns it when `host === "vscode"` and `claudeCodeExtension`, with the same prompt the terminal command carries, URL-encoded into `vscode://anthropic.claude-code/open?prompt=`; otherwise the terminal action or the install message as before
- [x] `extension.ts`: pass `host` (`vscode.env.uriScheme === "vscode"`) and `claudeCodeExtension` (`vscode.extensions.getExtension("anthropic.claude-code") !== undefined`); apply `claudeTab` with `vscode.env.openExternal(vscode.Uri.parse(uri))`
- [ ] A3: Sandy clicks Fix with Claude on a broken promise in VS Code after `indusk editor install` and a window reload; record what opened here

#### Build Phase 1 Verification

- [ ] A1, A2 pass (`cd apps/vscode-extension && pnpm exec vitest run src/core`); A3 recorded; typecheck and biome clean

#### Build Phase 1 Context

- [ ] `apps/vscode-extension/CLAUDE.md`: Fix with Claude opens a Claude Code tab in VS Code when Claude Code is installed (the documented `vscode://anthropic.claude-code/open?prompt=` link, filled not sent), the terminal otherwise

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/promises-in-your-editor.md`, the Fix with Claude section; changelog `### Changed` under `## [Unreleased]`

## Files Affected

| File | Change |
|------|--------|
| `apps/vscode-extension/src/core/fix.ts` | the `claudeTab` action |
| `apps/vscode-extension/src/extension.ts` | host and extension detection; open the link |

## Dependencies

- The Claude Code extension's documented URI handler.

## Notes

- `vscode.env.openExternal` reaching Claude Code's URI handler from another extension is unverified until A3.
