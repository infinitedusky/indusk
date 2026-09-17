---
title: "Trunk guard — Implementation"
date: 2026-09-17
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Trunk guard — Implementation

## Goal

No code is edited or committed on `main` by an agent. A PreToolUse hook
refuses an Edit, Write or `git commit` that touches a non-allow-listed path
while the repository is on a protected branch, naming `indusk worktree
create <plan>` as the way through. Planning documents, lessons, settings and
CLAUDE.md stay editable on trunk; a `chore(release):` commit is exempt; two
visible off switches exist. Registered by `init`, ensured by `update`, and
on in this repository.

## Scope

### In Scope
- `apps/indusk-mcp/hooks/trunk-guard.js` — two matchers in one file
- `init.ts` hook config and `update.ts` ensure block; this repo's settings
- `helpers/hook-runner.ts` `HookName`
- Docs: hooks guide, worktree reference, CLAUDE.md line, changelog

### Out of Scope
- Writes hidden inside arbitrary Bash commands (the commit gate is the second
  line); remote branch protection; retroactive moves

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `src/__tests__/trunk-guard.test.ts` (A1–A4, A6), `trunk-guard-registration.test.ts` (A5, A7), RED | `helpers/hook-runner.ts`, `helpers/versioned-workbench.ts`, `helpers/cli.ts`, `helpers/test-git.ts` |
| Build Phase 1 | the hook | the tests |
| Build Phase 2 | registration in `init`/`update`/this repo; docs | the hook |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | On `main`, an Edit/Write to a source file is refused naming `indusk worktree create` and the branch; the same edit on `plan/x` is allowed silently | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A2 | On `main`, edits to `.indusk/**`, `.claude/lessons/**`, `.claude/settings.json`, `CLAUDE.md`, `AGENTS.md` are allowed | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A3 | On `main`, `git commit` with a staged source file is refused naming the file; allow-listed-only staging is allowed; a `chore(release):` commit is allowed; a non-commit Bash command is ignored | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A4 | In a one-repo versioned workbench, an edit in the code repo on its `main` is refused and an edit to the workbench's `.indusk/planning/**` is allowed, over every layout | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A5 | `indusk init` registers the hook under the Edit/Write matcher and the Bash matcher; `indusk update` adds both to a project lacking them; a second `update` is byte-identical | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/trunk-guard-registration.test.ts |
| A6 | `worktree.trunk_guard.enabled: false` or `INDUSK_TRUNK_GUARD=off` allows A1's edit and the hook writes nothing | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A7 | This repository's `.claude/settings.json` registers the hook under both matchers in the `hookCommand` form | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/trunk-guard-registration.test.ts |
| A8 | On `main` with a source file staged, a commit spelled with git options before the verb — `git -C <repo> commit -m …`, `git -c user.name=x commit -m …`, `git --no-pager commit -m …` — is refused like the plain form; and `cd <repo> && git commit -m …` run from an unrelated cwd is judged against `<repo>`, not the cwd | Build Phase 3 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/trunk-guard-falsification.test.ts |
| A9 | On `main` with a source file staged, a commit wrapped in a quoted or substituted command — `bash -c "git commit -m …"`, `sh -c 'git commit …'`, `$(git commit …)`, a backtick form — is refused; `echo "git commit"` and `git commitment` stay allowed | Build Phase 3 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/trunk-guard-falsification.test.ts |
| A10 | On `main` with nothing staged and a tracked source file modified, `git commit -am …` (the combined short flag) and `git commit -m … <path>` (an explicit pathspec) are refused naming the file, because both commit it without staging; `git commit -m …` with nothing staged stays allowed | Build Phase 3 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/trunk-guard-falsification.test.ts |
| A11 | One `ensureHookRegistered(settings, event, matcher, hookFile)` puts a hook's command into the group with that matcher — adding to the group when it exists, creating the group when it does not, returning false and changing nothing when a command naming that hook file is already there — and it is the only way `init` and `update` register a hook: the five hand-rolled sites (eval-trigger, workbench-sync, claude-md-budget and trunk-guard in `update.ts`; the merge loop in `init.ts`) are gone, and A5 plus `hook-cwd-independence` still pass through it | Build Phase 4 | Build Phase 4 | planned | apps/indusk-mcp/src/__tests__/hook-registration.test.ts |

### Deferred Verification

None.

## Checklist

### Test Phase 1: Author every assertion RED

**Goal**: every row exists as a test and fails on its own claim before the
hook exists. A1–A4 and A6 spawn a hook file that does not exist yet — a
spawned process on a missing path is a boundary red (node exits non-zero
before any assertion of ours runs), not a load error inside the test file.

- [x] Create/confirm this plan's worktree (`git worktree add ../dusk-worktrees/trunk-guard -b plan/trunk-guard` — dusk is normal-mode, so `indusk worktree create` does not apply) — worktree-per-plan default; this plan is the one that makes trunk edits refuse, so it runs on a branch from the first commit — `/Users/the_dusky/code/sandbox/dusk-worktrees/trunk-guard` on `plan/trunk-guard` from `086c9da7`
- [x] `src/__tests__/trunk-guard.test.ts`: A1, A2, A3, A6 against a temp git repo (`helpers/test-git.ts`) on `main` and on `plan/x`; A4 over `LAYOUTS` from `helpers/versioned-workbench.ts`
- [x] `src/__tests__/trunk-guard-registration.test.ts`: A5 via `runCli(dir, ["init", "--local", "--no-index"])` then a seeded settings file through `update` twice; A7 reads this repository's settings
- [x] `helpers/hook-runner.ts` `HookName` gains `"trunk-guard.js"` (a type, so the test files compile; the hook file itself does not exist yet)
- [x] Run both files; record each red's message; set A1–A7 to `written` — 23 cases red: every hook case `Cannot find module …/hooks/trunk-guard.js` → exit 1 where 2 (refusals) or 0 (allowances) was asserted; A5 `expected { edit: false, bash: false } to deeply equal { edit: true, bash: true }` after `init` and after `update`; A7 the same against this repository's settings

#### Deferred to Build Phase 1
(none — every row is authored here)

#### Deferred to Build Phase 3

- **A8–A10** — falsification hypotheses (`/falsify`, 2026-09-17), formed by reading the shipped hook after Build Phase 2 closed; each targets a line of `hooks/trunk-guard.js` that did not exist when Test Phase 1 was authored. Authored red in the phase that fixes them, the ritual's shape. A8 against `COMMIT_RE`'s requirement that `git` and `commit` be adjacent and against `anchor: eventCwd` ignoring a `cd` in the same command; A9 against the separator class `[;&|(]` that omits quotes and backticks; A10 against `stagedPaths`' `-a|--all` regex missing the combined `-am` and its ignorance of pathspec arguments.

#### Deferred to Build Phase 4

- **A11** — cleanup row (`/cleanup`, 2026-09-17): tests `ensureHookRegistered`, a unit the Cleanup Phase extracts into `lib/hook-command.ts`; the file cannot load before that phase. It is a behaviour-parity row as well — A5 and `hook-cwd-independence` keep passing once every registration site calls it — plus focused cases for the four shapes the helper must hold (existing group, absent group, already present, never a second group).

#### Regression Guards
(none)

#### Test Phase 1 Verification
- [x] `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard.test.ts src/__tests__/trunk-guard-registration.test.ts` — every case red on its own claim (the hook cases red as a non-zero exit from a missing script, the registration cases red on the settings assertion); then `cd` back — 2 files, 23 tests, 23 failed as recorded above
- [x] Rows A1–A7 set to `written`

#### Test Phase 1 Context
- [x] (none needed — asked: "Test Phase 1 of trunk-guard has a Context gate and a Document gate with nothing real to do: the tests add no rule until the hook exists, and nothing user-facing exists yet. Build Phase 1 and 2 carry the real CLAUDE.md and docs items. The gate policy is ask, so I need your word to skip these two." — user: "Yes, skip both")

#### Test Phase 1 Document
- [x] (none needed — asked: "Test Phase 1 of trunk-guard has a Context gate and a Document gate with nothing real to do: the tests add no rule until the hook exists, and nothing user-facing exists yet. Build Phase 1 and 2 carry the real CLAUDE.md and docs items. The gate policy is ask, so I need your word to skip these two." — user: "Yes, skip both")

### Build Phase 1: The hook

**Goal**: `hooks/trunk-guard.js` refuses what the brief says and allows the rest.

- [x] `hooks/trunk-guard.js`: read the event; for `Edit`/`Write`/`MultiEdit` take `tool_input.file_path`, for `Bash` match `/\bgit commit(?=$|\s|;|&|\|)/` on `tool_input.command` and collect staged paths (`git diff --cached --name-only`, plus tracked modifications when `-a`/`--all` is present); anything else exits 0 — the commit regex requires `git commit` in command position (start or after `;`, `&`, `|`, `(`, newline): `echo git commit` is not a commit, and the first draft's `\b`-only form refused it
- [x] Allow-list check first, no git needed: a path under `.indusk/`, `.claude/lessons/`, matching `.claude/settings*.json`, or named `CLAUDE.md` / `AGENTS.md` (relative to the state root or the git root that contains it) is allowed — both sides realpath'd: macOS temp dirs are `/var/…` while the roots come back `/private/var/…`, and the first draft judged every file to be outside the project
- [x] Branch check: resolve `{statePath, gitPath}` with `resolveStateAndGitPaths` from the file's directory (Edit/Write) or the event cwd (Bash); `git symbolic-ref --short HEAD` on `gitPath`; not a protected branch (`worktree.trunk_guard.branches`, default `["main", "master"]`) or detached ⇒ allow
- [x] Exemptions: `worktree.trunk_guard.enabled === false` in the state root's config, or `INDUSK_TRUNK_GUARD=off`, ⇒ allow silently; a `git commit` whose `-m` message begins `chore(release):` ⇒ allow
- [x] Refusal (exit 2, stderr): names the path(s), the branch, `indusk worktree create <plan>` and "land by merge (retrospective Step 10)", the allow-listed kinds, and both off switches — one message shape for both matchers

#### Build Phase 1 Verification
- [x] A1, A2, A3, A4, A6 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard.test.ts`; then `cd` back — 20 tests green (the first run of the hook failed 7: temp paths under `/var` against roots under `/private/var`, and `echo git commit` matching the eval hook's `\b`-anchored regex — both fixed in the hook, both recorded on the items above)
- [x] Every existing hook test still green: `pnpm exec vitest run src/__tests__/hook-shared-modules.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/hooks-load-in-cjs-consumer.test.ts src/__tests__/hook-paths.test.ts` — a new hook file must satisfy whatever those pin about `hooks/` (a `_`-module import stays inside the directory; the record lists it if the record is by count) — `hooks-record-parity` was red twice as designed: the guide's hook table must list every hook on disk with a matching stated count, and the Dawn master's keep/shed record must classify every hook; both updated (seven hooks, four PreToolUse; `trunk-guard` kept as the trunk gate); 5 files / 37 tests green
- [x] Rows A1–A4, A6 set to `passing`
- [x] Shape (Build Phase 1): review the hook; record findings or "nothing to change" — reviewed `hooks/trunk-guard.js`: one file, one decision path (classify → locate → config → branch → allow-list → refuse), helpers named for what they answer (`real`, `currentBranch`, `stagedPaths`, `isAllowed`). Nothing to change. Left as is, with reasoning: the allow-list is three constants in the hook rather than config — the brief makes it a fixed rule (the writes a plan makes before and after its branch), and a configurable allow-list is how a guard grows a bypass; the off switch is the configurable part

#### Build Phase 1 Context
- [x] Conventions, the worktree-per-plan entry: no code is edited or committed on `main` — `trunk-guard.js` refuses an Edit/Write/`git commit` outside `.indusk/`, `.claude/lessons/`, settings, `CLAUDE.md`, `AGENTS.md` on a protected branch; `chore(release):` exempt; off switches `worktree.trunk_guard.enabled: false` / `INDUSK_TRUNK_GUARD=off`

#### Build Phase 1 Document
- [x] `apps/docs/src/guide/index.md` (or the hooks guide section "hooks enforce what discipline won't"): the trunk guard — what it refuses, what it allows, the two off switches, why the commit gate exists beside the edit gate — the hook table gains its row and the count reads seven / four PreToolUse (the record-parity pin reads both)

### Build Phase 2: Registration and record

**Goal**: every project `init` or `update` touches gets the hook; this repository has it; the record says so.

- [x] `init.ts` `hookConfig.PreToolUse`: add `trunk-guard.js` to the Edit/Write entry and a new Bash-matcher entry carrying it — and init's settings merge now merges per hook into the group with that matcher: appending the whole group whenever one command was missing registered the Edit/Write group twice (11 registrations instead of 8) the moment a new hook joined an existing matcher; `hook-cwd-independence` A3/A4/A7 caught it and now expect eight, each once
- [x] `update.ts`: a targeted ensure block in the budget hook's shape for both matchers (idempotent — a second run writes nothing)
- [x] This repository's `.claude/settings.json`: both registrations in the `hookCommand` form; the installed copy `.claude/hooks/trunk-guard.js` synced by hand (dusk has no global `indusk update`)
- [x] `apps/docs/src/reference/cli/workbench.md` or the worktree reference: the guard applies to the declared code repository's branch in a workbench; the workbench repository is allow-listed by path
- [x] `apps/docs/src/changelog.md` Unreleased: the trunk guard — a new Unreleased section above 1.50.0, also carrying the version-state health line and the guard's packaged-paths fix that landed on trunk before this plan
- [x] Shape (`apps/indusk-mcp/src/bin/commands/update.ts`) — reviewed, left as-is: the ensure block is the third targeted-ensure of the same shape (eval-trigger, claude-md-budget, now trunk-guard) and init's merge loop is a fourth "put this hook in that matcher group" — a shared `ensureHookRegistered(settings, matcher, command)` is the right extraction, but it is inter-file (four sites, two commands) and belongs to `/cleanup`, not to this phase's intra-unit review
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 2 Verification
- [x] A5, A7 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard-registration.test.ts`; then `cd` back — 3 tests passed (two A5, one A7); `registry-leak-scan.test.ts` (its no-real-registry assertion) then flagged the file for not naming `INDUSK_HOME` (the scan is textual; `runCli` pins it) — the header now names the pin, 2 files / 5 tests green together
- [x] Full mcp suite green: `cd apps/indusk-mcp && pnpm exec vitest run`; `skill-sync-parity` and the settings-writing tests (`hook-cwd-independence.test.ts`) still pass; then `cd` back — 231 files / 1403 tests passed, 1 file skipped; the one red was `impl-corpus` refusing THIS impl because a verification note named another plan's row id (`A` + digits reads as a cross-reference) — reworded, corpus green alone. Two environmental reds fixed first: the worktree had no admin build, so the nine `indusk ui` daemon tests and the tarball test failed until `pnpm --filter indusk-admin build && node scripts/bundle-admin.js` ran here
- [x] The hook fires in this repository: from the plan worktree on its branch, an Edit to a source file is allowed; on `main` (the main checkout), `INDUSK_TRUNK_GUARD` unset, the hook run by hand with an Edit event for `apps/indusk-mcp/src/lib/config.ts` exits 2 — recorded here: 2026-09-17, `env -u INDUSK_TRUNK_GUARD node hooks/trunk-guard.js` with `cwd` = the main checkout → stderr "trunk-guard: refusing to edit code on `main`." naming the path, `indusk worktree create <plan>`, the allow-list and both off switches, exit 2; same event with `cwd` = this worktree on `plan/trunk-guard` → silent, exit 0
- [x] Rows A5, A7 set to `passing`
- [x] Shape (Build Phase 2): review `init.ts`/`update.ts` changes; record findings or "nothing to change" — performed; the record is the Shape items appended to this phase's implementation list

#### Build Phase 2 Context
- [x] Known Gotchas, the hooks-discovery entry: `trunk-guard.js` needs settings registration under TWO matchers (Edit/Write and Bash); `update`'s ensure block adds both, and a hook registered under only one is half a gate — rewritten in place (also records init's per-hook merge); CLAUDE.md 61,399 of 61,440 bytes, so the retrospective's compaction step has 41 bytes of headroom to work with

#### Build Phase 2 Document
- [x] `apps/docs/src/reference/cli/init.md` (or wherever init's hook list is documented): the hook list gains `trunk-guard.js` with its two matchers — there is no init reference page; init's hook list lived in `apps/docs/src/reference/tools/indusk-mcp.md` `## Hooks`, which still said "two hooks". It now points at the guide's seven-hook table and keeps the one registration fact a `settings.json` reader needs: `trunk-guard.js` under two matchers

### Build Phase 3: Falsification — the commit gate's parser reads shell, and shell has more than one spelling

**Goal**: verify whether the attested state holds against three spellings of "commit this" that `COMMIT_RE` and `stagedPaths` do not read: options between `git` and `commit` (and a `cd` that moves the repository out from under `anchor`), a commit wrapped in quotes or a substitution, and `-am` / an explicit pathspec committing an unstaged file. Each trajectory row below is one hypothesis; each checklist item is the fix the hook needs when it confirms. The edit gate is not under suspicion here — the Bash lane is the second line and this is its first look.

- [x] `COMMIT_RE`: allow git's own options between `git` and `commit` — `-C <path>`, `-c <k=v>`, `--git-dir=…`, `--work-tree=…`, `--no-pager`, `--no-optional-locks` and their spaced forms — so `git -C repo commit` is a commit; keep the right-edge lookahead so `git commitment` is not — `GIT_OPTIONS` captured as group 1 (also `--paginate`, `-p`/`-P`); the lookahead gains `) " ' `` ` `` so a wrapped `commit"` still ends the verb
- [x] `classify()` for a commit: when the same command segment carries `git -C <path>`, or an earlier segment is `cd <path>`, resolve `anchor` to that path (relative to the event cwd), so the branch and index judged are the repository the commit lands in — every `cd` before the match in document order, then every `-C`, each resolved against the anchor so far. One red on first run: the match begins AT the separator, so the text before it ends in one `&` of `&&` and the segment split has to be on separator characters, not operators
- [x] `COMMIT_RE`: the command-position class gains quotes and backticks so `bash -c "git commit …"`, `sh -c '…'`, `$(git commit …)` and a backtick form are commits — narrower than written: a quote counts only as the string handed to `-c` (`(?:^|\s)-c\s+["']`), plus a backtick; `$(` was already read through `(`. That keeps `echo "git commit"` and `git log --grep 'git commit'` unmatched (the A9 negative cases), so no honest false positive had to be documented
- [x] `stagedPaths`: `-a` is recognised inside a combined short-flag cluster (`-am`, `-qa`, `-anm`) as well as alone or as `--all`; any non-option argument after `commit` (and everything after `--`) that resolves to a tracked path under the repository is added to the judged set, because `git commit <path>` commits that path unstaged — `commitArgs` (a quote- and escape-aware tokenizer that stops at the segment's end or the `-c` string's closing quote) feeds `commitIntent`, which walks flags with `SHORT_WITH_VALUE` / `LONG_WITH_VALUE` so `-m x` and `--author y` never read as paths and skips redirections; pathspecs resolve against the commit's anchor, not the git root, since `-C` and `cd` make those differ. Tracked-ness is not checked: a bare word that is not a file would fail in git anyway, and refusing it names it
- [x] Hook header comment and the guide's `trunk-guard` row: name the spellings the commit gate reads, in one line each, so the next reader knows what it does not read (a commit made by a script the agent invokes by name is still out of scope — the brief's "arbitrary Bash" line) — header block "What the commit gate reads"; the guide row is the Document item below
- [x] Shape (`apps/indusk-mcp/hooks/trunk-guard.js`) — `classify()`'s Bash branch grew four jobs: match the verb, work out which repository the commit lands in (`cd` segments, then `-C`), work out where the argument text ends (the `-c` string's closing quote or a backtick), and tokenize. Extract `commitAnchor(command, match, cwd)` and `commitCloser(match)` so the "which repository" question has a name and a seam a test can reach, and `classify()` reads as a dispatch again. Rule: a unit should have one reason to change; an inline block that answers its own question should have a name (the work skill's intra-unit Shape prompts)

#### Build Phase 3 Verification
- [x] A8, A9, A10 authored red against the shipped hook (each case fails on its own claim: the hook exits 0 where the row says 2), then green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard-falsification.test.ts`; then `cd` back — red: 12 of 16 failed with `expected +0 to be 2`, the 4 negatives passed (`$(git commit)` was already read via `(`, so it was green from the start and is kept as a guard); green after the fix: 16 of 16
- [x] A1–A7 still green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard.test.ts src/__tests__/trunk-guard-registration.test.ts`; then `cd` back — with `hooks-record-parity` too: 4 files, 41 tests
- [x] Installed copy resynced: `cp apps/indusk-mcp/hooks/trunk-guard.js .claude/hooks/trunk-guard.js` and `git diff --stat` shows both files changed together — committed as `6e820704` (package) + `db13d610` (installed copy)
- [x] Rows A8–A10 set to `passing`
- [x] Shape (Build Phase 3): review the parser changes in `trunk-guard.js`; record findings or "nothing to change" — performed; the record is the Shape items appended to this phase's implementation list

#### Build Phase 3 Context
- [x] Known Gotchas, one line appended to the hooks-discovery entry or a new entry if budget allows: the commit gate reads `git [opts] commit`, quoted and substituted forms, `cd … &&`, `-a` in a flag cluster and pathspecs — a spelling outside that list is a documented gap, not a guarantee (compaction is required first: the file is at 61,399 of 61,440 bytes) — one clause added to the hooks-discovery entry; paid for by dropping "(the eval-trigger lesson)", the two `_`-module examples and the tail about resolving imports (the rule "keep them in `apps/indusk-mcp/hooks/`" survives). 61,429 of 61,440 bytes

#### Build Phase 3 Document
- [x] `apps/docs/src/guide/index.md` hooks table, the `trunk-guard` row: the commit-gate spellings in one clause; `apps/docs/src/changelog.md` Unreleased: the three falsification fixes under Fixed — both done (`d2eaebde`); `hooks-record-parity` re-baselined nothing, it still passes on the row count and the words it pins; the changelog also records init's per-hook merge fix from Build Phase 2, which had no entry

### Build Phase 4: Cleanup — one way to register a hook

**Goal**: decompose what this plan grew per the rule of three. Registering a hook in `.claude/settings.json` — "is a command naming this file in the group with this matcher; if not, add it to the group, or create the group" — is now written five times: four targeted-ensure blocks in `update.ts` (eval-trigger, workbench-sync, claude-md-budget, trunk-guard) and the merge loop in `init.ts`. Build Phase 2 found the fifth copy's bug (a duplicate group) in the fourth's shadow; the next hook would write a sixth. Everything else the plan touched is a record (changelog, workbench reference) or a cohesive unit under its cap.

- [ ] Extract `ensureHookRegistered(settings, event, matcher, hookFile): boolean` into `lib/hook-command.ts` beside `hookCommand` (the module that already owns "the one definition of a hook's registered command"; registration is its sibling fact). Presence is "a command in that group names the hook file" — the tolerance the existing blocks have for a customised command — and the group is matched by exact matcher string
- [ ] `update.ts`: the four ensure blocks call it and keep their own log lines; the `hasBashEvalHook` / `hasSyncHook` / budget / trunk-guard predicates and their push-or-create bodies go. The workbench-sync block's presence check today scans every PostToolUse group, not just Edit/Write — the helper checks the named group, which is the stricter and correct reading (a sync hook registered under Bash alone would never fire on an edit)
- [ ] `init.ts`: the non-force path of the settings merge calls it per hook; the force path (drop the group, append ours) stays as written, it is a different operation
- [ ] (reviewed `apps/indusk-mcp/hooks/trunk-guard.js` — left as-is: 381 lines under the 400 cap, one hook with one rule; Shape already named its helpers (`commitAnchor`, `commitCloser`, `commitArgs`, `commitIntent`) and each has one job)
- [ ] (reviewed `apps/docs/src/changelog.md` 669 and `apps/docs/src/reference/cli/workbench.md` 431 — left as-is: the changelog is an append-only record by design; the workbench reference gained one 20-line section on the guard, and splitting a reference page by size would scatter one command's documentation)
- [ ] (reviewed `init.ts` 1331 and `update.ts` 1042 — the extraction above is what this plan owes them; the rest of their size predates it and is not this plan's to decompose)

#### Build Phase 4 Verification
- [ ] A11 authored red (the import fails to load — a boundary red is not available for a library unit, so the file is written in this phase and goes green in it, the register entry says so), then green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/hook-registration.test.ts`; then `cd` back
- [ ] Behaviour parity: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard-registration.test.ts src/__tests__/hook-cwd-independence.test.ts src/__tests__/init-workbench.test.ts` green, and every test that exercises `update`'s eval-trigger, workbench-sync or budget registration still passes in the full suite: `pnpm exec vitest run`; then `cd` back
- [ ] `grep -n "hooks.push\|\.push({ matcher" src/bin/commands/update.ts src/bin/commands/init.ts` shows no hand-rolled registration left outside the helper
- [ ] Row A11 set to `passing`
- [ ] Shape (Build Phase 4): review the helper; record findings or "nothing to change"

#### Build Phase 4 Context
- [ ] Known Gotchas, the hooks-discovery entry: "a targeted settings-ensure block in `update.ts`" becomes "an `ensureHookRegistered` call (`lib/hook-command.ts`) from `update.ts`" — the pointer names the one definition; trimmed elsewhere in the entry to stay under budget (61,429 of 61,440 bytes today)

#### Build Phase 4 Document
- [ ] `apps/docs/src/changelog.md` Unreleased, a `### Changed` line: `init` and `update` register hooks through one helper; a new hook adds one call, not a block

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/trunk-guard.js` | new — the two-matcher guard |
| `apps/indusk-mcp/src/bin/commands/init.ts`, `update.ts` | registration + ensure |
| `.claude/settings.json` | this repository's registration |
| `apps/indusk-mcp/src/__tests__/helpers/hook-runner.ts` | `HookName` |
| `apps/indusk-mcp/src/__tests__/trunk-guard*.test.ts` | new |
| docs: hooks guide, worktree/workbench reference, init reference, changelog | the guard |
| `CLAUDE.md` | one convention line, one gotcha |
