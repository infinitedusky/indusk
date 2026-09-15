---
title: "Hook cwd independence — Implementation"
date: 2026-09-15
status: approved
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Hook cwd independence — Implementation

## Goal

Every InDusk hook loads no matter which directory the session's shell last
`cd`'d into. Today each is registered as `node .claude/hooks/<name>.js`, a
path relative to the cwd Claude Code runs hooks in; from `apps/indusk-mcp` the
file is not found, node exits 1, and the gate is silently off. After this
plan the command is `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/<name>.js` in
every project `init` or `update` touches, and in this repository.

## Scope

### In Scope
- `hookCommand(name)` as the one definition of a hook's registered command;
  `init` and `update` both use it
- `absolutizeHookCommands(projectRoot)`: `update` rewrites a command exactly
  equal to the old relative form, and nothing else
- This repository's `.claude/settings.json`
- The hooks guide says where hooks run from; the CLAUDE.md gotcha becomes the
  rule; a changelog line

### Out of Scope
- The thin lane (`indusk run` invokes gate scripts by path, not via settings)
- A session launched from a subdirectory (`CLAUDE_PROJECT_DIR` is then that
  directory — the same failure as today, not a worse one)
- Row terminality at close, the seven-day retrospective health error, the
  gate ledger, the `runHook` helper migration — carried, see the brief

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `src/__tests__/hook-cwd-independence.test.ts`, RED | `helpers/cli.ts` (`runCli`, `SHOULD_SKIP`), `helpers/hook-runner.ts` fixtures' impl shape for a Gate B refusal |
| Build Phase 1 | `src/lib/hook-command.ts`; `init.ts` / `update.ts` on it; this repo's settings; docs | the test file |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | On a project set up by `indusk init`, the registered `check-gates` command run from a subdirectory through `sh -c` with `CLAUDE_PROJECT_DIR` set to the project root refuses a Gate B checkoff (exit 2) with the same stderr the root gives; today it exits 1 with a module-not-found error | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A2 | After `indusk init`, every command under `hooks.*[].hooks[].command` in `.claude/settings.json` matches `^node "\$\{CLAUDE_PROJECT_DIR\}"/\.claude/hooks/[\w.-]+\.js$` | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A3 | `indusk update` on a project seeded with the six relative commands leaves six absolute ones, and the parsed file equals the seeded file with only those six strings replaced | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A4 | A second `indusk update` leaves `settings.json` byte-identical, and a seeded `node .claude/hooks/check-gates.js --strict` survives both updates unchanged | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A5 | `init.ts`, `update.ts` and this repository's `.claude/settings.json` contain no `node .claude/hooks/` | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author A1–A5 against today's `init`, `update` and settings, each red on its own assertion.

- [ ] Create/confirm this plan's worktree: `git worktree add ../dusk-worktrees/hook-cwd-independence -b plan/hook-cwd-independence main` (dusk is flat, so plain git; worktree-per-plan default); `pnpm install` and `pnpm --filter @infinitedusky/indusk-mcp build` there so the CLI-spawning tests do not skip
- [ ] Write `apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts` with a fixture: a temp dir with `package.json`, `git init`, then `runCli(dir, ["init", "--local", "--no-index"])` (the flat shape `detect-tooling-honesty.test.ts` uses); a second helper seeds `.claude/settings.json` by hand with the six relative commands (copied from `init.ts`'s `hookConfig`) plus `.indusk/config.json` and the hook files, for the `update` cases
- [ ] Author A1: write an impl whose Build Phase 1 has a `written` row and a checked-off Verification (the shape `gateTransition` in `helpers/hook-runner.ts` builds), read the `check-gates` command out of the settings file init wrote, and spawn it twice with `spawnSync("sh", ["-c", command], { cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, input: JSON.stringify(event) })` — once with `cwd: dir`, once with `cwd: join(dir, "apps/x")` (created) — expect both exit 2 with equal stderr. RED today: the subdirectory run exits 1 with `Cannot find module`
- [ ] Author A2: parse the settings file init wrote, collect every `command` under `hooks`, expect each to match the absolute pattern. RED today: six relative commands
- [ ] Author A3: on the seeded project run `update`; parse before and after; build `expected` from `before` by replacing each of the six commands with `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/<name>.js`; expect `after` to deep-equal `expected`. RED today: commands unchanged
- [ ] Author A4: seed a seventh hook entry `node .claude/hooks/check-gates.js --strict`; run `update` twice; expect the file after run 2 byte-equal to after run 1, and the `--strict` command present unchanged after both. RED today on the first half by way of A3 (six commands still relative is not what run 1 must produce), so assert the six absolute forms here too
- [ ] Author A5: read `apps/indusk-mcp/src/bin/commands/init.ts`, `update.ts` and `.claude/settings.json` (paths from `REPO_ROOT` the way `hooks-record-parity.test.ts` resolves them); expect no line to contain `node .claude/hooks/`. RED today: ten source hits and six settings hits

#### Test Phase 1 Verification
- [ ] All five red on their own assertion, none on a load error: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-cwd-independence.test.ts` — expected: 5 failed, each failure message naming the assertion (exit 1 vs 2 / relative command / unchanged command / hits found); then `cd` back to the worktree root
- [ ] Rows A1–A5 set to `written`
- [ ] Shape (Test Phase 1, recorded by hand — the Shape library addresses phases by number and cannot see a test phase): review the test file against the typescript and testing craft prose

#### Test Phase 1 Context
- [ ] Known Gotchas, the hook-cwd entry: add the distinction A1 makes concrete — once a hook *loads*, it already resolves the state path from `event.cwd` via `_hook-paths.js`, so the load is the entire defect; the fix is the registered command, not the hooks

#### Test Phase 1 Document
- [ ] `apps/docs/src/changelog.md` Unreleased, Fixed: "Hook commands load from any cwd. Every hook was registered as `node .claude/hooks/<name>.js`, relative to the directory Claude Code runs hooks in, which is the session's current directory; after a Bash call ending in a subdirectory every gate failed to load with a non-blocking exit 1 and was silently off. `init` and `update` now register `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/<name>.js`, and `update` rewrites the old form in place."

### Build Phase 1: Register hooks by the project root

- [ ] `apps/indusk-mcp/src/lib/hook-command.ts`: `export function hookCommand(name: string): string` returning `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/${name}`; `export const LEGACY_HOOK_COMMAND = /^node \.claude\/hooks\/([\w.-]+\.js)$/`; `export function absolutizeHookCommands(projectRoot: string): { rewritten: string[] }` that walks `settings.hooks[event][].hooks[].command` the way `removeLegacyHooks` does, replaces an exact `LEGACY_HOOK_COMMAND` match with `hookCommand(name)`, writes only when something changed (tab-indented, trailing newline, like `hook-migration.ts`), and treats absent or unparseable settings as nothing to do
  ```typescript
  export function hookCommand(name: string): string {
  	return `node "\${CLAUDE_PROJECT_DIR}"/.claude/hooks/${name}`;
  }
  ```
- [ ] `init.ts` `hookConfig` block: the six literals become `hookCommand("check-gates.js")` etc.
- [ ] `update.ts`: the three ensure blocks (eval-trigger, workbench-sync, claude-md-budget) use `hookCommand(...)`; after the ensure blocks, call `absolutizeHookCommands(projectRoot)` and print `  hook commands: N rewritten to "${CLAUDE_PROJECT_DIR}" form` when N > 0
- [ ] This repository's `.claude/settings.json`: the six commands to the absolute form by hand (dusk has no global `indusk update`)
- [ ] `apps/indusk-mcp/src/lib/hook-migration.test.ts` (the existing `removeLegacyHooks` suite) gains one case that `absolutizeHookCommands` on a settings file with no hooks key returns `{ rewritten: [] }` and writes nothing — the "absent is nothing to do" contract, cheaper here than through the CLI

#### Build Phase 1 Verification
- [ ] A1–A5 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-cwd-independence.test.ts` — expected: 5 passed; then `cd` back to the worktree root
- [ ] The neighbours still pass: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/init-globsync-hooks.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/telemetry-existing-project-upgrade.test.ts src/__tests__/detect-tooling-honesty.test.ts` — expected: all pass
- [ ] `pnpm check` from the worktree root reports nothing new against the changed files (the pre-existing admin SVG / eval-trigger / biome-schema findings are not this plan's)
- [ ] Live proof in this session: after the settings edit, from `apps/indusk-mcp` as cwd, attempt a checkoff this impl's Gate B should refuse and see the refusal; record the refusal text here
- [ ] Rows A1–A5 set to `passing`
- [ ] Shape (Build Phase 1): `prepareShapeReview` over the phase's changed files against the typescript and testing craft rules; record findings or "nothing to change"

#### Build Phase 1 Context
- [ ] Known Gotchas: replace the hook-cwd entry's "Until `hook-cwd-independence` lands, `cd` back…" tail with the rule — hook commands are registered by `hookCommand()` (`lib/hook-command.ts`) as `node "${CLAUDE_PROJECT_DIR}"/…`, never relative; a session must still be launched at the project root; pointer to `/guide/#3-hooks-enforce-what-discipline-won-t`

#### Build Phase 1 Document
- [ ] `apps/docs/src/guide/index.md`, the hooks section: one sentence after the table — hooks are registered by the project root (`${CLAUDE_PROJECT_DIR}`), run in the session's current directory, and a hook that fails to load exits 1, which Claude Code treats as non-blocking, so a relative registration is a gate that is off whenever the cwd moves

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/hook-command.ts` | new: `hookCommand`, `LEGACY_HOOK_COMMAND`, `absolutizeHookCommands` |
| `apps/indusk-mcp/src/bin/commands/init.ts` | `hookConfig` uses `hookCommand` |
| `apps/indusk-mcp/src/bin/commands/update.ts` | ensure blocks use `hookCommand`; calls `absolutizeHookCommands` |
| `apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts` | new: A1–A5 |
| `.claude/settings.json` | six commands absolute |
| `apps/docs/src/guide/index.md`, `apps/docs/src/changelog.md`, `CLAUDE.md` | record |

## Dependencies
- Built CLI in the worktree (kickoff item)

## Notes
- `${CLAUDE_PROJECT_DIR}` is quoted in the command because project paths can
  carry spaces; the host's documented example is unquoted. Quoting is the
  safer of the two and costs nothing.
- The migration matches the exact old form only. A command with arguments or
  a different path is someone's deliberate edit; rewriting it would be the
  kind of silent change this plan exists to stop.
