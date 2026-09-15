---
title: "Hook cwd independence — Implementation"
date: 2026-09-15
status: completed
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
| A1 | On a project set up by `indusk init`, the registered `check-gates` command run from a subdirectory through `sh -c` with `CLAUDE_PROJECT_DIR` set to the project root refuses a Gate B checkoff (exit 2) with the same stderr the root gives; today it exits 1 with a module-not-found error | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A2 | After `indusk init`, every command under `hooks.*[].hooks[].command` in `.claude/settings.json` matches `^node "\$\{CLAUDE_PROJECT_DIR\}"/\.claude/hooks/[\w.-]+\.js$` | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A3 | `indusk update` on a project seeded with the six relative commands leaves six absolute ones, and the parsed file equals the seeded file with only those six strings replaced | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A4 | A second `indusk update` leaves `settings.json` byte-identical, and a seeded `node .claude/hooks/check-gates.js --strict` survives both updates unchanged | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A5 | `init.ts`, `update.ts` and this repository's `.claude/settings.json` contain no `node .claude/hooks/` | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A6 | With `CLAUDE_PROJECT_DIR` unset in the environment, the registered `check-gates` command run from the project root still loads and refuses the Gate B checkoff with exit 2 — it degrades to the old cwd-relative behaviour rather than to no gate at all | Phase 0 | Phase 2 | written | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |
| A7 | `indusk init` re-run on a project whose settings carry the six relative commands leaves exactly six hook registrations, all absolute — no second entry per matcher, no relative survivors for `update` to double later | Phase 0 | Phase 2 | written | apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author A1–A5 against today's `init`, `update` and settings, each red on its own assertion.

- [x] Create/confirm this plan's worktree: `git worktree add ../dusk-worktrees/hook-cwd-independence -b plan/hook-cwd-independence main` (dusk is flat, so plain git; worktree-per-plan default); `pnpm install` and `pnpm --filter @infinitedusky/indusk-mcp build` there so the CLI-spawning tests do not skip — 2026-09-15: created from `d01f5315`, installed offline, `tsc` built `apps/indusk-mcp/dist/bin/cli.js`. (Gate A refused this checkoff until A1–A5 were `written`: the test-first duty covers every Test Phase 1 item, setup included)
- [x] (written; `INDUSK_HOME` pointed at a temp dir and `INDUSK_SKIP_SELF_UPDATE=1` so neither CLI run touches the real registry or npm) Write `apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts` with a fixture: a temp dir with `package.json`, `git init`, then `runCli(dir, ["init", "--local", "--no-index"])` (the flat shape `detect-tooling-honesty.test.ts` uses); a second helper seeds `.claude/settings.json` by hand with the six relative commands (copied from `init.ts`'s `hookConfig`) plus `.indusk/config.json` and the hook files, for the `update` cases
- [x] (observed red: `subdirectory run: Error: Cannot find module '…/fresh/apps/x/.claude/hooks/check-gates.js' — expected 1 to be 2`; the root run refused with `Trajectory blocks phase advance`, exit 2) Author A1: write an impl whose Build Phase 1 has a `written` row and a checked-off Verification (the shape `gateTransition` in `helpers/hook-runner.ts` builds), read the `check-gates` command out of the settings file init wrote, and spawn it twice with `spawnSync("sh", ["-c", command], { cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, input: JSON.stringify(event) })` — once with `cwd: dir`, once with `cwd: join(dir, "apps/x")` (created) — expect both exit 2 with equal stderr. RED today: the subdirectory run exits 1 with `Cannot find module`
- [x] (observed red: `relative hook command registered: node .claude/hooks/check-gates.js`) Author A2: parse the settings file init wrote, collect every `command` under `hooks`, expect each to match the absolute pattern. RED today: six relative commands
- [x] (observed red: deep-equal fails on the six commands, `update` exits 0 and leaves them relative) Author A3: on the seeded project run `update`; parse before and after; build `expected` from `before` by replacing each of the six commands with `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/<name>.js`; expect `after` to deep-equal `expected`. RED today: commands unchanged
- [x] (observed red: `expected [] to have a length of 6 but got +0` — zero absolute commands after the first update) Author A4: seed a seventh hook entry `node .claude/hooks/check-gates.js --strict`; run `update` twice; expect the file after run 2 byte-equal to after run 1, and the `--strict` command present unchanged after both. RED today on the first half by way of A3 (six commands still relative is not what run 1 must produce), so assert the six absolute forms here too
- [x] (observed red: 16 offenders — ten source lines from `init.ts:1071` on and the six registered commands; the settings check parses the `hooks` registrations rather than grepping the file, because the permissions allow-list legitimately carries `Bash(node .claude/hooks/…)` strings that are not registrations) Author A5: read `apps/indusk-mcp/src/bin/commands/init.ts`, `update.ts` and `.claude/settings.json` (paths from `REPO_ROOT` the way `hooks-record-parity.test.ts` resolves them); expect no line to contain `node .claude/hooks/`. RED today: ten source hits and six settings hits

#### Test Phase 1 Verification
- [x] All five red on their own assertion, none on a load error: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-cwd-independence.test.ts` — expected: 5 failed, each failure message naming the assertion (exit 1 vs 2 / relative command / unchanged command / hits found); then `cd` back to the worktree root — 2026-09-15: `Tests 5 failed (5)`, messages quoted on each authoring item above; no load error
- [x] Rows A1–A5 set to `written`
- [x] Shape (Test Phase 1, recorded by hand — the Shape library addresses phases by number and cannot see a test phase): review the test file against the typescript and testing craft prose — reviewed `hook-cwd-independence.test.ts`: two fixtures with one job each (`initProject`, `seededProject`), one named runner for the host's invocation shape (`runRegistered`), every assertion reached over a process boundary. Left as is: `LEGACY_SETTINGS` restates `init.ts`'s pre-fix `hookConfig` literal on purpose — it is the *before* shape a migration test must pin, and importing it would make the fixture follow the fix. Nothing to change

#### Test Phase 1 Context
- [x] Known Gotchas, the hook-cwd entry: add the distinction A1 makes concrete — once a hook *loads*, it already resolves the state path from `event.cwd` via `_hook-paths.js`, so the load is the entire defect; the fix is the registered command, not the hooks

#### Test Phase 1 Document
- [x] `apps/docs/src/changelog.md` Unreleased, Fixed: "Hook commands load from any cwd. Every hook was registered as `node .claude/hooks/<name>.js`, relative to the directory Claude Code runs hooks in, which is the session's current directory; after a Bash call ending in a subdirectory every gate failed to load with a non-blocking exit 1 and was silently off. `init` and `update` now register `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/<name>.js`, and `update` rewrites the old form in place."

### Build Phase 1: Register hooks by the project root

- [x] (the rewrite keeps the file's existing indentation — `init` writes two spaces, `hook-migration.ts` writes tabs — so A3's "changes nothing else" holds byte-for-byte on either) `apps/indusk-mcp/src/lib/hook-command.ts`: `export function hookCommand(name: string): string` returning `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/${name}`; `export const LEGACY_HOOK_COMMAND = /^node \.claude\/hooks\/([\w.-]+\.js)$/`; `export function absolutizeHookCommands(projectRoot: string): { rewritten: string[] }` that walks `settings.hooks[event][].hooks[].command` the way `removeLegacyHooks` does, replaces an exact `LEGACY_HOOK_COMMAND` match with `hookCommand(name)`, writes only when something changed (tab-indented, trailing newline, like `hook-migration.ts`), and treats absent or unparseable settings as nothing to do
  ```typescript
  export function hookCommand(name: string): string {
  	return `node "\${CLAUDE_PROJECT_DIR}"/.claude/hooks/${name}`;
  }
  ```
- [x] `init.ts` `hookConfig` block: the six literals become `hookCommand("check-gates.js")` etc.
- [x] (placed as step 5c′ beside the retired-hook removal, outside the `.mcp.json` guard for the reason 5c records; A5 caught the first draft of its comment quoting the old form verbatim) `update.ts`: the three ensure blocks (eval-trigger, workbench-sync, claude-md-budget) use `hookCommand(...)`; after the ensure blocks, call `absolutizeHookCommands(projectRoot)` and print `  hook commands: N rewritten to "${CLAUDE_PROJECT_DIR}" form` when N > 0
- [x] This repository's `.claude/settings.json`: the six commands to the absolute form by hand (dusk has no global `indusk update`) — the `permissions.allow` strings that mention `node .claude/hooks/…` are shell allow-list entries, not registrations, and stay
- [x] `apps/indusk-mcp/src/lib/hook-migration.test.ts` (the existing `removeLegacyHooks` suite) gains one case that `absolutizeHookCommands` on a settings file with no hooks key returns `{ rewritten: [] }` and writes nothing — the "absent is nothing to do" contract, cheaper here than through the CLI

#### Build Phase 1 Verification
- [x] A1–A5 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-cwd-independence.test.ts` — expected: 5 passed; then `cd` back to the worktree root — 2026-09-15: 5 passed, plus 8 in `hook-migration.test.ts` (13 in the combined run)
- [x] The neighbours still pass: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/init-globsync-hooks.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/telemetry-existing-project-upgrade.test.ts src/__tests__/detect-tooling-honesty.test.ts` — expected: all pass — 2026-09-15: 4 files, 8 passed
- [x] `pnpm check` from the worktree root reports nothing new against the changed files (the pre-existing admin SVG / eval-trigger / biome-schema findings are not this plan's) — 2026-09-15: `biome check` over the five changed files reports two findings, both present on `main` before this branch (`init.ts:494` unused `noIndex`; `update.ts:4` unused `resolvePath` import); the new file and the test are clean
- [x] Live proof in this session: after the settings edit, from `apps/indusk-mcp` as cwd, attempt a checkoff this impl's Gate B should refuse and see the refusal; record the refusal text here — **done through a real Claude Code session rather than this one**, because Claude Code snapshots hook registrations at session start, so this session still runs the relative form. A fixture project was `init`ed with the rebuilt CLI (registered `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/check-gates.js`), given the A1 impl, and a headless `claude -p --model haiku --permission-mode bypassPermissions` session was told to `cd apps/x` and then Edit the checkoff. Its verbatim report: `PreToolUse:Edit hook error: [node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/check-gates.js]: Trajectory blocks phase advance (policy: auto): [<the fixture's one row>] a thing is true — state: written (Phase 1 cannot close until this row is 'passing' or 'skipped')`. The file was unchanged afterwards. (The fixture row's ID is elided here because the validator reads any `T`/`A`-number inside a Verification gate as a cross-reference to this table, and `impl-corpus.test.ts` caught the first draft quoting it — the write-time hook did not, since the edit carried no phase heading and so was not re-validated whole.) The fixture path was trusted in `~/.claude.json` for the run and the entry removed after
- [x] Rows A1–A5 set to `passing`
- [x] Shape (Build Phase 1): `prepareShapeReview` over the phase's changed files against the typescript and testing craft rules; record findings or "nothing to change" — `prepareShapeReview` returned `skipped: Phase 1's verification is not green` twice, the second time when this item was the only unchecked one in the gate: an item that records the review, placed inside the Verification gate, is itself what keeps `verificationIsGreen` false, so the library can never run from this position (the previous plan hit the same thing and recorded by hand). Reviewed by hand, the phase's five changed files against the typescript and testing prose: `hook-command.ts` has one job per function and a named `indentOf` for the one non-obvious step; `init.ts` and `update.ts` changed six literals and one call site; the migration test pins the contract that lets it run inside `update`; the settings file is data. Left as is, for `/cleanup` (inter-file, not Shape's): `absolutizeHookCommands` and `removeLegacyHooks` both walk `settings.hooks` — two copies, not three, and the walks differ in what they do to an entry. Nothing to change

#### Build Phase 1 Context
- [x] Known Gotchas: replace the hook-cwd entry's "Until `hook-cwd-independence` lands, `cd` back…" tail with the rule — hook commands are registered by `hookCommand()` (`lib/hook-command.ts`) as `node "${CLAUDE_PROJECT_DIR}"/…`, never relative; a session must still be launched at the project root; pointer to `/guide/#3-hooks-enforce-what-discipline-won-t`

#### Build Phase 1 Document
- [x] `apps/docs/src/guide/index.md`, the hooks section: one sentence after the table — hooks are registered by the project root (`${CLAUDE_PROJECT_DIR}`), run in the session's current directory, and a hook that fails to load exits 1, which Claude Code treats as non-blocking, so a relative registration is a gate that is off whenever the cwd moves

### Phase 2: Falsification — the variable unset, and init over an old project

**Goal**: verify whether the attested state holds against two failure modes found by reading the shipped command and `init`'s merge: (1) a harness or host that does not set `CLAUDE_PROJECT_DIR` turns `node "${CLAUDE_PROJECT_DIR}"/…` into `node /.claude/hooks/…`, which never loads from *any* cwd — the fix made every gate off everywhere instead of off from subdirectories (confirmed by hand on 2026-09-15: node throws module-not-found; with a `:-.` shell default it loads); (2) `init` on a project that already carries the relative form compares commands by string equality, sees six "new" absolute commands, and appends a second entry per matcher — six relative survivors that the next `update` then rewrites into six *more* absolute ones, so every hook runs twice. Each trajectory row captures one hypothesis; each checklist item the fix.

- [ ] `hookCommand(name)` returns `node "${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/<name>` — a POSIX default, so an unset variable degrades to the pre-fix cwd-relative behaviour, never to a path that cannot exist; update the test file's `ABSOLUTE_COMMAND` and the A3 expected string, this repository's six registrations, and the form quoted in the changelog, the guide and CLAUDE.md
- [ ] `init.ts` calls `absolutizeHookCommands(projectRoot)` before merging `hookConfig` into an existing settings file, so the six relative commands become the six absolute ones and `alreadyPresent` matches them instead of appending a second entry

#### Phase 2 Verification
- [ ] A6: with the variable unset from the environment, the registered command from the project root exits 2 with the Gate B message — RED today (module-not-found), green after the default lands
- [ ] A7: `init --local --no-index` on the seeded project leaves six absolute registrations and nothing relative — RED today (twelve registrations, six relative), green after init absolutizes first
- [ ] A1–A5 still green, and the corpus guard: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-cwd-independence.test.ts src/lib/hook-migration.test.ts src/__tests__/impl-corpus.test.ts` — expected: all pass; then `cd` back
- [ ] Rows A6–A7 set to `passing`
- [ ] Shape (Phase 2): the phase changes one template string and adds one call; record the review by hand as in Build Phase 1

#### Phase 2 Context
- [ ] Known Gotchas, the hook-command entry: the registered form carries a `:-.` default so a host that does not set `CLAUDE_PROJECT_DIR` gets the old cwd-relative gate rather than none; `init` absolutizes before it merges

#### Phase 2 Document
- [ ] `apps/docs/src/changelog.md` Unreleased entry and `apps/docs/src/guide/index.md`: the quoted form gains the `:-.` default, with one clause on why

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
