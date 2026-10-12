---
title: "Untrack .mcp.json — a machine's MCP config is not versioned, and a clone gets its own"
date: 2026-10-11
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
cleanup: skipped
cleanup_reason: "reviewed all 11 changed files (listOversizedChangedFiles flagged three: changelog.md at 1070 lines is append-only and gained one entry; telemetry.ts at 501 lines shrank by 59 lines in this plan, its private file helpers moved to lib/mcp-config.ts; update.ts at 1015 lines is a long-standing command function this plan touched with one 10-line named helper and one call). The new lib/mcp-config.ts is 103 lines of one file's reads, writes and defaults with one reason to change, and its three consumers (telemetry.ts, update.ts, plan-worktree-commands.ts) each import it once. The only repetition is the 'is indusk on the PATH' probe, now in mcp-config.ts and in init.ts's server-add command (two copies, below the rule of three; init's is a shell string inside a larger command and is left to the next plan that touches init). The three test files share no helper beyond the fixtures that already exist. Nothing warrants extraction."
accepted: 2026-10-12T01:19:57.897Z
accepted_by: person
---

# Untrack .mcp.json

## Goal

`.mcp.json` stops being versioned here, `indusk update` writes one when a checkout has none, and a daemon restart leaves `git status` clean (brief promises 1 and 2).

## Scope

### In Scope
- `git rm --cached .mcp.json` (the ignore rule already exists).
- `indusk update`: create `.mcp.json` with the `indusk` server when absent, before the extension registrations run; never touch an existing one.
- A test of the daemon's sync against an untracked file.

### Out of Scope
- Several telemetry instances and per-instance ports (`instance-ports`, backlog).
- A tracked `.mcp.json.example` (only if Build Phase 1's tests show it is needed).
- Changing what `init` writes.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | T1–T3, T5, T6 authored; T1, T2, T3 red | today's repository, `update`, the daemon sync |
| Build Phase 1 | the file untracked; `update` creates it; docs | Test Phase 1's tests |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | `git ls-files .mcp.json` lists nothing in this repository | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-mcp-config-is-not-tracked | apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts |
| T2 | `git check-ignore .mcp.json` reports it ignored | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-mcp-config-is-not-tracked | apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts |
| T3 | In a checkout with no `.mcp.json`, `indusk update` leaves one that names the `indusk` server | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-clone-without-an-mcp-config-gets-the-keep-list | apps/indusk-mcp/src/__tests__/mcp-config-regenerate.test.ts |
| T5 | With an existing `.mcp.json` holding a hand-added server, `indusk update` leaves that server and its settings as they were | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-clone-without-an-mcp-config-gets-the-keep-list | apps/indusk-mcp/src/__tests__/mcp-config-regenerate.test.ts |
| T6 | A daemon restart that moves the jaeger port leaves `git status` clean in a checkout with no tracked `.mcp.json` | Build Phase 1 | Build Phase 1 | passing | unit | a regression guard over the daemon's per-project sync: the churn stops because the file is untracked, and must not come back | apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts |
| T7 | With a registered project that has no `.mcp.json`, pointing its jaeger entry at a port leaves a file that names both the `indusk` and the `jaeger` server | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-clone-without-an-mcp-config-gets-the-keep-list | apps/indusk-mcp/src/__tests__/mcp-config-regenerate.test.ts |
| T8 | A plan worktree made by `indusk worktree create` from a checkout that has a `.mcp.json` has one too, with the same servers | Build Phase 2 | Build Phase 2 | passing | unit | falsification of Build Phase 1: a tracked file reached every worktree for free; an untracked one reaches none, and the default workflow gives every plan its own worktree | apps/indusk-mcp/src/__tests__/mcp-config-worktree.test.ts |

## Checklist

### Test Phase 1: Author T1–T3, T5, T6 against today's repository and `update`

**Tier**: med — the work step's default

**Goal**: author T1–T3, T5, T6; T1, T2 and T3 fail on their own assertions today; T5 passes today and is a regression guard; T6 is deferred to Build Phase 1 (see the register).

- [x] Confirm this plan's worktree (`indusk plans start` made it at `dusk-worktrees/untrack-mcp-json`)
- [x] T1, T2 (T6 deferred, see the register) in `src/__tests__/mcp-config-untracked.test.ts`: T1 and T2 shell out to git in the repository root (`ls-files`, `check-ignore`); T6 builds a temp git checkout with `.mcp.json` ignored and untracked, runs the daemon's sync function (`syncAllRegisteredProjectsMcp`, exported or reached through its CLI helper) with a new port against it, and asserts `git status --short` is empty. The file carries `promise: the-mcp-config-is-not-tracked`
- [x] T3, T5 (T4 blocked, see below) in `src/__tests__/mcp-config-regenerate.test.ts`: a temp checkout (git init, `.indusk/config.json`, no `.mcp.json`; for T4 a fixture extension manifest with an `mcp_server.add_command` that writes its entry into `.mcp.json`), `indusk update` through `helpers/cli.ts`, read the file back. The file carries `promise: a-clone-without-an-mcp-config-gets-the-keep-list`
- [x] Confirm each red test fails on its own assertion rather than on a missing import; if T4 does not pass today, record why under it and move it to Build Phase 1's Passes at with the reason
  - Confirmed 2026-10-11: T1 `` `git ls-files .mcp.json` lists the file: expected '.mcp.json' to be '' ``; T2 `` `git check-ignore .mcp.json` exits 0 when the file is ignored: expected 1 to be +0 ``; T3 `.mcp.json exists after update: expected false to be true`. T5 passes (guard).
  - **T4 cannot be authored as written.** Built-in extension manifests are overwritten from the package on `update`, and none of the package's built-in manifests declares `mcp_server.add_command` (grep over `extensions/*/manifest.json` is empty; posthog and chrome-devtools only carry `setup_instructions`). The extension-registration branch of `update` (`update.ts` ~652) therefore never fires for a built-in, and a fixture extension is either overwritten (built-in name) or handled by the third-party path. So "update adds each enabled extension's declared server" is not something `update` does today, and no row can show it without a new mechanism.
  - Resolved 2026-10-11 (Sandy: "narrow it"): T4 is retired and the second promise now reads "one `indusk` command writes one that names the `indusk` server, and never overwrites a `.mcp.json` that exists"; the brief, test plan and registry say the same. (was: blocker: the second promise's sentence says one command writes the project's *declared MCP servers*; `update` can honestly write only `indusk` (T3) — jaeger arrives with the local-telemetry extension's enable or the daemon's sync, and posthog needs its token set up by hand. The promise must be narrowed, or a mechanism for built-in extensions to declare a server added.)
  - Also measured: `indusk update` in a checkout whose `local-telemetry` is not yet enabled enables it, **starts a real daemon**, and writes a `.mcp.json` holding only `jaeger`. In the dusk clone, where the extension directories already existed, it wrote nothing. Tests must pin `INDUSK_SKIP_TELEMETRY_AUTOSTART=1`, as T3 and T5 do.

#### Deferred to Build Phase 1

- **T6** — its subject (`upsertJaegerEntry` and the per-project sync) is private to `bin/commands/telemetry.ts`, so a unit test cannot import it; reaching it through the CLI starts a daemon, which belongs to the system tier, not this suite. Build Phase 1 moves the three small file helpers into `src/lib/mcp-config.ts` (exported, with `ensureMcpJson`), and T6 is authored there. Body reviewed:

  ```typescript
  // src/__tests__/mcp-config-untracked.test.ts — added in Build Phase 1
  it("T6: syncing a new jaeger port leaves git status clean in a checkout with an ignored, untracked .mcp.json", () => {
  	const dir = tempGitCheckout({ ignore: [".mcp.json"] });
  	writeFileSync(join(dir, ".mcp.json"), `${JSON.stringify({ mcpServers: { jaeger: { type: "http", url: "http://localhost:1/mcp" } } })}\n`);
  	upsertJaegerEntry(dir, 60734);
  	expect(git(dir, ["status", "--short"]).stdout.trim()).toBe("");
  });
  ```

#### Regression Guards

- **T5** — the existing-file branch of `update` never rewrites a server it did not add; the row pins that the new step is a create-if-missing, not a merge.
- **T6** — the file being untracked makes the churn invisible to git; the row pins that the sync keeps writing only to the untracked copy.

#### Test Phase 1 Verification

- [x] T1, T2, T3, T5 authored; T1, T2, T3 red on their own assertions, T5 passes; T4 blocked and T6 deferred, both recorded above (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/mcp-config-untracked.test.ts src/__tests__/mcp-config-regenerate.test.ts`)
  - Ran 2026-10-11: untracked 2 failed (T1, T2); regenerate 1 failed (T3), 1 passed (T5); tsc not run (tests only).

### Build Phase 1: Untrack it, and let `update` write it

**Tier**: med — the work step's default

**Goal**: the file is untracked, a checkout without one gets one from `indusk update`, and the documentation says so.

- [x] `src/lib/mcp-config.ts` (new, also now home of `readMcpJson`, `writeMcpJson`, `upsertJaegerEntry`, `removeJaegerEntry`, moved out of `bin/commands/telemetry.ts` so T6 has a subject): `ensureMcpJson(projectRoot, { globalBinary })` writes `{ mcpServers: { indusk: { type: "stdio", command: "indusk", args: ["serve"], env: { PROJECT_ROOT: "." } } } }` when no `.mcp.json` exists and returns `"created"` or `"present"`; it never reads or rewrites an existing file (T3, T5)
- [x] `src/bin/commands/update.ts`: call `ensureMcpJson` before the `5b` migration guard and before the extension registration loop, and print one line (`  created: .mcp.json (indusk server)` or nothing when present), so each enabled extension's `add_command` then adds its server to the new file (T3)
- [x] `git rm --cached .mcp.json` in this branch, leaving the working copy; confirm `.gitignore` line 25 still lists it (T1, T2)
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-11 (`mcp-config.ts`, `update.ts`, `telemetry.ts`, the two tests): one finding, fixed in place — the inline create-if-missing block in `update`'s long body wanted a name, now `ensureProjectMcpJson` (rule: an inline block that has one job is a named function). Nothing else: `mcp-config.ts` is five small functions over one file with one reason to change; `telemetry.ts` lost its private copies and gained one import.

#### Build Phase 1 Verification

- [x] T1–T3, T5, T6 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/mcp-config-untracked.test.ts src/__tests__/mcp-config-regenerate.test.ts && pnpm exec vitest related src/bin/commands/update.ts src/lib/mcp-config.ts --run`); tsc and biome clean on changed files; `git ls-files .mcp.json` is empty and `git status --short` shows nothing for `.mcp.json`
  - Ran 2026-10-11: `mcp-config-untracked` + `mcp-config-regenerate` 5/5 (T1, T2, T3, T5, T6); `vitest related` 2 files 13/13; `tsc --noEmit` clean; biome clean on the changed files. `git ls-files .mcp.json` empty after `git rm --cached`; no leaked telemetry processes after the runs.

#### Build Phase 1 Context

- [x] `apps/indusk-mcp/CLAUDE.md`: `.mcp.json` is per machine and untracked; `indusk update` creates it when absent and never rewrites an existing one; the daemon's sync edits only the local copy

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/update.md` (or the page that documents `indusk update`): the new line and the rule; changelog: Fixed — ".mcp.json is no longer tracked. After pulling, run `indusk update` once: git removes the file from your working tree on that pull, and `update` writes a fresh one"

### Build Phase 2: Falsification — the file the tooling creates, and the checkouts it never reaches

**Tier**: med — the work step's default

**Goal**: verify whether the attested state holds against two failure modes found by reading Build Phase 1's code. (1) The daemon's sync creates `.mcp.json` too (`upsertJaegerEntry` writes `{ mcpServers: {} }` plus `jaeger` when the file is missing), so after the untracking pull deletes the file, the next daemon restart can leave one holding only `jaeger`; `ensureMcpJson` then sees it "present" and `indusk update` never adds the `indusk` server — the very flow the changelog tells people to run. (2) The tracked file reached every plan worktree for free; an untracked one reaches none, and `createPlanWorktree` (behind `plans start` and `worktree create`) is a plain `git worktree add`, so every new plan's Claude Code session starts with no indusk or jaeger server. T7 and T8 are authored red first.

- [x] T7 and T8 authored red, each failing on its own assertion (a file with only `jaeger`; a worktree with no `.mcp.json`)
  - Confirmed 2026-10-11: T7 `the file names both servers: expected [ 'jaeger' ] to deeply equal [ 'indusk', 'jaeger' ]`; T8 `.mcp.json exists in the new worktree: expected false to be true`.
- [x] `src/lib/mcp-config.ts`: `upsertJaegerEntry` creates a missing file through `ensureMcpJson` (binary form detected inside, `which indusk`) before it writes the jaeger entry, so a file the tooling creates always names `indusk` (T7); `ensureMcpJson`'s `globalBinary` becomes optional and defaults to that detection
- [x] `src/lib/worktree/plan-worktree-commands.ts`: after `git worktree add`, `createPlanWorktree` copies the trunk's `.mcp.json` into the new worktree when the trunk has one and the worktree does not, else calls `ensureMcpJson`; never overwrites a file the worktree has (T8)
  - Done as `provisionMcpJson(fromProject, toProject)` in `lib/mcp-config.ts`, called once from `createPlanWorktree`, which both `plans start` and `worktree create` go through.
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-11 (`mcp-config.ts`, `plan-worktree-commands.ts`, `update.ts`, the three tests): nothing found. `mcp-config.ts` is one file's reads, writes and defaults (seven small functions, one reason to change); `provisionMcpJson` is called from the one place a worktree is made; `update`'s helper lost its own binary probe now that `ensureMcpJson` owns it.

#### Build Phase 2 Verification

- [x] T7 and T8 fail on their own assertions first, then pass; T1–T3, T5, T6 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/mcp-config-untracked.test.ts src/__tests__/mcp-config-regenerate.test.ts src/__tests__/mcp-config-worktree.test.ts && pnpm exec vitest related src/lib/mcp-config.ts src/lib/worktree/plan-worktree-commands.ts --run`); tsc and biome clean on changed files; no telemetry process left running
  - Ran 2026-10-11: `mcp-config-untracked` + `mcp-config-regenerate` + `mcp-config-worktree` 7/7 (T1–T3, T5–T8); `vitest related` 7 files 27/27; `tsc --noEmit` clean; biome clean. Telemetry process count unchanged before and after.

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/CLAUDE.md`: the rule's last sentence says `createPlanWorktree` gives a new worktree its own `.mcp.json` (copied from the trunk), and that anything that creates the file creates it through `ensureMcpJson`

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/tools/indusk-mcp.md`: one sentence in "`.mcp.json` is per machine": a new plan worktree gets a copy of the trunk's file; changelog entry extended

## Files Affected

| File | Change |
|------|--------|
| `.mcp.json` | untracked (`git rm --cached`) |
| `apps/indusk-mcp/src/lib/mcp-config.ts` | new — `ensureMcpJson` |
| `apps/indusk-mcp/src/bin/commands/update.ts` | calls it |
| `apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts`, `mcp-config-regenerate.test.ts` | new — T1–T3, T5, T6 |
| `apps/indusk-mcp/CLAUDE.md`, `apps/docs/src/reference/cli/update.md`, changelog | context and docs |

## Dependencies

- None.

## Notes

- Pulling this plan's landing commit deletes `.mcp.json` from every existing clone's working tree; the changelog entry and the retrospective say to run `indusk update` once.
- The daemon's per-project sync is untouched; it already writes only to a file that exists.
