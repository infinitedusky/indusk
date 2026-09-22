---
title: "The release ritual finishes itself"
status: approved
date: 2026-09-21
trajectory: required
test_phases: required
gate_policy: ask
---

# Implementation

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | A `chore(release):` commit on trunk whose message is supplied with `-F <file>` is allowed | Test Phase 1 | Build Phase 1 | passing |
| T2 | The same with `--file=<file>` is allowed | Test Phase 1 | Build Phase 1 | passing |
| T3 | A `-m` message produced by a command substitution does not have its words read as paths — a commit staging only allowlisted paths is allowed, not refused with the message text listed as files | Test Phase 1 | Build Phase 1 | passing |
| T4 | When the message cannot be read and the staged set is not allowlisted, the refusal says the message was unreadable and names `-m`/`-F`, instead of only claiming code is being committed | Test Phase 1 | Build Phase 1 | passing |
| T5 | A non-release commit supplied with `-F` is still refused when it stages packaged paths — the file is read, not trusted | Test Phase 1 | Build Phase 1 | passing |
| T6 | `release-guard.sh` refuses, naming `pnpm install`, when a declared dependency is not linked into the package — before any npm call | Test Phase 1 | Build Phase 2 | passing |
| T7 | `release-guard.sh` still passes on a tree whose install is current | Test Phase 1 | Build Phase 2 | passing |
| T8 | The retrospective skill's Step 11 exists, names the changelog roll and the `chore(release):` commit, and says a plan touching no packaged paths skips it | Test Phase 1 | Build Phase 3 | planned |
| T9 | The installed copy of the retrospective skill is byte-identical to the package-owned one | Test Phase 1 | Build Phase 3 | planned |

### Trajectory Rationale

Every row is writable in Test Phase 1: the guard hook and the shell script
both exist and are reachable over a boundary (a spawned process against a
fixture repository), and the skill is a file on disk.

## Checklist

### Test Phase 1: Author every row against today's behaviour, RED

- [ ] Create this plan's worktree with `indusk worktree create release-ritual` (done — the plan reads from it)
- [x] Author T1–T5 in `apps/indusk-mcp/src/__tests__/trunk-guard-release-message.test.ts`, driving the hook the way Claude Code does: a fixture repo on `main`, a staged set, and a `{tool_name: "Bash", tool_input: {command}}` envelope on stdin. Reuse the existing `trunk-guard.test.ts` harness rather than restating it
- [x] Author T6, T7 in `apps/indusk-mcp/src/__tests__/release-guard-install.test.ts` — run `scripts/release-guard.sh` against a fixture and read its exit code and stderr, never its internals
- [ ] Author T8, T9 in `apps/indusk-mcp/src/__tests__/release-ritual-skill.test.ts` — read the skill text; T9 is the byte-equality check the existing parity test already makes for every skill, asserted here for the one this plan edits
- [ ] Run each file and read each failure: every row fails on its own assertion

#### Regression Guards

- **T5**, **T7** — both pass the moment they are written. T5 guards against the `-F` fix becoming "any `-F` is exempt"; T7 guards the install check against refusing a healthy tree. Declared rather than dressed up as red.

#### Test Phase 1 Verification

- [ ] T1–T9 authored; T5 and T7 pass; every other row fails on its own assertion (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/trunk-guard-release-message src/__tests__/release-guard-install src/__tests__/release-ritual-skill`)

#### Test Phase 1 Context

- [x] (none needed — asked: "Test Phase 1 only authors tests against today's behaviour; the conventions it establishes are recorded by Build Phases 1–3, which is where they belong. Skip the Context gate?" — user: "Skip both")

#### Test Phase 1 Document

- [x] (none needed — asked: "Test Phase 1 writes tests only; there is no user-facing surface until the fixes land. Skip the Document gate?" — user: "Skip both")

### Build Phase 1: trunk-guard reads the message it is given

- [x] `-F <file>` and `--file=<file>`: read the file, apply the `chore(release):` exemption on its first line. The file is read, never trusted by its presence
- [x] A `-m` value containing a command substitution (`$(…)`, backticks) or a heredoc is **unreadable, not a path list** — today its words are tokenized as filenames, which is why a heredoc release commit is refused with the commit message printed under "refusing to commit code"
- [x] When the message is unreadable and the staged set is not allowlisted, the refusal names that: the message could not be read, so the `chore(release):` exemption could not be checked — pass it with `-m "…"` or `-F <file>`
- [x] Update the hook's header comment to describe what the exemption reads

#### Build Phase 1 Verification

- [x] T1, T2, T3, T4 pass and T5 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/trunk-guard`)

#### Build Phase 1 Context

- [ ] Known Gotchas (the hooks entry): trunk-guard's `chore(release):` exemption reads `-m`, `-F` and `--file`; a message from a substitution is unreadable and refused **by that name**, never tokenized into paths

#### Build Phase 1 Document

- [ ] `/guide/#3-hooks-enforce-what-discipline-won-t`: how the release exemption is recognised, and what to do when a message cannot be read

### Build Phase 2: the release guard proves the tree builds

- [x] `release-guard.sh` runs `pnpm install --frozen-lockfile` (or verifies the install matches the lockfile) before returning ok, and refuses naming the command to run when it does not. Implemented as the second option and as **its own script** (`scripts/check-install.js`): the guard's last check asks the npm registry, so the guard as a whole cannot be run hermetically, while this one is pure filesystem and is tested directly. It runs before the network. This is the failure that costs the most: today it surfaces *after* npm authentication, halfway through `prepublishOnly`
- [x] The refusal explains the ordinary cause — a dependency added on a plan branch, merged, and never installed on trunk

#### Build Phase 2 Verification

- [x] T6 passes and T7 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/release-guard-install`)

#### Build Phase 2 Context

- [ ] Known Gotchas (the publish entry): merging a branch brings a dependency's manifest change, not its install — `release-guard.sh` checks the install before npm is touched

#### Build Phase 2 Document

- [ ] `apps/docs/src/changelog.md`: an Unreleased entry for the release ritual

### Build Phase 3: the bump belongs to the retrospective

- [ ] `apps/indusk-mcp/skills/retrospective.md` gains **Step 11: Bump** after the landing step — derive whether the landed plan touched packaged paths; if it did, choose the increment from what the plan did (a feature is minor, a fix is patch) and the summary from the retrospective just written; roll the changelog's `[Unreleased]` to `[X.Y.Z] — <date>` leaving a fresh empty `[Unreleased]`; commit as `chore(release): X.Y.Z — <summary>` with a literal `-m`; then say that `pnpm release` is the operator's call
- [ ] A plan that changed no packaged paths records that it skipped the bump and why — the step must distinguish "nothing to release" from "did not run"
- [ ] Resync the installed copy to `.claude/skills/retrospective/SKILL.md`

#### Build Phase 3 Verification

- [ ] T8, T9 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/release-ritual-skill src/__tests__/skill-sync-parity`)
- [ ] The whole suite is green (`pnpm test`), the two pre-existing `daemon-identity` failures excepted

#### Build Phase 3 Context

- [ ] Conventions (the publish entry): **the bump is the retrospective's Step 11**, not a thing to remember — the closing plan knows what shipped and is already on trunk, which is where the guard's own rule points

#### Build Phase 3 Document

- [ ] `/reference/skills/retrospective`: Step 11, what it derives and when it skips

## Deferred Verification

- **The ritual end to end (U1)**
  - reason: the proof is a real publish, which needs npm credentials and a
    one-time password an agent cannot enter.
  - would require: a registry account and 2FA in CI.
  - mitigation: the next plan to close runs Step 11 for real and its
    retrospective records whether `pnpm release` then succeeded with no hand
    edits — this plan's own close is that first run, so the evidence arrives
    immediately rather than being scheduled.

## Files Affected

- `apps/indusk-mcp/hooks/trunk-guard.js` — message reading
- `apps/indusk-mcp/scripts/release-guard.sh` — install check
- `apps/indusk-mcp/skills/retrospective.md` + `.claude/skills/retrospective/SKILL.md` — Step 11
- `apps/indusk-mcp/src/__tests__/` — three new test files
- `apps/docs/src/` — guide, reference, changelog
