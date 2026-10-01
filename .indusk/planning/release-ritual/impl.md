---
title: "The release ritual finishes itself"
status: completed
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
| T12 | A commit whose subject line is not `chore(release):` is not exempt because the same command text says `chore(release):` elsewhere — in a later `-m` body paragraph, or in an earlier command before the `git commit` — when it stages packaged paths | Build Phase 4 | Build Phase 4 | passing |
| T13 | Step 11 decides whether there is anything to release from the packaged changes since the release commit, the question `release-guard.sh` and the version line ask, never from `HEAD~1..HEAD` — after Step 10's own landing-note commit on trunk, `HEAD~1..HEAD` is that note and always reads "nothing to release" | Build Phase 4 | Build Phase 4 | passing |
| T14 | The install check refuses an install that does not match the lockfile — a devDependency, an `indusk-admin` dependency, or a version change merged from a branch and never installed — not only a missing `dependencies` entry of `indusk-mcp` | Build Phase 4 | Build Phase 4 | passing |

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
- [x] Correct the standing 1.54.0 note in `.indusk/current.md`'s shared region: it credits `d7e0061a`, a plan commit, instead of `b185e375`. The note is what every session reads at catchup, so a wrong sha there is read as fact for as long as it stands
- [x] Resync the installed copy to `.claude/skills/retrospective/SKILL.md`

- [x] **Discovered 2026-09-22**: trunk-guard's allowlist omits `.claude/skills/` and `.claude/hooks/`, which `indusk update` writes — and `update` is meant to be run on trunk. Landing 1.54.0's update left `.claude/skills/testing/SKILL.md` uncommittable without `INDUSK_TRUNK_GUARD=off`. These are installed copies the conventions already forbid editing by hand (edit `apps/indusk-mcp/skills/`, never `.claude/skills/`), so allowing them admits an update's output, not hand-written code. Same family as the rest of this plan: the ritual refusing what it itself produces

#### Build Phase 3 Verification

- [x] T8, T9 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/release-ritual-skill src/__tests__/skill-sync-parity`)
- [x] The whole suite is green (`pnpm test`), the two pre-existing `daemon-identity` failures excepted — 2026-10-01: indusk-admin 316/316; indusk-mcp 1602 passed, 9 failed, all nine the known fresh-worktree admin-bundle group (`admin-bundle-pack`, `admin-cli-lifecycle`, `cli-bare-ui-cwd-aware`), which pass 12/12 after `pnpm --filter indusk-admin build && node scripts/bundle-admin.js`; `daemon-identity` did not fail; `pnpm promises:check` exit 0

#### Build Phase 3 Context

- [x] Conventions (the publish entry): **the bump is the retrospective's Step 11**, not a thing to remember — the closing plan knows what shipped and is already on trunk, which is where the guard's own rule points

#### Build Phase 3 Document

- [x] `/reference/skills/retrospective`: Step 11, what it derives and when it skips

### Build Phase 4: Falsification — each check answers a narrower question than the one it claims

**Goal**: verify whether the attested state holds against three checks that read less than the question they stand for: the release exemption reads the whole command rather than the commit's own subject line; Step 11 asks what the *last commit* changed rather than what changed since the release; the install check asks whether `indusk-mcp`'s `dependencies` exist rather than whether the install matches the lockfile. Each trajectory row captures one hypothesis; each item captures the fix if it confirms.

- [x] Author T12, T13, T14 red before any fix: T12 in `trunk-guard-release-message.test.ts` (a `-m "feat: x" -m "chore(release): y"` commit and an `echo -m "chore(release): y"; git commit -am "feat: x"` command, each staging `src/a.ts`, each expected to refuse); T13 in `release-ritual-skill.test.ts` (Step 11's text names the release commit as its range and does not use `HEAD~1`); T14 in `release-guard-install.test.ts` (a fixture whose lockfile differs from what was installed — a devDependency added to the manifest and lockfile but not installed — expected to refuse naming `pnpm install`)
- [x] `trunk-guard.js`: the release exemption reads **this commit's own first message** — the first `-m`/`--message` value, or the `-F`/`--file` file — from `commitArgs`'s tokens, not a regex over the whole command text. A body paragraph or text outside the commit never exempts (T12)
- [x] `retrospective.md` Step 11: "is there anything to release" reads the packaged commits since the release commit — the `indusk/version` line of `check_health` reports exactly this ("N packaged commit(s) since"), or `git diff --name-only <release-commit>..HEAD` over `release-guard.sh`'s `PACKAGED_PATHS`. Drop the `HEAD~1..HEAD` command and the path list that differs from the guard's while claiming to be the same; resync `.claude/skills/retrospective/SKILL.md` (T13)
- [x] `check-install.js`: judge the install against the lockfile, which covers every workspace package, devDependencies and version changes in one comparison — pnpm records the lockfile it installed at `node_modules/.pnpm/lock.yaml`; a mismatch with `pnpm-lock.yaml` (or a missing record) refuses naming `pnpm install`. Keep the missing-dependency message as the explanation of the ordinary cause (T14)

#### Build Phase 4 Verification
- [x] T12, T13, T14 pass, and T1–T11 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/trunk-guard-release-message src/__tests__/release-guard-install src/__tests__/release-ritual-skill src/__tests__/record-release-commit src/__tests__/skill-sync-parity`) — 5 files, 48/48
- [x] `bash apps/indusk-mcp/scripts/release-guard.sh` in this worktree reaches the install check and reports it ok (the install is current here), so the new comparison does not refuse a healthy tree — the guard cannot reach it here: it exits 1 at check 2, correctly, because this unbumped branch carries packaged changes. The check run as the guard runs it, `node apps/indusk-mcp/scripts/check-install.js apps/indusk-mcp`, exits 0: "26 declared dependencies installed, install matches pnpm-lock.yaml — ok"

#### Build Phase 4 Context
- [x] Known Gotchas (the hooks entry): the release exemption reads the commit's own first message, never the surrounding command text

#### Build Phase 4 Document
- [x] `apps/docs/src/changelog.md` Unreleased and `/reference/skills/retrospective` Step 11: the release question is "packaged changes since the release commit", and the install check compares against the lockfile

### Build Phase 5: Cleanup — one trunk-guard fixture, one packaged-paths list

**Goal**: remove the two restatements this plan added across files: a third private copy of the trunk-guard test harness (Test Phase 1's own item said to reuse the existing one), and a third copy of the packaged-paths list, in Step 11's prose, outside the pin that keeps the other two in step. Basis: the rule of three, and this codebase's "one home per fact" — a list restated in prose drifts silently, the failure `version-state.test.ts` exists to prevent for the bash/TS pair.

- [x] Extract the trunk-guard fixture into `apps/indusk-mcp/src/__tests__/helpers/trunk-guard-fixture.ts`: a `trunkProject()` (git repo on `main`, `.indusk/config.json`, `src/a.ts`, seed commit, with the allow-listed files `trunk-guard.test.ts` seeds), `stage(root, rel, body)`, and the `bash` / `edit` event builders. `trunk-guard.test.ts`, `trunk-guard-falsification.test.ts` and `trunk-guard-release-message.test.ts` each define their own `project()` and `bash` today — three copies with drifted contents; all three import the helper instead, beside `test-git.ts` and `hook-runner.ts`
- [x] Step 11 (`apps/indusk-mcp/skills/retrospective.md`) stops restating the packaged paths: it names `PACKAGED_PATHS` in `apps/indusk-mcp/scripts/release-guard.sh` as the list for the `git diff` fallback, and keeps the `indusk/version` line as the primary answer. Resync the installed copy
- [x] (reviewed `hooks/trunk-guard.js` at 464 lines, over the 400 focus cap — left as-is: one hook, one decision; the commit-argument reading (`commitArgs`, `firstMessage`, `commitIntent`) has no second consumer, and a `_`-prefixed hook module by convention mirrors exactly one `src/lib` module, which this would not)
- [x] (reviewed `skills/retrospective.md`, its installed copy, `reference/skills/retrospective.md` and `changelog.md`, all over the cap — left as-is: prose documents whose length is their content; Step 11 is one step in a ritual that reads in order)
- [x] (reviewed `scripts/check-install.js` and `scripts/record-release.js` — left as-is: `record-release.js` already reuses `readRepoVersionState` rather than restating it; `check-install.js`'s two walk-ups answer different questions, a package's `node_modules` and the workspace's lockfile)

#### Build Phase 5 Verification
- [x] (no tests flip at this phase — reason: refactor) The three trunk-guard files and the release-ritual rows stay green through the extraction: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/trunk-guard src/__tests__/release-ritual-skill src/__tests__/skill-sync-parity src/__tests__/version-state` — the same test count as before the extraction, and `grep -c "^function project" src/__tests__/trunk-guard*.test.ts` reports 0 for every file

#### Build Phase 5 Context
- [x] Known Gotchas (the test-helpers entry): a trunk-guard test builds its project through `helpers/trunk-guard-fixture.ts`

#### Build Phase 5 Document
- [x] `/reference/skills/retrospective` Step 11 names `release-guard.sh`'s `PACKAGED_PATHS` as the list and restates no paths of its own — confirm or edit — confirmed no restated paths; now names `PACKAGED_PATHS` explicitly

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
