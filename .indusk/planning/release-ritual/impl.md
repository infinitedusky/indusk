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
| T8 | The retrospective skill's Step 11 exists, names the changelog roll and the `chore(release):` commit, and says a plan touching no packaged paths skips it | Test Phase 1 | Build Phase 3 | passing |
| T9 | The installed copy of the retrospective skill is byte-identical to the package-owned one | Test Phase 1 | Build Phase 3 | passing |
| T10 | A `git commit` written across several lines with `\`-newline continuations, staging only allowlisted paths, is allowed — a continuation is not a pathspec. Today each one becomes a whitespace-only token that `commitIntent` classifies as a path, so the refusal lists one empty bullet per continued line | Test Phase 1 | Build Phase 1 | passing |
| T11 | `record-release.js` writes the commit matching `^chore(release): <version>` as the release commit, not whatever HEAD happens to be when it runs | Test Phase 1 | Build Phase 3 | passing |

### Trajectory Rationale

Every row is writable in Test Phase 1: the guard hook and the shell script
both exist and are reachable over a boundary (a spawned process against a
fixture repository), and the skill is a file on disk.

**T10 and T11 added 2026-09-25, after the impl was approved.** Both are the
plan's own subject and neither was covered by T1–T9:

- **T10** was found by hitting it. The commit landing this plan's own sequence
  cleanup was refused on trunk while staging nothing but `.indusk/planning/`,
  and printed nine empty bullets where the offending files should be — one per
  `\`-continued line. The `\` branch of `commitArgs` appends the escaped
  character, so `\`+newline yields a token holding a newline and `has = true`;
  the identical flags and staged set exit 0 on one line and exit 2 across
  several. T3 is the neighbouring row, but a continuation is a different
  spelling and passes T3's fix untouched — the phantom token is not the message.
- **T11** is the second wrong fact in `record-release.js`. It labels
  `git rev-parse --short HEAD` the release commit, so the note it appends to
  the shared region of `.indusk/current.md` credits 1.54.0 to `d7e0061a` (a
  plan commit) instead of `b185e375`. Five publish attempts moved HEAD before
  the recording run reached that line. The health line's version state already
  resolves the release commit correctly; this is the same lookup, in the writer.

**T9 is a regression guard, not a red row.** Run against the skill as it stood
before Step 11 (`e880f999^`), T8's three cases fail on their own assertions and
T9 passes — the two copies were already byte-identical, and T9 exists to keep
them so once Step 11 edits one of them.

## Checklist

### Test Phase 1: Author every row against today's behaviour, RED

- [x] Create this plan's worktree with `indusk worktree create release-ritual` (done — the plan reads from it)
- [x] Author T1–T5 in `apps/indusk-mcp/src/__tests__/trunk-guard-release-message.test.ts`, driving the hook the way Claude Code does: a fixture repo on `main`, a staged set, and a `{tool_name: "Bash", tool_input: {command}}` envelope on stdin. Reuse the existing `trunk-guard.test.ts` harness rather than restating it
- [x] Author T6, T7 in `apps/indusk-mcp/src/__tests__/release-guard-install.test.ts` — run `scripts/release-guard.sh` against a fixture and read its exit code and stderr, never its internals
- [x] Author T8, T9 in `apps/indusk-mcp/src/__tests__/release-ritual-skill.test.ts` — read the skill text; T9 is the byte-equality check the existing parity test already makes for every skill, asserted here for the one this plan edits
- [x] Author T10 in the same `trunk-guard-release-message.test.ts` file — the same staged set and the same flags, once on one line and once across `\`-continued lines, asserting the pair agree. The one-line form passing is what makes the multi-line form's refusal a defect rather than a policy
- [x] Author T11 in `apps/indusk-mcp/src/__tests__/record-release-commit.test.ts` — a fixture repo with a `chore(release): <v>` commit and at least one commit after it, asserting the recorded sha is the release commit and not HEAD. The extra commit is the whole test: a fixture where they coincide cannot fail
- [x] Run each file and read each failure: every row fails on its own assertion

#### Regression Guards

- **T5**, **T7** — both pass the moment they are written. T5 guards against the `-F` fix becoming "any `-F` is exempt"; T7 guards the install check against refusing a healthy tree. Declared rather than dressed up as red.

#### Test Phase 1 Verification

- [x] T1–T11 authored; T5, T7 and T9 pass; every other row fails on its own assertion (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/trunk-guard-release-message src/__tests__/release-guard-install src/__tests__/release-ritual-skill src/__tests__/record-release-commit`)

#### Test Phase 1 Context

- [x] (none needed — asked: "Test Phase 1 only authors tests against today's behaviour; the conventions it establishes are recorded by Build Phases 1–3, which is where they belong. Skip the Context gate?" — user: "Skip both")

#### Test Phase 1 Document

- [x] (none needed — asked: "Test Phase 1 writes tests only; there is no user-facing surface until the fixes land. Skip the Document gate?" — user: "Skip both")

### Build Phase 1: trunk-guard reads the message it is given

- [x] `-F <file>` and `--file=<file>`: read the file, apply the `chore(release):` exemption on its first line. The file is read, never trusted by its presence
- [x] A `-m` value containing a command substitution (`$(…)`, backticks) or a heredoc is **unreadable, not a path list** — today its words are tokenized as filenames, which is why a heredoc release commit is refused with the commit message printed under "refusing to commit code"
- [x] When the message is unreadable and the staged set is not allowlisted, the refusal names that: the message could not be read, so the `chore(release):` exemption could not be checked — pass it with `-m "…"` or `-F <file>`
- [x] Update the hook's header comment to describe what the exemption reads
- [x] A `\`-newline continuation is whitespace, not a token: `commitArgs`'s backslash branch must not carry an escaped newline into the current token, and `commitIntent` must reject a whitespace-only token as a pathspec. Both halves — one fix leaves the other spelling live (T10)

#### Build Phase 1 Verification

- [x] T1, T2, T3, T4 pass and T5 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/trunk-guard`)

#### Build Phase 1 Context

- [x] Known Gotchas (the hooks entry): trunk-guard's `chore(release):` exemption reads `-m`, `-F` and `--file`; a message from a substitution is unreadable and refused **by that name**, never tokenized into paths

#### Build Phase 1 Document

- [x] `/guide/#3-hooks-enforce-what-discipline-won-t`: how the release exemption is recognised, and what to do when a message cannot be read

### Build Phase 2: the release guard proves the tree builds

- [x] `release-guard.sh` runs `pnpm install --frozen-lockfile` (or verifies the install matches the lockfile) before returning ok, and refuses naming the command to run when it does not. Implemented as the second option and as **its own script** (`scripts/check-install.js`): the guard's last check asks the npm registry, so the guard as a whole cannot be run hermetically, while this one is pure filesystem and is tested directly. It runs before the network. This is the failure that costs the most: today it surfaces *after* npm authentication, halfway through `prepublishOnly`
- [x] The refusal explains the ordinary cause — a dependency added on a plan branch, merged, and never installed on trunk

#### Build Phase 2 Verification

- [x] T6 passes and T7 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/release-guard-install`)

#### Build Phase 2 Context

- [x] Known Gotchas (the publish entry): merging a branch brings a dependency's manifest change, not its install — `release-guard.sh` checks the install before npm is touched

#### Build Phase 2 Document

- [x] `apps/docs/src/changelog.md`: an Unreleased entry for the release ritual

### Build Phase 3: the bump belongs to the retrospective

- [x] `apps/indusk-mcp/skills/retrospective.md` gains **Step 11: Bump** after the landing step — derive whether the landed plan touched packaged paths; if it did, choose the increment from what the plan did (a feature is minor, a fix is patch) and the summary from the retrospective just written; roll the changelog's `[Unreleased]` to `[X.Y.Z] — <date>` leaving a fresh empty `[Unreleased]`; commit as `chore(release): X.Y.Z — <summary>` with a literal `-m`; then say that `pnpm release` is the operator's call
- [x] A plan that changed no packaged paths records that it skipped the bump and why — the step must distinguish "nothing to release" from "did not run"
- [x] `apps/indusk-mcp/scripts/record-release.js` resolves the release commit by its message (`^chore(release): <version>`), not `git rev-parse HEAD` (T11). Reuse the lookup the health line's version state already does rather than restating it — two readers of "which commit is this release" disagreeing is the defect, not the lookup
- [ ] Correct the standing 1.54.0 note in `.indusk/current.md`'s shared region: it credits `d7e0061a`, a plan commit, instead of `b185e375`. The note is what every session reads at catchup, so a wrong sha there is read as fact for as long as it stands
- [x] Resync the installed copy to `.claude/skills/retrospective/SKILL.md`

- [ ] **Discovered 2026-09-22**: trunk-guard's allowlist omits `.claude/skills/` and `.claude/hooks/`, which `indusk update` writes — and `update` is meant to be run on trunk. Landing 1.54.0's update left `.claude/skills/testing/SKILL.md` uncommittable without `INDUSK_TRUNK_GUARD=off`. These are installed copies the conventions already forbid editing by hand (edit `apps/indusk-mcp/skills/`, never `.claude/skills/`), so allowing them admits an update's output, not hand-written code. Same family as the rest of this plan: the ritual refusing what it itself produces

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
