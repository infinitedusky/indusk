---
title: "jj Residue Rip-Out"
date: 2026-08-13
status: in-progress
workflow: refactor
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# jj Residue Rip-Out

## Goal

Finish the jj removal that [`git-only-substrate`](../archive/git-only-substrate/) declared complete on 2026-06-27, and replace the enforcement test that could not have caught what it missed.

## Scope

### In Scope

- The one remaining jj execution path (`apps/indusk-admin/src/lib/vcs.ts`)
- User-facing admin copy naming jj commands
- The `scm: "jj"` back-compat shim (config field + `indusk update` nudge + its test)
- Stale jj comments in `indusk-mcp` source
- `apps/docs/src/reference/semantic-graph/jj-dependency.md`
- Widening `scm-rip-out-grep.test.ts` to both apps and to argv-level matching

### Out of Scope

- `apps/docs/src/decisions/git-or-jj-substrate.md`, `apps/docs/src/lessons/git-or-jj-substrate.md` — superseded records
- `.indusk/planning/**` — historical archive (~60 files)
- `apps/docs/src/guide/scm.md` — already correct as the git-only migration explainer
- `apps/indusk-mcp/lessons/community/*` — three bundled lessons that use jj as their worked example; removing it would leave them asserting something happened without saying what
- The other 8 pages in `apps/docs/src/reference/semantic-graph/` — dead docs for a subsystem the makeover removed; a separate plan
- Telemetry-daemon leak in the other three temp-home test files — diagnosed separately

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Widened audit (both apps, argv-level patterns) with an observed red state; A1–A6 authored | The current tree, used as the red fixture |
| Build Phase 1 | `getCommitMessage` resolving via git only | A1 (partial), A3, A4 |
| Build Phase 2 | Admin copy naming git commands | A5 |
| Build Phase 3 | Config type and `update` with no jj surface; clean comments; one docs page gone | A1 (completes), A6 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | A repo-wide audit across `indusk-mcp` and `indusk-admin` finds no code executing jj and no config field offering jj as an option | Test Phase 1 | Build Phase 3 | passing |
| A2 | The audit reports no violation against preserved history — planning archive, superseded decision/lesson pages, `guide/scm.md`, and the bundled community lessons | Test Phase 1 | Test Phase 1 | passing |
| A3 | With no `jj` on PATH, the scorecards page still displays a commit message for every scorecard that has one | Test Phase 1 | Test Phase 1 | passing |
| A4 | The commit message displayed for a scorecard matches that commit's actual git message | Test Phase 1 | Test Phase 1 | passing |
| A5 | No text rendered in the admin UI instructs the reader to run a jj command | Test Phase 1 | Build Phase 2 | passing |
| A6 | A project whose config still contains `scm: "jj"` runs `indusk update` to completion with no error and no jj nudge | Test Phase 1 | Build Phase 3 | passing |
| A7 | Every slash command the getting-started guide advertises resolves to a skill file that exists | Phase 0 | Build Phase 4 | written |
| A8 | The jj audit inspects the hooks (`.js`), skills (`.md`) and extension manifests (`.json`) that ship to consumers — not only `.ts`/`.tsx` | Phase 0 | Build Phase 4 | written |
| A9 | The admin copy audit inspects every file that produces user-facing text, including `.ts` generators, not only `.tsx` | Phase 0 | Build Phase 4 | written |
| A10 | The audit finds a violation in every file it scans, independent of a pattern's regex flags | Phase 0 | Build Phase 4 | written |
| A11 | With the audit widened to prose, the preserved record stays unflagged — changelog, strategy, dawn, and the semantic-graph reference | Phase 0 | Build Phase 4 | written |

## Checklist

### Test Phase 1: Arm the tripwire, and prove it can fire

**Goal**: author every assertion, and observe A1, A5, and A6 failing against the current tree. A widened audit that has never been seen red is the artifact this plan exists to replace — the red observation is the deliverable, not a formality.

- [x] Create/confirm this plan's worktree — worktree-per-plan default; skip only if `worktree: none` in frontmatter. **Deviation:** `indusk worktree create` refuses in dusk (`no workbench-shaped .indusk/config.json` — the worktree extension requires a workbench root and dusk is a plain repo). Used the form dusk's existing worktrees were made with: `git worktree add ../dusk-worktrees/jj-residue-rip-out -b plan/jj-residue-rip-out`
- [x] Rewrite `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts` to resolve the **repo root** and scan both `apps/indusk-mcp/` and `apps/indusk-admin/`
- [x] Add argv-level patterns to the audit — match jj as an **executed command**, not only as a TypeScript identifier. **Discovered:** patterns must be matched against **whole-file content**, not line-by-line as the predecessor did — the real call site formats `execFileSync(` and `"jj",` on separate lines, so a line-at-a-time audit misses it even with a correct argv pattern. This was a second, independent layer of the same blindness
  ```typescript
  // The predecessor matched only symbol names, which is why an
  // execFileSync("jj", [...]) argument list slipped through for seven weeks.
  /execFileSync\s*\(\s*["'`]jj["'`]/,
  /execFile\s*\(\s*["'`]jj["'`]/,
  /spawn(?:Sync)?\s*\(\s*["'`]jj["'`]/,
  /\bscm\s*[?]?\s*:\s*["'`]jj["'`]/,
  ```
- [x] Add the preserved-history exemption list to the audit (A2) — `.indusk/planning/**`, `apps/docs/src/decisions/**`, `apps/docs/src/lessons/**`, `apps/docs/src/guide/scm.md`, `apps/indusk-mcp/lessons/**`
- [x] Author A1 and confirm it fails, naming `apps/indusk-admin/src/lib/vcs.ts` and the `scm?: "jj" | "git"` field — RED, 3 violations: `config.ts:77`, `update.ts:616`, `vcs.ts:28`
- [x] Author A2 and confirm it passes — the audit must not flag any preserved-history path
- [x] Author A3 (scorecards render commit messages with `jj` absent from PATH) and A4 (displayed message matches git's) as integration tests against a temp git repo — both GREEN as declared. jj **is** installed here (`/opt/homebrew/bin/jj`), so A3 builds a PATH containing only git and asserts jj is genuinely unreachable before making its claim
- [x] Author A5 (no jj command named in admin UI copy) and confirm it fails on `Scorecards.tsx` and `scorecards/page.tsx` — RED on both
- [x] Author A6 (`indusk update` on a `scm: "jj"` config emits no nudge) and confirm it fails against current behavior — RED. Authored as `update-scm-jj-removed.test.ts` (Build Phase 3 deletes the old nudge test it replaces). **Required a `dist/` build first**: the suite `skipIf`s on a missing CLI binary, so in a fresh worktree A6 would have reported "skipped" while looking authored. Its `afterEach` also stops the telemetry daemon before deleting the temp home — verified no leak (procs 1 → 1)

#### Regression Guards

- **A2** — Passes the moment it is written, because the current audit does not scan the exempted paths at all. It is not a driver; its job starts when A1 widens, pinning the boundary so a future widening cannot begin flagging the decision record. An audit that fires on ~60 archived files and three shipped lessons gets disabled, which is the state this plan is correcting.
- **A3** — Passes today. The current `vcs.ts` already falls back to git when jj is missing, so this cannot go red before the removal. It exists to prove Build Phase 1 did not break the feature the jj branch was nominally serving.
- **A4** — Passes today, same fallback. Guards against a Build Phase 1 rewrite that returns the wrong message rather than no message — a failure A3 alone would not catch, since A3 only asserts that *something* is displayed.

#### Test Phase 1 Verification

- [x] A1, A5, A6 observed RED against the pre-removal tree; each failure names its expected violation rather than erroring on a missing import — `3 failed | 8 passed (11)`, all three failures are `AssertionError`s carrying their violation list
- [x] A2, A3, A4 observed GREEN, consistent with their declaration as guards
- [x] A1's failure output lists `vcs.ts` — confirming the widened audit sees the file the predecessor's scope excluded (`apps/indusk-admin/src/lib/vcs.ts:28 — execFileSync( "jj"`)

#### Test Phase 1 Context

- [x] Record in the plan's notes which paths the audit exempts, so the Build Phase 3 CLAUDE.md edit can state the boundary rather than restate the removal — see "The audit's preserved-history boundary" in Notes

#### Test Phase 1 Document

- [x] Capture A1's red output verbatim into the plan folder as the evidence artifact — the predecessor's failure was an audit no one had ever seen fail, and a claim that this one did needs a record. See [`a1-red-evidence.md`](./a1-red-evidence.md)

### Build Phase 1: Remove the executing jj path

- [x] Collapse `getCommitMessage` in `apps/indusk-admin/src/lib/vcs.ts` to a single git lookup — delete the jj `execFileSync` branch and its `try`/fall-through. Blast radius checked first: only `scorecards/page.tsx` imports the module, via `getCommitMessages`, whose signature is unchanged
- [x] Rewrite the file's doc comment, which currently asserts jj is "the project default in dusk" — false since 1.31.0
- [x] Confirm `getCommitMessages` bulk path still deduplicates by id — asserted by A4's bulk case (`[sha, sha]` resolves to a map of size 1)
- [x] **Shape finding** — `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts`: A5 re-implements the glob → read → match → report loop inline instead of reusing `findViolations`, so the audit file now holds two independent scanners with different globs. *Rule (typescript, intra-unit): should this inline block have been a named function?* — sharpened by this plan's own subject: it exists because an audit's scope silently drifted from the thing it audited, and two scanners are two things that must agree. **Narrowed on execution:** extracting the whole loop was wrong — the two scans differ on globs, ignores, patterns AND reporting, so a 4-parameter shared function called once each is extraction for its own sake, and it degraded A5's message. Extracted only the genuinely shared mechanic, `matchesIn(content, patterns)` (whole-file matching + line numbers); each scan keeps its own glob and report. **Caught during the refactor:** the first version returned the *first* match per file rather than all, which produced byte-identical output today because no file matches two patterns — a silent narrowing that would look correct until it wasn't. Reverted to returning all
- [x] Shape: considered `apps/indusk-admin/src/lib/vcs.ts` and left it as is — one reason to change, accurate doc comment, exported seam a test already reaches; the swallowing `catch` is deliberate and documented

#### Build Phase 1 Verification

- [x] A3 and A4 still pass — the removal did not break commit-message display (`4 passed`)
- [x] A1 still fails, now naming only the `scm?: "jj" | "git"` field (`vcs.ts` no longer flagged) — violation list went 3 → 2, exactly the intermediate-phase behavior the sequencing is for

#### Build Phase 1 Context

- [x] Check whether any CLAUDE.md entry describes the admin's commit-message lookup as SCM-agnostic or jj-first; correct it if found — checked, none. The admin-ui gotchas block covers `Markdown.tsx`, the registry, daemon identity and the scorecard-to-plan join, but never the commit-message lookup

#### Build Phase 1 Document

- [x] Check `apps/docs/src/reference/admin-ui/` for any page describing the scorecard commit-message lookup as trying jj first; correct it if found — checked all three pages (`overview.md`, `cli.md`, `component-conventions.md`), zero jj references and no description of the lookup

### Build Phase 2: Remove jj from user-facing copy

- [x] Rewrite the three jj references in `apps/indusk-admin/src/components/Scorecards.tsx` to name `git commit`
- [x] **Discovered work** — `Scorecards.tsx` also threads a **`jjDescription` prop** through `ScorecardCard` (7 sites). The impl scoped this phase as "three copy strings"; the prop is jj residue too, and **A5 cannot see it**: `/\bjj\b/` needs a word boundary and `jjDescription` has none. Renamed to `commitMessage`, which is the name the file was already reaching for (`data-testid="scorecard-commit-message"` predates this). Confined to that one file — `ScorecardCard` is not exported and no test referenced the prop
- [x] Rewrite the empty-state copy in `apps/indusk-admin/src/app/p/[project]/scorecards/page.tsx`

#### Build Phase 2 Verification

- [x] A5 passes — no admin UI text names a jj command (audit file now `1 failed | 4 passed`; only A1 remains red, on the config shim)
- [x] Scorecards page renders correctly with the new copy (`pnpm turbo test --filter=indusk-admin`) — `148 passed | 1 failed (149)`. The one failure is `http-project-research.test.ts`, which **passes in isolation** (`5 passed`, 6.70s): it boots a Next server and exceeds vitest's 5s default under full-suite parallel load. Known-red-on-main per the `http-suite-5s-timeout-too-tight-for-server-boot-tests` lesson, and unrelated to this phase's files — confirmed by re-running it alone, not assumed from the lesson

#### Build Phase 2 Context

- [x] Verify the admin-ui gotchas block in CLAUDE.md does not quote the jj-worded scorecards copy; correct if it does — checked, it does not
- [x] Shape (Build Phase 2): reviewed `Scorecards.tsx` and `scorecards/page.tsx`, nothing found. The change was a prop rename plus copy strings; `ScorecardCard` stays cohesive and no new inline block wants a name. `rules.unreadable` empty, so this was judged against every enabled extension's full rule set

#### Build Phase 2 Document

- [x] Check whether any docs page screenshots or quotes the old scorecards copy; update if so — no page quotes it. **Scope call the plan did not cover:** `apps/docs/src/changelog.md` carries ~10 jj references, but every one is a historical entry describing a change as it was made ("`TRIGGER_RE` narrowed from `/\b(jj describe|git commit)\b/`…"). A changelog is a record of what happened; rewriting those entries would falsify history for no gain, so it joins the preserved set alongside the ADRs. A1 never flags them — it scans `.ts`/`.tsx` only

### Build Phase 3: Close the back-compat shim and sweep the remainder

- [x] Remove the `scm?: "jj" | "git"` field from `InduskConfig` in `apps/indusk-mcp/src/lib/config.ts`
- [x] Remove the `scm: "jj"` nudge from `apps/indusk-mcp/src/bin/commands/update.ts` — the whole `[SCM]` section goes. The `readConfig`/`writeConfig`/`ensureCleanupConfig`/`getCleanupConfig` import that lived inside that block is **kept**: four later migration steps depend on it, so deleting the block wholesale would have broken them
- [x] Delete `apps/indusk-mcp/src/__tests__/update-scm-jj-nudge.test.ts`
- [x] Remove the `".jj/"` ignore entry and the stale `git-or-jj-substrate` comment from `apps/indusk-mcp/src/bin/commands/init.ts`
- [x] Rewrite the stale doc comments in `apps/indusk-mcp/src/lib/eval/findings.ts` and `lib/eval/prompt-builder.ts` — the latter also describes writing findings to Graphiti, removed in the makeover
- [x] Delete `apps/docs/src/reference/semantic-graph/jj-dependency.md` and remove its sidebar entry from `apps/docs/src/.vitepress/config.ts`
- [x] **Bookkeeping correction** — the gate refused this phase because A5 was still `written` after Build Phase 2 closed, though it had been passing since then. Exactly the `update-trajectory-state-column-when-checking-off-verification` lesson: checking off a Verification item does not move the State column, and the table silently lags the checklist unless both happen in one edit. Caught by the hook, not by me

#### Build Phase 3 Verification

- [x] A1 passes — the audit is green across both apps
- [x] A6 passes — `indusk update` on a `scm: "jj"` config completes silently. Two fixture faults found and fixed on the way: the temp dirs were named `scm-jj-*` and `update` echoes the project path, so `/\bjj\b/` flagged the test's own scaffolding; and the same assertion then matched **this plan's worktree name** (`dusk-worktrees/jj-residue-rip-out`, printed as the hooks source). Narrowed to `/\bjj\s+(describe|log|new|git|status|diff)\b/` — jj as a *command*, which is what A6 actually claims and which no filesystem path can contain
- [x] A2 still passes — no preserved-history path became a violation
- [x] Full suite and `pnpm check` — **neither is clean, and none of it is this plan's.** Attributed causally, not by inference: `indusk ui`'s code (`bin/commands/ui.ts`, `lib/admin/daemon.ts`) is not in this plan's diff at all, so it cannot break those tests. Detail: `indusk-mcp` `992 passed | 9 failed`, every failure an `indusk ui` daemon-lifecycle test failing because a **machine-global admin daemon has been running since Aug 12 18:33** (PID 98095, port 3939), predating this session; the same three files pass 12/12 on unmodified `main`. `indusk-admin` `148 passed | 1 failed` — `http-project-research.test.ts`, which passes in isolation (the 5s-timeout lesson). `pnpm check` errors are all pre-existing at baseline `0350930a` (verified per-file: the vitepress duplicate keys and init.ts's unused `noIndex` are both untouched by this diff)
- [x] Docs site builds with the deleted page removed from the sidebar — `pnpm turbo build --filter=@infinitedusky/docs`, build complete in 31.25s (note: the package is `@infinitedusky/docs`, not `docs` as the impl guessed)

#### Build Phase 3 Context

- [x] Update CLAUDE.md's git-only-substrate Key Decisions line so it states what is now true, and name the preserved-history boundary the audit enforces (41,247 → ~41,800 bytes, well inside the 61,440 budget)
- [x] Shape (Build Phase 3): reviewed all 7 changed files, nothing found. The phase was deletions and comment rewrites — no new structure to judge. `rules.unreadable` empty

#### Build Phase 3 Document

- [x] Changelog entry for the removal, including the `scm` config field deprecation close — filed under a new `### Removed` heading in `[Unreleased]`
- [x] Update `apps/docs/src/guide/scm.md`'s note that `indusk update` nudges about `scm: "jj"` — that nudge no longer exists. **Two** places said it, not one (lines 3 and 63); both now say the field is inert, and line 63 records that the nudge existed through 1.35.x so a reader on an older version isn't confused by its absence

### Build Phase 4: Falsification — the audit's file-type scope, and the `/jj` skill it could not see

**Goal**: the plan corrected the predecessor audit on two axes — path scope and pattern scope — and left a third open. `SCAN` covers `.ts` and `.tsx` in two apps, so the audit cannot see the **hooks (`.js`), skills (`.md`) and extension manifests (`.json`) that ship to every consumer**, nor any prose. That is not hypothetical: `apps/docs/src/guide/getting-started.md:68` advertises **`/jj`** in its list of available skills, and `apps/indusk-mcp/skills/jj.md` was deleted in 1.31.0. The first page a new user reads names a slash command that does not exist, the plan shipped without noticing, and the new guard is structurally incapable of noticing either. A7 is the missed residue; A8 is why it survived.

- [ ] Fix `apps/docs/src/guide/getting-started.md:68` — remove `/jj`, and correct the rest of the list against the skills that actually exist (it also omits `/falsify`, `/cleanup`, `/git`, `/highlight`, `/rail-check`)
- [ ] Widen `SCAN` in `scm-rip-out-grep.test.ts` to the consumer-shipped surfaces: `apps/indusk-mcp/hooks/**/*.js`, `apps/indusk-mcp/skills/**/*.md`, `apps/indusk-mcp/extensions/**/*.json`, and `apps/docs/src/**/*.md`
- [ ] Give prose its own pattern set — jj as an **instruction**, not the bare token. `/\bjj\s+(describe|log|new|git|status|diff)\b/` plus the slash-command form `/`\/jj`/`. A bare `/\bjj\b/` flags legitimate cross-references: `guide/context-budget.md:36` links to `/lessons/git-or-jj-substrate`, and `-jj-` has word boundaries on both sides
- [ ] Extend `PRESERVED_HISTORY` with the record the widened scope newly reaches: `apps/docs/src/changelog.md`, `apps/docs/src/strategy/**`, `apps/docs/src/dawn/**`, `apps/docs/src/reference/semantic-graph/**`. The changelog decision was made in Build Phase 2 and recorded only in prose — it was never encoded, because nothing scanned `.md`
- [ ] Widen A5's file set to admin files that produce user-facing text but are not `.tsx` — `src/lib/markdown-export.ts` generates markdown a user reads
- [ ] Make the matcher flag-safe: `matchesIn` calls `pattern.exec(content)` on module-level regexes reused across every file, so a pattern carrying `/g` would advance `lastIndex` between files and skip matches. Reset `lastIndex` (or use `matchAll`) and export `matchesIn` so A10 can exercise it directly

#### Build Phase 4 Verification

- [ ] A7 passes — no advertised slash command lacks a skill file (red today on `/jj`)
- [ ] A8 passes — the audited file set includes hooks, skills and extension manifests (red today; the set is `.ts`/`.tsx` only)
- [ ] A9 passes — the admin copy audit reaches `.ts` text producers (red today)
- [ ] A10 passes — a `/g`-flagged pattern still finds a violation in every scanned file (red today: `exec` on a shared global regex skips every other file)
- [ ] A11 passes — guard, in the same relationship to A8 that A2 has to A1: it is trivially true while nothing scans prose, and becomes load-bearing the moment A8's fix lands. Its job is to stop the widened audit from firing on the decision record, which is how the *predecessor* audit would have ended up switched off

#### Build Phase 4 Context

- [ ] Amend the CLAUDE.md git-only-substrate line: the audit's scope is now file-type-explicit (hooks/skills/manifests/prose, not just `.ts`/`.tsx`), and prose is matched on jj-as-instruction rather than the bare token

#### Build Phase 4 Document

- [ ] `apps/docs/src/guide/getting-started.md` is itself the fix — verify the corrected skill list against `get_skill_summaries` rather than against memory
- [ ] Changelog: append to the `Removed` entry that the sweep missed a user-facing `/jj` advertisement, and that the audit's file-type scope was the reason

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts` | Widen to both apps + argv-level patterns + history exemptions |
| `apps/indusk-admin/src/lib/vcs.ts` | Delete jj execution branch; rewrite doc comment |
| `apps/indusk-admin/src/components/Scorecards.tsx` | 3 copy strings → git |
| `apps/indusk-admin/src/app/p/[project]/scorecards/page.tsx` | Empty-state copy → git |
| `apps/indusk-mcp/src/lib/config.ts` | Remove `scm?: "jj" \| "git"` |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Remove `scm: "jj"` nudge |
| `apps/indusk-mcp/src/__tests__/update-scm-jj-nudge.test.ts` | Delete |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Remove `.jj/` entry + stale comment |
| `apps/indusk-mcp/src/lib/eval/findings.ts` | Rewrite stale doc comment |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | Rewrite stale doc comment (also drops Graphiti reference) |
| `apps/docs/src/reference/semantic-graph/jj-dependency.md` | Delete |
| `apps/docs/src/.vitepress/config.ts` | Remove sidebar entry |
| `apps/docs/src/guide/scm.md` | One line — the nudge no longer exists |
| `CLAUDE.md` | Key Decisions line now true |

## Dependencies

- None.

## Notes

- Deleting `update-scm-jj-nudge.test.ts` also removes one of four test files leaking orphaned telemetry daemon pairs. Incidental; the other three still need the separate fix.
- `guide/scm.md` is out of scope as a *jj* edit but gains one factual correction in Build Phase 3 — it currently documents a nudge this plan deletes.
- The VitePress sidebar config lives at `apps/docs/src/.vitepress/config.ts`; the root-level one is a stale scaffold (per the `vitepress-config-is-under-src-not-docs-root` lesson).

### The audit's preserved-history boundary (Test Phase 1 Context)

The widened audit exempts these paths, and Build Phase 3's CLAUDE.md edit should
state this boundary rather than restate the removal — the boundary is the part a
future reader cannot re-derive:

| Exempt path | Why it keeps jj |
|---|---|
| `.indusk/planning/**` | The historical archive, including both predecessor plan folders (~60 files) |
| `apps/docs/src/decisions/**` | `git-or-jj-substrate.md` is the superseded decision record; superseded is a status, not a deletion trigger |
| `apps/docs/src/lessons/**` | The published lesson counterpart of the same record |
| `apps/docs/src/guide/scm.md` | Already the git-only page; its jj mentions are an accurate migration note |
| `apps/indusk-mcp/lessons/**` | Three bundled community lessons ship to every consumer and use jj as their worked example |

A2 asserts this boundary is load-bearing rather than decorative: it checks that a
lesson which really does contain `jj describe` is really not audited. An audit
that fires on the decision record gets switched off — the same end state as the
audit this plan replaces.

### Shape (Test Phase 1)

Shape does not apply to a test phase, by design — `lib/shape/impl-blocks.ts`
deliberately excludes `### Test Phase N` because "a test phase writes tests, not
the code Shape reviews." `prepareShapeReview({ phase: 1 })` therefore resolved to
*Build* Phase 1 and skipped on its not-yet-green verification, which is correct
behavior reported through a misleading message. Recorded rather than skipped
silently. Build Phases 1–3 each get a real Shape pass.
