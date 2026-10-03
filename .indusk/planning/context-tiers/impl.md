---
title: "Context tiers — a rule reaches you where and when it applies"
date: 2026-10-02
status: in-progress
trajectory: required
test_phases: required
gate_policy: ask
---

# Context tiers — Implementation

## Goal

Move every entry in the root `CLAUDE.md` to the delivery that fits it — an
enforcer that names its lesson when it fails, a context file in the directory
where the work is written, or the root for design intent alone — and hold the
smaller root with a lowered budget. See [adr.md](adr.md).

## Scope

### In Scope
- The budget hook: shrinking edits allowed; nested files budgeted separately
- `lesson:` tokens, the shared token grammar, derived guarded/advisory state
- `check-pointers` over every context file
- Three nested context files; the planning one shipped by `init`/`update`
- The classification register and the root rewrite; Current State to `current.md`
- Skill routing by tier; the e2e loading probe; the lowered root budget

### Out of Scope
- A route from an advisory lesson to an incident (open question in the brief)
- Requiring a token on every test (`day-contract`, component 4c of the Day
  master plan)
- Consumers' own root files

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | budget hook judging growth, not size; `context.nested_claude_md_budget_bytes` | — |
| Build Phase 2 | `lib/tokens.ts` (shared grammar), lesson scan, `list_lessons` state, `check-pointers` over every file | Build Phase 1 (nested files can be written) |
| Build Phase 3 | `templates/planning/CLAUDE.md` shipped by `init`/`update`; admin and mcp context files (empty of rules); e2e probe | Build Phase 2 (pointers checked in nested files) |
| Build Phase 4 | `register.md`; root rewritten; rules moved; `lesson:` tokens in enforcers; Current State in `current.md` | Build Phases 2–3 |
| Build Phase 5 | `/claude-md`, `/planner`, `/retrospective`, `/catchup` routing by tier | Build Phases 2, 4 |
| Build Phase 6 | lowered root budget with its reason | Build Phase 4 (the surviving root) |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A16 | An edit that makes an over-budget context file smaller is allowed; one that leaves it over budget and larger is refused | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/context-tiers-budget.test.ts |
| A14 | A write past the root budget is refused, and so is one past a nested context file's own budget; in a workbench, a declared repo's own root `CLAUDE.md` is judged by the root budget, never as nested | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/context-tiers-budget.test.ts |
| A7 | `list_lessons` reports each lesson guarded or advisory; adding the token to a test makes it guarded on the next call, removing it makes it advisory, nothing else written | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A8 | A lesson named only in prose — a guide, the lesson file, a changelog — stays advisory | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A11 | `context check-pointers` resolves every pointer in every context file, including `lesson:` tokens, and fails naming the file and pointer that does not resolve | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/context-tiers-pointers.test.ts |
| A4 | `indusk update` on a consumer writes `.indusk/planning/CLAUDE.md` byte-identical to the package's, and a second `update` changes nothing | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/context-tiers-ship.test.ts |
| A1 | A session at a fixture's root that reads a plan's `impl.md` has the planning context file's codeword, which the fixture's root does not carry | Test Phase 1 | Test Phase 1 | passing | manual: pnpm e2e -- context-tiers |
| A2 | A session that reads no admin file lacks the admin codeword; one that reads an admin component has it | Test Phase 1 | Test Phase 1 | passing | manual: pnpm e2e -- context-tiers |
| A17 | `/planner`'s first step reads `.indusk/planning/master.md`, and a session that follows it — reading the master, then writing a new plan's first file — has the planning rules when it writes (restated 2026-10-02: see the note under Build Phase 5) | Test Phase 1 | Build Phase 5 | passing | manual: pnpm e2e -- context-tiers |
| A3 | This repository's own `.indusk/planning/CLAUDE.md` reaches a session that reads an impl — a rule sentence the real file carries after the register moves it there, not a codeword | Test Phase 1 | Build Phase 4 | passing | manual: pnpm e2e -- context-tiers |
| A5 | Each of the eight single-definition pins named in the root today (`shared-resolution`, `shape/shared-definitions`, `workbench-repos-single-definition`, `execution-roots-single-definition`, `head-sha-single-definition`, `promises-cleanup`, `plan-worktrees-single-definition`, `impl-headings`) has a failure message beginning `lesson: <name>`, and the name is a lesson file; the register names at least these eight as enforcer rows | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A6 | A hook refusal names its lesson in the same form — trunk-guard's edit-on-main refusal names `trunk-guard-edit-refusal-is-not-a-bash-workaround`; check-gates' test-first refusal names `test-red-at-earliest-writable-phase` | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/context-tiers-hook-lesson.test.ts |
| A10 | Every entry the root held at the baseline commit has a register row with a destination; the check names any that has none | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/context-tiers-register.test.ts |
| A12 | The root has no Current State section; its content is in `current.md`'s shared region; nothing reads the old heading | Test Phase 1 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/context-tiers-register.test.ts |
| A9 | The catchup skill skims only advisory lesson titles and states the guarded and advisory counts | Test Phase 1 | Build Phase 5 | passing | apps/indusk-mcp/src/__tests__/context-tiers-skills.test.ts |
| A15 | A Context gate item names its tier and destination, and one aimed at the root says why it must be always-on — in `/planner` and `/claude-md`, package and installed copies | Test Phase 1 | Build Phase 5 | passing | apps/indusk-mcp/src/__tests__/context-tiers-skills.test.ts |
| A13 | The root is at least 20 % under its configured budget, and the budget's reason is in `.indusk/config.json` | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/__tests__/context-tiers-register.test.ts |
| A18 | The lesson scan reads a hook's `lesson:` token where the refusal opens a new line inside one string (directly after a `\n` escape): `check-gates.js` guards `test-red-at-earliest-writable-phase`, with kind `hook` | Build Phase 7 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A19 | Every `enforcer` row in the register names files the lesson scan reads as guarding that row's lesson; a row whose named enforcer carries no readable token fails, naming the row | Build Phase 7 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/context-tiers-register.test.ts |
| A20 | The budget hook judges a `CLAUDE.md` at the top level of any git checkout by the root budget — in a workbench, a declared repo's plan worktree, which no declaration names; never as a nested file | Build Phase 7 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/context-tiers-budget.test.ts |
| A21 | In a workbench, `list_lessons` reads a lesson as guarded when a test inside a declared repo carries its token; the scan covers the declared repos as well as the workbench root | Build Phase 7 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A22 | In a workbench, `context check-pointers` walks each declared repo's context files as well as the workbench root's, resolving each file's pointers against the repo that holds it, and names the repo in its report | Build Phase 7 | Build Phase 7 | passing | apps/indusk-mcp/src/__tests__/context-tiers-pointers.test.ts |
| A23 | `declaredRepoDirs(projectRoot)` returns each declared repo's name and checkout directory in all four one-repo layouts, and an empty list for a flat project; `resolveCheckRoots`, the lesson scan and `check-pointers` read their roots from it | Build Phase 8 | Build Phase 8 | written | apps/indusk-mcp/src/__tests__/workbench-repos-single-definition.test.ts |
| A24 | Under `src/lib`, the join of `resolveReposRoot` and `repoDir` is spelled once, in `worktree/repos.ts`; a second spelling fails, naming the file | Build Phase 8 | Build Phase 8 | written | apps/indusk-mcp/src/__tests__/workbench-repos-single-definition.test.ts |

### Deferred Verification

- **Nested loading in future Claude Code releases (U1)**
  - reason: the behaviour is observed, not documented; no test here sees a
    future release.
  - would require: a documented guarantee from Claude Code, or the probe in CI
    with a `claude` binary.
  - mitigation: A1–A3 stay in `pnpm e2e` and run at the close of any plan that
    touches a context file and before each release; the retrospective's Step 11
    lists the run; a red probe blocks the release.
- **Agents act on a delivered rule (U2)**
  - reason: model behaviour, not system behaviour.
  - would require: a measured corpus of sessions with and without delivery.
  - mitigation: the retrospective reports any rule broken in this plan's own
    sessions while it was delivered; the eval agent's scorecards are the running
    signal.

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author all seventeen rows against today's behaviour, each red one
failing on its own assertion and each guard declared as one.

- [x] Create this plan's worktree with `indusk worktree create context-tiers`, and record the baseline commit (the HEAD it branched from) at the top of `register.md`, which A10 reads
- [x] A16, A14 in `context-tiers-budget.test.ts` through `runHook("claude-md-budget.js", …)`: an over-budget fixture `CLAUDE.md` with one shrinking and one growing Edit; a nested `sub/CLAUDE.md` under `context.nested_claude_md_budget_bytes`; and, over `helpers/versioned-workbench.ts`'s `LAYOUTS`, the wrapped repo's own root `CLAUDE.md` judged by the root budget (it sits below the state root, so a depth rule alone would call it nested)
- [x] A7, A8, A5 in `context-tiers-lessons.test.ts`: A7/A8 call `list_lessons` through `helpers/tool-call.ts` on a fixture whose lesson name appears in a `.test.ts` string for A7 and only in `.md` files for A8; A5 names the eight pin test files explicitly (so it cannot pass over an empty register) and asserts each one's first `expect` message starts `lesson: ` naming an existing lesson, and that `register.md` lists at least those eight as enforcer rows
- [x] A6 in `context-tiers-hook-lesson.test.ts`: trunk-guard's edit-on-main refusal (through `helpers/trunk-guard-fixture.ts`) and check-gates' test-first refusal (an impl with a `planned` row writable at the phase being closed), each stderr carrying the `lesson: <name>` the row names
- [x] A11 in `context-tiers-pointers.test.ts`: `runCli(["context", "check-pointers"])` over a fixture whose nested `CLAUDE.md` holds a dangling path and a `lesson:` token for a missing lesson; expects non-zero naming both
- [x] A4 in `context-tiers-ship.test.ts`: `runCli(["update"])` on a temp project, then byte-compare with `apps/indusk-mcp/templates/planning/CLAUDE.md`, then a second `update` leaves the file's mtime and bytes unchanged — authored on bytes only: `update` rewrites skills on every run, so an unchanged mtime would assert a behaviour skills do not have either
- [x] A10, A12, A13 in `context-tiers-register.test.ts`: A10 parses the root at the baseline commit (`git show`) into entries and fails naming each with no register row; A12 checks the root's headings and `current.md`'s shared region, and greps `apps/indusk-mcp/src` for readers of `## Current State`; A13 checks the root's size against `context.claude_md_budget_bytes` and that `context.claude_md_budget_reason` is a non-empty string
- [x] A9, A15 in `context-tiers-skills.test.ts`: read the package skills and their installed copies
- [x] A1, A2, A17, A3 in `apps/indusk-mcp/e2e/context-tiers.e2e.test.ts`: the research Finding 4 probe — headless `claude -p`, cwd at a fixture root (A1, A2, A17) and at this repository (A3); A1/A2 allow Read only; A17 allows Write only and asks for a new file under `.indusk/planning/<new>/`, nothing there read first. Finding 4 probed Read alone, so A17's result is unknown: if it is green when authored, record it under Regression Guards and set its Passes at to Test Phase 1; if red, Build Phase 5 gives `/planner` a first step that reads `.indusk/planning/master.md` — **A17 was red**: the Write-only probe wrote `ROOTWORD` alone, so a Write to an unread directory loads nothing; Build Phase 5's planner step stands
- [x] Run each file and read each failure: every row fails on its own assertion, not on a load error — 28 red across the seven vitest files, each on its own message (budget exceeded; `expected +0 to be 2`; `state` undefined; no token; 138 entries without a row; `Current State` present and `lib/context-parser.ts` reads it; `claude_md_budget_bytes` unset in config; 1 pointer scanned; file not written; words absent from the skills); 6 green, all declared guards; e2e 2 red (A17, A3) and 2 green (A1, A2)

#### Regression Guards

- **A14** — its first case (a root write past the root budget is refused) passes today and must keep passing once Build Phase 1 changes the hook. Its four workbench cases are also green today, by accident: one budget governs every file, so a wrapped repo's root passes for the wrong reason; they guard Build Phase 1's root rule against a depth-based one. Only the nested case is red.
- **A1** — it tests Claude Code's nested loading against a fixture the test builds, which research Finding 4 already observed working; it is the standing guard that the behaviour this plan relies on has not changed, and it passes the day it is written. A3 and A17 are the rows that can be red.
- **A2** — the same guard for the admin directory: sibling files are never loaded, and a read beneath the directory loads it; observed in Finding 4, green on arrival.

#### Test Phase 1 Verification

- [x] All seventeen authored; every row but A14's first case and the guards A1, A2 (and A17 if it proves green) fails on its own assertion (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/context-tiers-` and `pnpm e2e -- context-tiers`)

#### Test Phase 1 Context

- [x] Planning context (Build Phase 3 creates the file; held until then in `register.md` as a pending row): "a trajectory row's `Test` column may name a `manual:` command; `verify` reports it unverified, never passed"

#### Test Phase 1 Document

- [x] Where `pnpm e2e` is documented, list the context-tiers probe and when it must run: at the close of any plan that touches a context file, and before each release — no page owned `pnpm e2e`; it now has a paragraph in `guide/test-trajectory.md`'s Deferred Verification section, listing all three probes

### Build Phase 1: the budget hook judges growth, not size

- [x] `claude-md-budget.js` (and `.claude/hooks/` copy): compute pre- and post-edit size; allow any edit that does not grow the file; refuse growth past the budget; the refusal says shrinking edits are always allowed
- [x] A file named `CLAUDE.md` below the project root is governed by `context.nested_claude_md_budget_bytes` (default 16384); the root keeps `context.claude_md_budget_bytes`. A **root** is the state root or, in a workbench, any declared repo's dir — read through `_hook-paths.js`'s `declaredReposAt(statePath)`, never a depth rule, or a wrapped repo's own `CLAUDE.md` gets the nested budget (A14)
- [x] Add `context.nested_claude_md_budget_bytes` to the config schema and to `update`'s ensured keys (presence-keyed, through `ensureConfigBlock`) — `ensureContextConfig` in `lib/config.ts`, called from `update`; presence-keyed on the `context` block, so a project that already declares one keeps it and the hook's defaults govern any unset key (dusk declares none today, so its next `update` writes both defaults)
- [x] Shape finding (Build Phase 1) — `apps/indusk-mcp/hooks/_hook-paths.js`: `declaredRepoDirsAt` is the third function to inline "read `.indusk/config.json` at the state root, or nothing" (after `declaredReposAt` and `findGitPathFromWorkbenchConfig`); the block answers one question and wants the name `readWorkbenchConfig(statePath)`, and `sameDirectory` is a wrapper that only renames `samePath` — export the one that exists (rule: the typescript extension's "name the block for what it answers"; a name that says how, not what, is a smell)
- [x] Shape (Build Phase 1): reviewed the six changed files, every extension's rules readable. One finding, above. Left as is, with reasoning: `claude-md-budget.js`'s refusal text carries its root/nested advice as an inline branch inside the one message — the refusal is one unit the agent reads whole, and a named builder would move the text away from the exit it explains; the decision sequence (`resolveStatePath` → `readBudgets` → `isRootContextFile` → compare) is already four named steps. `config.ts` and `update.ts` mirror the three ensures beside them

#### Build Phase 1 Verification

- [x] A16, A14 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/context-tiers-budget`), and the existing budget tests still pass (`… vitest run src/__tests__/claude-md-budget`) — 19/19 across both files; `tsc --noEmit` and biome clean

#### Build Phase 1 Context

- [x] Root, replacing the budget convention's "blocks past" clause with "refuses growth past the budget; a shrinking edit is always allowed; nested files have their own budget" — root because it governs every context file. The root has 2 bytes of headroom, so this is a replacement that must not grow the entry; pay for any extra words inside the same entry

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/context-budget.md`: growth-not-size and the nested budget

### Build Phase 2: one token grammar, derived lesson state, pointers everywhere

- [x] Move the opener rule and the token pattern out of `lib/promises/vocabulary.ts` into `lib/tokens.ts` (`tokenPattern(kind, name)`, `anyTokenPattern(kind)`, kinds `promise` and `lesson`); promises import it; update the day-promises single-definition pin in the same commit
- [x] `lib/lessons/state.ts`: `lessonStates(root)` scans `scannableFiles(root)` for `lesson:` tokens and returns `{ name, state: "guarded" | "advisory", guardedBy: { file, kind: "hook" | "test" | "code" }[] }` per file in `.claude/lessons/` — derived on every call, never written. Guarded is **relative to the project scanned**: a community lesson guarded only by a dusk unit test reads advisory in a consumer, whose tree has no such test; only a hook-carried token is guarded everywhere. The ADR and the guide say so
- [x] `list_lessons` returns `state` and `guardedBy` per lesson; the tool description says so — plus `guarded` and `advisory` counts; a project that cannot be scanned (no git repository) gets its listing with a `scan` line saying why no state was derived, never every lesson marked advisory
- [x] `lib/context-pointers.ts`: walk every `CLAUDE.md` git knows about (`ls-files`), not only the root; a `lesson: <name>` token is a pointer that resolves to `.claude/lessons/<name>.md`; failures name the file and the pointer
- [x] Shape finding (Build Phase 2) — `src/tools/lesson-tools.ts`: the `list_lessons` handler derives the states with a not-scannable fallback *and* shapes the response, two jobs behind one MCP wrapper no unit test reaches; the derivation-with-fallback wants the name `lessonListing(projectRoot)` in `lib/lessons/state.ts`, leaving the tool to serialise. Also `lib/promises/vocabulary.ts` carries the new `tokens.js` import mid-file (rule: the typescript extension's "one reason to change per unit; a seam a test can reach")
- [x] Shape (Build Phase 2): reviewed the eight changed files, every extension's rules readable. One finding, above. Left as is, with reasoning: `checkPointers`' lesson-token block sits inline beside the path-pointer block it mirrors — eight lines, the same shape, in the one function that is "what does this content point at"; naming one and not the other would make the two kinds read as different questions. `tokens.ts`, `citations.ts`'s `citedTokens`, `contextFiles`, `checkAllContextPointers` and the CLI are each one named step

#### Build Phase 2 Verification

- [x] A7, A8, A11 pass (`… vitest run src/__tests__/context-tiers-lessons src/__tests__/context-tiers-pointers`), the promises suite still passes (`… vitest run src/__tests__/promises`) and `pnpm promises:check` exits 0 — 62 passed across the row files and every promise suite; the only reds are A5's nine cases, which share `context-tiers-lessons.test.ts` and pass at Build Phase 4. `promises:check` first refused `lib/tokens.ts` itself: its docblock spelled a token-shaped example, and the scanner read it as a citation of a promise that does not exist — the day-promises lesson, met on day one; the example is now described, not spelled

#### Build Phase 2 Context

- [x] mcp context (pending row until Build Phase 3): "`lib/tokens.ts` is the one token grammar for `promise:` and `lesson:`; a new token kind is added there, never as a second pattern"

#### Build Phase 2 Document

- [x] `reference/tools/indusk-mcp.md`: `list_lessons` state; `reference/cli/`: `context check-pointers` over every context file — the command had no reference page; `reference/cli/context.md` is new and in the sidebar

### Build Phase 3: the nested files exist, and the planning one ships

- [x] `apps/indusk-mcp/templates/planning/CLAUDE.md` (initially only its purpose line — no codeword in a file consumers receive; A3 asserts a real rule sentence that Build Phase 4 moves there); `init` writes and `update` overwrites `.indusk/planning/CLAUDE.md` from it, through the same path skills take
- [x] Parity: add the planning file to `skill-sync-parity`'s byte-equality set
- [x] **Replace** `apps/indusk-admin/CLAUDE.md` and `apps/indusk-mcp/CLAUDE.md` — both already exist: the admin one is the single line `@AGENTS.md`, the mcp one is a 485-byte unfilled copy of `templates/CLAUDE.md` (`# {Project Name} — Project Context`) that every session touching an mcp file has been loading. Each becomes its purpose line; both get register rows (deleted content, with the reason) — the admin's `@AGENTS.md` turned out to import a real file (`apps/indusk-admin/AGENTS.md`: the conduct rules plus the Next.js rules block the framework injects), so it is kept above the purpose line; the register says so
- [x] Land the pending rows from Test Phase 1 and Build Phase 2 Context in the planning **template** (so `.indusk/planning/CLAUDE.md` follows by parity) and the mcp file
- [x] Shape finding (Build Phase 3) — `src/bin/commands/init.ts`: the planning-context line maps the sync result to its printed verb with a four-way nested ternary inside the `console.info` call; a result→verb table beside it says the same thing readably (rule: the typescript extension's "a nested conditional expression wants a name or a table")
- [x] Shape (Build Phase 3): reviewed the ten changed files, every extension's rules readable. One finding, above. `planning-context.ts` is one function with one job and a seam A4 reaches through the CLI; `update.ts` prints the result word as is; the parity pin mirrors the skill pin beside it; the rest is prose

#### Build Phase 3 Verification

- [x] A4 passes (`… vitest run src/__tests__/context-tiers-ship src/__tests__/skill-sync-parity`); A1, A2 still pass (`pnpm e2e -- context-tiers`) — 36/36 across the ship, parity, init and update suites; A1 and A2 green on the real `claude`, A17 still red (Build Phase 5)

#### Build Phase 3 Context

- [x] Root, Architecture: the tree diagram's `.claude/skills/` line gains the planning context file beside it, and the `CLAUDE.md` line says "root — design intent only; nested files per area" — a rewrite of two existing lines, not an addition, because the root has no headroom until Build Phase 4 — done on the `.indusk/` line ("planning/ (+ shipped CLAUDE.md)") and the `CLAUDE.md` line, +7 bytes; the root sits at 61,435

#### Build Phase 3 Document

- [x] New `apps/docs/src/guide/context-tiers.md` (stub: the four kinds and the three files), added to the sidebar in `apps/docs/src/.vitepress/config.ts` — the stub also carries the lesson token and the per-project reading of guarded; the decision diagram waits for Build Phase 4

### Build Phase 4: the register and the root rewrite

- [x] `register.md`: one row per root entry at the baseline commit — entry, tier (enforcer / directory / root / `current.md` / deleted), destination, and for enforcer rows the test or hook and its lesson; for each enforcer row, check whether the enforcer holds the *whole* claim, and keep any unenforced remainder as prose in the row's destination
- [x] For each enforcer row without a lesson, write the lesson (`add_lesson`), then put `lesson: <name>` at the start of the enforcer's assertion message or refusal line (A5, A6) — every enforcer row's lesson already existed, so none was written: the eight pins and the lifecycle pin name `structural-single-definition-test-for-must-agree-invariants`, the skill parity pin `mirrored-artifacts-need-structural-parity-tests`, the admin's lifecycle-render pin `define-the-vocabulary-once-before-rendering-it`, trunk-guard `trunk-guard-edit-refusal-is-not-a-bash-workaround`, check-gates `test-red-at-earliest-writable-phase`
- [x] Move directory rows into `.indusk/planning/CLAUDE.md` (and its template), `apps/indusk-admin/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md` — plus a fourth file, `apps/indusk-mcp/hooks/CLAUDE.md`, for the hook-port rules: with them inside, the mcp file overran its 16 KB budget, and the hooks directory is where those rules apply. Sizes: planning 5,433, admin 4,659, mcp 15,461, hooks 2,426
- [x] Move Current State to `current.md`'s shared region, after retiring every reader of the root section — more than a grep of `src` finds: `SECTION_NAMES` in `lib/context-parser.ts` becomes five (and `context-parser.test.ts` with it), `update_context`'s `z.enum(SECTION_NAMES)` schema follows, `check-pointers`' `**Version**:` claim check moves to read `current.md`'s shared region, `templates/CLAUDE.md` (the consumer root template) drops the section, the five skills that write to it (`claude-md` — which also says "exactly six sections, never remove" —, `retrospective`, `compact-context`, `planner`, `catchup`) are rewritten, and the context-skill ADR's "fixed six-section structure" gets a dated amendment note (A12)
- [x] Rewrite the root to what the register leaves it, adding the Key Decisions line for this ADR (deferred from acceptance: the root was 2 bytes under budget) — 61,438 → 14,667 bytes; the root holds orientation, a Context-tiers paragraph, nine conventions, the decision index and two gotchas
- [x] Shape (Build Phase 4): reviewed the 36 changed files, every extension's rules readable. Nothing found. The code this phase wrote is small: `currentMdVersionClaims` in `context-pointers.ts` is one named function answering one question (version claims in the shared region, line numbers rebased), the token edits are message strings, and `context-parser.ts` lost one list member. The rest is prose and test messages
- [x] `indusk context check-pointers` passes over every file — 41 pointers across 8 files (the five context files, the two templates, `current.md`'s version claims), all resolve

#### Build Phase 4 Verification

- [x] A5, A6, A10, A12 pass (`… vitest run src/__tests__/context-tiers-lessons src/__tests__/context-tiers-hook-lesson src/__tests__/context-tiers-register`); A3 passes (`pnpm e2e -- context-tiers`); `pnpm test` green — A3 PRESENT on the real `claude`. `pnpm test`: admin 341/341; mcp 1699 passed, 18 failed, all accounted for: 9 the known fresh-worktree admin-bundle group (12/12 once the bundle is built), 8 rows that pass at Build Phases 5–6 (A9, A15, A13), and 1 real catch — `registry-leak-scan` refused the A4 test for spawning `init`/`update` without naming `INDUSK_HOME`; the helper did pin it, and the test now pins it explicitly too

#### Build Phase 4 Context

- [x] The register is this phase's context work; confirm every row's destination exists and `check-pointers` passes — five context files plus `current.md`'s shared region, every row's destination among them; `check-pointers` PASS over 8 files

#### Build Phase 4 Document

- [x] `guide/context-tiers.md`: where a new rule goes — the decision diagram (Mermaid), the token, and that guarded is relative to the project scanned (a hook-carried token is guarded everywhere; a test-carried one only where that test lives) — plus a section on the register

### Build Phase 5: the skills route by tier

- [x] `/claude-md`: the routing table becomes the tier table
- [x] `/planner`: a Context gate item names its tier and destination; one aimed at the root says why it must be always-on. If A17 was red, `/planner`'s first step reads `.indusk/planning/master.md` before writing any plan document, so the planning rules are loaded when a plan's first file is authored
- [x] `/retrospective`: the compaction step becomes classification-at-close — every entry the plan authored is placed in a tier; the periodic pass moves one root entry to a token or a nested file
- [x] `/catchup`: skim only advisory lesson titles; state both counts
- [x] **A17 restated (goalpost change, recorded):** as written, A17 asserted that a bare Write to an unread planning directory loads the planning rules. Test Phase 1 measured that Claude Code does not — it loads nested files on Read only — and no change in this repository can alter that, so the row could never pass. What this plan can make true is the mechanism the fix relies on: `/planner` reads `master.md` first, and after that read a written plan file has the rules. The probe now follows that step (Read then Write) and a skill-text check pins the step; the original measurement stays recorded in Test Phase 1's checklist. The Asserts text above was changed to match, and this note is the record of why
- [x] Resync every installed copy under `.claude/skills/`
- [x] Shape (Build Phase 5): `prepareShapeReview` would list only skills (prose) and two test files; no code was written this phase, so there is no unit to judge for craft. The skill edits were reviewed as prose against the tier table they now carry

#### Build Phase 5 Verification

- [x] A9, A15 pass (`… vitest run src/__tests__/context-tiers-skills src/__tests__/skill-sync-parity`); A17 passes (`pnpm e2e -- context-tiers`) — 32/32 across the two files (A17's skill-text check included); the e2e probe 4/4 on the real `claude`: after reading the master, the written brief carried both the root and the planning codewords

#### Build Phase 5 Context

- [x] Planning context: the Context gate item shape (tier + destination; root needs a reason)

#### Build Phase 5 Document

- [x] `reference/skills/` pages for `/claude-md`, `/planner`, `/retrospective`, `/catchup` — the planner's page is `plan.md`; `claude-md.md` is five sections plus the tier table, with the Current State example removed

### Build Phase 6: the lowered budget

- [x] Set `context.claude_md_budget_bytes` to the root's size plus at least 25 % and `context.claude_md_budget_reason` beside it (`.indusk/config.json`), and lower the template default for new projects only if the guide argues for it
- [x] Shape (Build Phase 6): no code was written this phase — one config block, one root convention line, a guide section and a changelog entry — so there is no unit to judge for craft

#### Build Phase 6 Verification

- [x] A13 passes (`… vitest run src/__tests__/context-tiers-register`); the full suite is green (`pnpm test`); A1–A3 pass (`pnpm e2e -- context-tiers`) — A13 5/5 against the final root (14,678 of 18,432 bytes, 79.6 %); `pnpm test` green: mcp 1,719 passed / 5 skipped, admin 341, `promises:check` clean (with the admin bundle built in this worktree); e2e 4/4 (A1, A2, A3, A17); `check-pointers` PASS

#### Build Phase 6 Context

- [x] Root: the budget convention states the new value and points to its reason in config

#### Build Phase 6 Document

- [x] `guide/context-budget.md` and `apps/docs/src/changelog.md` Unreleased: the lowered budget, `lesson:` tokens, the shipped planning file — the guide also says why a new project's default stays 61,440

### Build Phase 7: Falsification — a guard nobody can see, and a workbench read as a flat project

**Goal**: verify whether the attested state holds against two kinds of failure. The plan's central claim is that a rule an enforcer holds is *guarded*, and `list_lessons` says so — but the scan that decides it was never run against the register's own enforcer rows, and one of them does not read. And three of the plan's readers (the budget hook, the lesson scan, the pointer walk) locate files the way a flat project does; in a workbench, where the code sits in a declared repo the workbench's git ignores, each one reads less than it reports. Each row below is one hypothesis; each item is the fix.

What the investigation found, row by row:

- **A18** — confirmed by running the scan over this repository: `lessonStates` reads `test-red-at-earliest-writable-phase` as **advisory**, guarded by nothing. `check-gates.js` carries the token as `…done.\nlesson: test-red-at-earliest-writable-phase` inside one template string, and the token grammar's opener (`lib/tokens.ts`) accepts a comment opener earlier on the line or a quote *directly* before — a `\n` escape is neither. trunk-guard's token, a string of its own, reads. The ADR says a hook-carried token travels with the hook and is guarded everywhere; for this hook it is guarded nowhere, and A6 (the hook prints the line) passes because it reads the hook's output, not the scan.
- **A19** — A10 checks that every baseline entry has a register row with a non-empty destination; nothing checks that an `enforcer` row's named enforcer carries its token. Row 39 names `apps/indusk-mcp/hooks/validate-impl-structure.js` as the enforcer for `lesson: test-red-at-earliest-writable-phase`; that file contains no `lesson:` at all. Row 37 names `check-gates.js`, which A18 shows the scan cannot read. Two of the register's ten enforcer rows claim a guard the plan's own state derivation denies.
- **A20** — `isRootContextFile` in `claude-md-budget.js` says root when the file's directory is the state root or a declared repo's checkout. In a workbench, a plan worktree of the code repo sits under the workbench root (no `.indusk/` of its own, so the walk-up lands on the workbench) and is named by no declaration — so the repo's root `CLAUDE.md` in that worktree is judged by the 16 KB nested budget. Worktree-per-plan is the default and a plan's Context gate edits the worktree's copy, so a consumer root between 16 KB and its root budget has every growing Context edit refused, with a message calling it a nested file. A14 covered the trunk checkout and not its worktrees.
- **A21** — `list_lessons` scans the MCP's `projectRoot`. In a workbench that is the workbench root, whose `.gitignore` names the trunk and the worktrees directory, so `git ls-files --others --exclude-standard` never lists a file in the code repo. A consumer test carrying a token reads advisory — the "verdict nobody reached" `lessonListing`'s own docblock says it refuses to give, arriving through an empty scan rather than a throw. `resolveCheckRoots` (`lib/health.ts`) is the existing answer to "which roots hold the code".
- **A22** — `contextFiles` is the same `ls-files` from the same root. In a workbench it lists the workbench's own `CLAUDE.md` and none of the code repo's — the repo's root file and every nested one. `check-pointers` prints PASS over files it never opened.

- [x] Author A18–A22 red before any fix: A18 and A21 in `context-tiers-lessons.test.ts`, A19 in `context-tiers-register.test.ts`, A20 in `context-tiers-budget.test.ts` (the hook spawned over a workbench fixture with a real `git worktree add` of the declared repo — `helpers/versioned-workbench.ts`), A22 in `context-tiers-pointers.test.ts`. Run each and read each failure — all red on their own assertions: A18 "advisory" for the fixture hook and `[]` for check-gates; A19 names rows 37 and 39; A20 refused as "nested context file; budget 300" in all four layouts; A21 "advisory" in all four; A22 "0 pointer(s) scanned across 1 context file(s): CLAUDE.md" in all four
- [x] `lib/tokens.ts`: `TOKEN_OPENER` also accepts a `\n` escape directly before the token — the start of a message line inside a string, which is where the ADR puts a lesson token. Re-run `pnpm promises:check` against this repository to confirm the wider opener cites no promise that does not exist — it did: widened for both kinds, `always-on-falsification.test.ts`'s injected frontmatter (a string spelling a `\n` then a promise token) read as a citation of a promise that does not exist. So the `\n` opener is the lesson kind's only (`openerFor` in the same module; `TOKEN_OPENER` unchanged); `promises check` exits 0
- [x] `hooks/validate-impl-structure.js`: the trajectory refusal (Writable-at ≤ Passes-at, the earliest-authorable rule) names `lesson: test-red-at-earliest-writable-phase` in the same form — or, if no refusal there enforces that lesson's rule, register row 39 is reclassified with its remainder moved to the planning file. Resync `.claude/hooks/` — the two rationale-completeness refusals (a row written later than the baseline must say why) are this lesson's rule; both carry the token, in the hook and in its TS mirror `lib/trajectory/validator.ts`; installed copy resynced
- [x] `context-tiers-register.test.ts`: A19's check reads each `enforcer` row's destination files and lesson through `lessonStates`, so the register and the derivation cannot disagree again — authored that way as the red test: no second parser of tokens, the row's named files matched against `guardedBy`
- [x] `hooks/claude-md-budget.js`: a `CLAUDE.md` whose directory is the top of a git checkout (`.git` present — a directory in a clone, a file in a worktree) is a root file, beside the state-root and declared-repo rules. A flat project's sibling worktree whose `.indusk/` is untracked reads root by the same rule
- [x] `lib/lessons/state.ts`: `lessonStates` scans the project root and each of `resolveCheckRoots`' roots, paths reported relative to the project root, so a token in a declared repo's test guards
- [x] `lib/context-pointers.ts`: `checkAllContextPointers` walks the workbench root and each declared repo, each file's pointers resolved against its own repo; `src/bin/commands/context.ts` names the repo beside the file — the repos come from `readWorkbenchRepos` + `repoDir` (the one reader). A22's fixture first named `src/…` paths, which the pointer grammar (`.indusk`, `apps`, `docker`, `packages`, `.claude`) does not read, so it would have stayed red after the fix for the wrong reason; corrected to `apps/…` paths, assertion unchanged
- [x] Shape (Build Phase 7): reviewed the nine code files this phase changed, every extension's rules readable. Nothing found. `openerFor` names the one per-kind difference in the grammar beside the shared opener; `citedLessons` is one job (which roots, then one scan each); `checkAllContextPointers` lists its roots then maps them; the CLI's `where` names how a report is labelled; the budget hook gained one line under the docblock that says why. Left as is: `citedLessons` dedupes roots by realpath inline — four lines, used once

#### Build Phase 7 Verification

- [x] A18–A22 pass and A5–A8, A10, A11, A14, A16 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/context-tiers-`); `pnpm promises:check` clean — 51/51 across the context-tiers files; `promises check` exits 0
- [x] `lessonStates` printed for this repository reads `test-red-at-earliest-writable-phase` guarded, by `check-gates.js` as kind `hook` — guarded by `check-gates.js` and `validate-impl-structure.js` (package and installed copies, kind `hook`) and `lib/trajectory/validator.ts` (kind `code`)
- [x] The full suite is green (`pnpm test`); A1–A3 and A17 pass (`pnpm e2e -- context-tiers`) — mcp 275 files passed / 1 skipped, admin 55 files passed, `promises check` clean; e2e 9/9 (the context-tiers file's four with the rest the filter matched). `pnpm check` fails on files this phase did not touch (`.indusk/config.json` and the vitepress config fail on main too; `.claude/hooks/eval-trigger.js` is untouched); this phase's 13 code files pass Biome

#### Build Phase 7 Context

- [x] directory (`apps/indusk-mcp/CLAUDE.md`), the entry on tooling detection over declared repos: the lesson scan and the pointer walk join it — anything that reads "what the code says" in a workbench reads the declared repos, never the wrapper alone
- [x] directory (`apps/indusk-mcp/hooks/CLAUDE.md`): a hook's lesson token opens a line of its refusal — its own string, or directly after a `\n` — and the register's enforcer rows are pinned against the scan

#### Build Phase 7 Document

- [x] `guide/context-tiers.md`: where a token may sit in a refusal message, and that guarded is read across a workbench's declared repos; `reference/cli/context.md`: the workbench walk; `guide/context-budget.md`: a root context file is one at the top of any checkout

### Build Phase 8: Cleanup — one home for where a declared repo lives, one reader of the register

**Goal**: decompose what this plan's later phases grew across files, per the rule of three and the project's single-definition pattern for must-agree facts. The plan's own code is small and Shape reviewed it phase by phase; what Shape could not see is the copy a later phase wrote of something an earlier one, or the codebase, already spelled. Two such copies, and a reasoned leave-as-is for every file the scan flagged.

- [x] Extract `declaredRepoDirs(projectRoot): { name, dir }[]` into `lib/worktree/repos.ts`, beside `readWorkbenchRepos`, `resolveReposRoot` and `repoDir` — the join of those two rules is spelled at four sites under `src/lib` (`health.ts`'s `resolveCheckRoots`, `worktree/roots.ts`, `papers/destination.ts`, and `context-pointers.ts`, which Build Phase 7 added); it is the one fact "where a declared repo's checkout is", and the layout lessons say its copies drift silently. Basis: rule of three; the single-definition pattern
- [x] `resolveCheckRoots` (`health.ts`), `worktree/roots.ts`, `papers/destination.ts` and `checkAllContextPointers` (`context-pointers.ts`) read the directory from `declaredRepoDirs`; `lib/lessons/state.ts` imports its roots from `worktree/repos.ts` rather than from `health.ts` — a lesson scan reaching into the health module for a path rule is the wrong boundary. The hook port `declaredRepoDirsAt` (`hooks/_hook-paths.js`) names `declaredRepoDirs` as what it mirrors
- [x] Discovered: the hook port `declaredRepoDirsAt` read an absent `repos_root` as the workbench root, where `resolveReposRoot` reads the workbench's parent — written by this plan's Build Phase 1, found by reading the two side by side while renaming what the port mirrors. In such a workbench the repo's root `CLAUDE.md` was judged nested. A test case under A14 (`context-tiers-budget.test.ts`, "a workbench that declares no repos_root") was written red first, then the port's default became `..`; installed copy resynced
- [x] Extract the register-row reader into `src/__tests__/helpers/register.ts` (`registerRows(md)` → `{ row, section, entry, tier, destination, remainder }`) — three copies of the same split-and-filter across two test files (A10's `registerRows`, A5's inline parse in `context-tiers-lessons.test.ts`, A19's inline parse in `context-tiers-register.test.ts`), each reading a different subset of columns. Basis: rule of three; one parser per document shape (the trajectory-row lesson)
- [x] (reviewed `src/bin/commands/init.ts` (1,343 lines) and `update.ts` (1,008) — left as-is for this plan: each gained one call to `syncPlanningContext` and its printed result, beside the skill sync it mirrors; their size predates this plan and decomposing them is a plan of its own, not a cleanup of this one's output)
- [x] (reviewed `src/lib/config.ts` (621) — left as-is: `ensureContextConfig` and its two default constants sit beside the other named ensures that delegate to `ensureConfigBlock`, which is the module's shape)
- [x] (reviewed `hooks/validate-impl-structure.js` (761), `hooks/trunk-guard.js` (465) and `lib/trajectory/validator.ts` (547) — left as-is: this plan added a lesson token to existing refusal strings and nothing else)
- [x] (reviewed the flagged skills, skill reference pages and the changelog — left as-is: prose, outside code decomposition; the skills' size is the planner's and retrospective's content)
- [x] (reviewed `lib/planning-context.ts` against the skill sync in `init.ts`/`update.ts` — left as-is: two package-owned copy routines with different rules, a directory glob against one file, so not yet a third instance of one shape)

#### Build Phase 8 Verification

- [ ] A23 and A24 pass, and A5, A10, A11, A19, A21, A22 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/workbench-repos-single-definition src/__tests__/context-tiers-`)
- [ ] The everyday suite is green (`pnpm test`), and so is the system tier where it touches these readers (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts` — only if the system tier has merged into this branch by then; otherwise the full `pnpm test` covers it)

#### Build Phase 8 Context

- [ ] directory (`apps/indusk-mcp/CLAUDE.md`), the workbench topology entry: "where a declared repo's checkout is" has one home, `declaredRepoDirs` (`worktree/repos.ts`), beside the one reader; pinned by `workbench-repos-single-definition.test.ts`

#### Build Phase 8 Document

- [ ] `apps/docs/src/reference/cli/workbench.md`: a short note on where a declared repo's checkout lives — `repos_root` (else `sibling_parent`, else the workbench root) joined with the repo's declared `path` or name — and that every reader asks one function for it

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/claude-md-budget.js` | growth, not size; nested budget |
| `apps/indusk-mcp/src/lib/tokens.ts` | new: shared token grammar |
| `apps/indusk-mcp/src/lib/promises/vocabulary.ts` | imports the grammar |
| `apps/indusk-mcp/src/lib/lessons/state.ts` | new: derived guarded/advisory |
| `apps/indusk-mcp/src/lib/context-pointers.ts` | every context file; `lesson:` pointers |
| `apps/indusk-mcp/templates/planning/CLAUDE.md` | new, shipped |
| `apps/indusk-mcp/src/bin/commands/{init,update}.ts` | ship the planning file |
| `apps/indusk-admin/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md` | replaced — exist today as `@AGENTS.md` and an unfilled template copy |
| `apps/indusk-mcp/src/lib/context-parser.ts`, `src/tools/context-tools.ts`, `templates/CLAUDE.md` | five sections, not six |
| `CLAUDE.md`, `.indusk/current.md`, `.indusk/config.json` | rewrite, Current State, budget |
| enforcers named in the register | `lesson:` tokens |
| `apps/indusk-mcp/skills/{claude-md,planner,retrospective,catchup}.md` | routing by tier |
| `apps/docs/src/guide/context-tiers.md` + others | docs |

## Dependencies
- `admin-plan-type` landed (it touched the planner skill and the admin).
