---
title: "Untrack .mcp.json — a machine's MCP config is not versioned, and a clone gets its own"
date: 2026-10-11
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
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
| Test Phase 1 | T1–T6 authored; T1, T2, T3 red | today's repository, `update`, the daemon sync |
| Build Phase 1 | the file untracked; `update` creates it; docs | Test Phase 1's tests |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | `git ls-files .mcp.json` lists nothing in this repository | Test Phase 1 | Build Phase 1 | written | unit | promise: the-mcp-config-is-not-tracked | apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts |
| T2 | `git check-ignore .mcp.json` reports it ignored | Test Phase 1 | Build Phase 1 | written | unit | promise: the-mcp-config-is-not-tracked | apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts |
| T3 | In a checkout with no `.mcp.json`, `indusk update` leaves one that names the `indusk` server | Test Phase 1 | Build Phase 1 | written | unit | promise: a-clone-without-an-mcp-config-gets-the-keep-list | apps/indusk-mcp/src/__tests__/mcp-config-regenerate.test.ts |
| T4 | In that checkout with an enabled extension that declares an MCP server to add, `indusk update` also leaves that server in the file | Test Phase 1 | Test Phase 1 | blocked | unit | promise: a-clone-without-an-mcp-config-gets-the-keep-list | apps/indusk-mcp/src/__tests__/mcp-config-regenerate.test.ts |
| T5 | With an existing `.mcp.json` holding a hand-added server, `indusk update` leaves that server and its settings as they were | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-clone-without-an-mcp-config-gets-the-keep-list | apps/indusk-mcp/src/__tests__/mcp-config-regenerate.test.ts |
| T6 | A daemon restart that moves the jaeger port leaves `git status` clean in a checkout with no tracked `.mcp.json` | Build Phase 1 | Build Phase 1 | planned | unit | a regression guard over the daemon's per-project sync: the churn stops because the file is untracked, and must not come back | apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts |

## Checklist

### Test Phase 1: Author T1–T6 against today's repository and `update`

**Tier**: med — the work step's default

**Goal**: author T1–T6; T1, T2 and T3 fail on their own assertions today; T4, T5 and T6 are expected to pass today and are regression guards.

- [x] Confirm this plan's worktree (`indusk plans start` made it at `dusk-worktrees/untrack-mcp-json`)
- [x] T1, T2 (T6 deferred, see the register) in `src/__tests__/mcp-config-untracked.test.ts`: T1 and T2 shell out to git in the repository root (`ls-files`, `check-ignore`); T6 builds a temp git checkout with `.mcp.json` ignored and untracked, runs the daemon's sync function (`syncAllRegisteredProjectsMcp`, exported or reached through its CLI helper) with a new port against it, and asserts `git status --short` is empty. The file carries `promise: the-mcp-config-is-not-tracked`
- [x] T3, T5 (T4 blocked, see below) in `src/__tests__/mcp-config-regenerate.test.ts`: a temp checkout (git init, `.indusk/config.json`, no `.mcp.json`; for T4 a fixture extension manifest with an `mcp_server.add_command` that writes its entry into `.mcp.json`), `indusk update` through `helpers/cli.ts`, read the file back. The file carries `promise: a-clone-without-an-mcp-config-gets-the-keep-list`
- [x] Confirm each red test fails on its own assertion rather than on a missing import; if T4 does not pass today, record why under it and move it to Build Phase 1's Passes at with the reason
  - Confirmed 2026-10-11: T1 `` `git ls-files .mcp.json` lists the file: expected '.mcp.json' to be '' ``; T2 `` `git check-ignore .mcp.json` exits 0 when the file is ignored: expected 1 to be +0 ``; T3 `.mcp.json exists after update: expected false to be true`. T5 passes (guard).
  - **T4 cannot be authored as written.** Built-in extension manifests are overwritten from the package on `update`, and none of the package's built-in manifests declares `mcp_server.add_command` (grep over `extensions/*/manifest.json` is empty; posthog and chrome-devtools only carry `setup_instructions`). The extension-registration branch of `update` (`update.ts` ~652) therefore never fires for a built-in, and a fixture extension is either overwritten (built-in name) or handled by the third-party path. So "update adds each enabled extension's declared server" is not something `update` does today, and no row can show it without a new mechanism.
  - blocker: the second promise's sentence says one command writes the project's *declared MCP servers*; `update` can honestly write only `indusk` (T3) — jaeger arrives with the local-telemetry extension's enable or the daemon's sync, and posthog needs its token set up by hand. The promise must be narrowed, or a mechanism for built-in extensions to declare a server added.
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

- [ ] `src/lib/mcp-config.ts` (new): `ensureMcpJson(projectRoot)` writes `{ mcpServers: { indusk: { type: "stdio", command: "indusk", args: ["serve"], env: { PROJECT_ROOT: "." } } } }` when no `.mcp.json` exists and returns `"created"` or `"present"`; it never reads or rewrites an existing file (T3, T5)
- [ ] `src/bin/commands/update.ts`: call `ensureMcpJson` before the `5b` migration guard and before the extension registration loop, and print one line (`  created: .mcp.json (indusk server)` or nothing when present), so each enabled extension's `add_command` then adds its server to the new file (T3, T4)
- [ ] `git rm --cached .mcp.json` in this branch, leaving the working copy; confirm `.gitignore` line 25 still lists it (T1, T2)
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 1 Verification

- [ ] T1–T6 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/mcp-config-untracked.test.ts src/__tests__/mcp-config-regenerate.test.ts && pnpm exec vitest related src/bin/commands/update.ts src/lib/mcp-config.ts --run`); tsc and biome clean on changed files; `git ls-files .mcp.json` is empty and `git status --short` shows nothing for `.mcp.json`

#### Build Phase 1 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`: `.mcp.json` is per machine and untracked; `indusk update` creates it when absent and never rewrites an existing one; the daemon's sync edits only the local copy

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/update.md` (or the page that documents `indusk update`): the new line and the rule; changelog: Fixed — ".mcp.json is no longer tracked. After pulling, run `indusk update` once: git removes the file from your working tree on that pull, and `update` writes a fresh one"

## Files Affected

| File | Change |
|------|--------|
| `.mcp.json` | untracked (`git rm --cached`) |
| `apps/indusk-mcp/src/lib/mcp-config.ts` | new — `ensureMcpJson` |
| `apps/indusk-mcp/src/bin/commands/update.ts` | calls it |
| `apps/indusk-mcp/src/__tests__/mcp-config-untracked.test.ts`, `mcp-config-regenerate.test.ts` | new — T1–T6 |
| `apps/indusk-mcp/CLAUDE.md`, `apps/docs/src/reference/cli/update.md`, changelog | context and docs |

## Dependencies

- None.

## Notes

- Pulling this plan's landing commit deletes `.mcp.json` from every existing clone's working tree; the changelog entry and the retrospective say to run `indusk update` once.
- The daemon's per-project sync is untouched; it already writes only to a file that exists.
