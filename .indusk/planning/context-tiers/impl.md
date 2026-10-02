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
| A7 | `list_lessons` reports each lesson guarded or advisory; adding the token to a test makes it guarded on the next call, removing it makes it advisory, nothing else written | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A8 | A lesson named only in prose — a guide, the lesson file, a changelog — stays advisory | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A11 | `context check-pointers` resolves every pointer in every context file, including `lesson:` tokens, and fails naming the file and pointer that does not resolve | Test Phase 1 | Build Phase 2 | written | apps/indusk-mcp/src/__tests__/context-tiers-pointers.test.ts |
| A4 | `indusk update` on a consumer writes `.indusk/planning/CLAUDE.md` byte-identical to the package's, and a second `update` changes nothing | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/__tests__/context-tiers-ship.test.ts |
| A1 | A session at a fixture's root that reads a plan's `impl.md` has the planning context file's codeword, which the fixture's root does not carry | Test Phase 1 | Test Phase 1 | passing | manual: pnpm e2e -- context-tiers |
| A2 | A session that reads no admin file lacks the admin codeword; one that reads an admin component has it | Test Phase 1 | Test Phase 1 | passing | manual: pnpm e2e -- context-tiers |
| A17 | A session that **writes** a new file under `.indusk/planning/<new>/` with nothing under `.indusk/planning/` read first has the planning rules — the moment `/planner` authors a plan's first document | Test Phase 1 | Build Phase 5 | written | manual: pnpm e2e -- context-tiers |
| A3 | This repository's own `.indusk/planning/CLAUDE.md` reaches a session that reads an impl — a rule sentence the real file carries after the register moves it there, not a codeword | Test Phase 1 | Build Phase 4 | written | manual: pnpm e2e -- context-tiers |
| A5 | Each of the eight single-definition pins named in the root today (`shared-resolution`, `shape/shared-definitions`, `workbench-repos-single-definition`, `execution-roots-single-definition`, `head-sha-single-definition`, `promises-cleanup`, `plan-worktrees-single-definition`, `impl-headings`) has a failure message beginning `lesson: <name>`, and the name is a lesson file; the register names at least these eight as enforcer rows | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/context-tiers-lessons.test.ts |
| A6 | A hook refusal names its lesson in the same form — trunk-guard's edit-on-main refusal names `trunk-guard-edit-refusal-is-not-a-bash-workaround`; check-gates' test-first refusal names `test-red-at-earliest-writable-phase` | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/context-tiers-hook-lesson.test.ts |
| A10 | Every entry the root held at the baseline commit has a register row with a destination; the check names any that has none | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/context-tiers-register.test.ts |
| A12 | The root has no Current State section; its content is in `current.md`'s shared region; nothing reads the old heading | Test Phase 1 | Build Phase 4 | written | apps/indusk-mcp/src/__tests__/context-tiers-register.test.ts |
| A9 | The catchup skill skims only advisory lesson titles and states the guarded and advisory counts | Test Phase 1 | Build Phase 5 | written | apps/indusk-mcp/src/__tests__/context-tiers-skills.test.ts |
| A15 | A Context gate item names its tier and destination, and one aimed at the root says why it must be always-on — in `/planner` and `/claude-md`, package and installed copies | Test Phase 1 | Build Phase 5 | written | apps/indusk-mcp/src/__tests__/context-tiers-skills.test.ts |
| A13 | The root is at least 20 % under its configured budget, and the budget's reason is in `.indusk/config.json` | Test Phase 1 | Build Phase 6 | written | apps/indusk-mcp/src/__tests__/context-tiers-register.test.ts |

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

- [ ] Create this plan's worktree with `indusk worktree create context-tiers`, and record the baseline commit (the HEAD it branched from) at the top of `register.md`, which A10 reads
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

#### Build Phase 1 Verification

- [x] A16, A14 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/context-tiers-budget`), and the existing budget tests still pass (`… vitest run src/__tests__/claude-md-budget`) — 19/19 across both files; `tsc --noEmit` and biome clean

#### Build Phase 1 Context

- [ ] Root, replacing the budget convention's "blocks past" clause with "refuses growth past the budget; a shrinking edit is always allowed; nested files have their own budget" — root because it governs every context file. The root has 2 bytes of headroom, so this is a replacement that must not grow the entry; pay for any extra words inside the same entry

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/context-budget.md`: growth-not-size and the nested budget

### Build Phase 2: one token grammar, derived lesson state, pointers everywhere

- [ ] Move the opener rule and the token pattern out of `lib/promises/vocabulary.ts` into `lib/tokens.ts` (`tokenPattern(kind, name)`, `anyTokenPattern(kind)`, kinds `promise` and `lesson`); promises import it; update the day-promises single-definition pin in the same commit
- [ ] `lib/lessons/state.ts`: `lessonStates(root)` scans `scannableFiles(root)` for `lesson:` tokens and returns `{ name, state: "guarded" | "advisory", guardedBy: { file, kind: "hook" | "test" | "code" }[] }` per file in `.claude/lessons/` — derived on every call, never written. Guarded is **relative to the project scanned**: a community lesson guarded only by a dusk unit test reads advisory in a consumer, whose tree has no such test; only a hook-carried token is guarded everywhere. The ADR and the guide say so
- [ ] `list_lessons` returns `state` and `guardedBy` per lesson; the tool description says so
- [ ] `lib/context-pointers.ts`: walk every `CLAUDE.md` git knows about (`ls-files`), not only the root; a `lesson: <name>` token is a pointer that resolves to `.claude/lessons/<name>.md`; failures name the file and the pointer

#### Build Phase 2 Verification

- [ ] A7, A8, A11 pass (`… vitest run src/__tests__/context-tiers-lessons src/__tests__/context-tiers-pointers`), the promises suite still passes (`… vitest run src/__tests__/promises`) and `pnpm promises:check` exits 0

#### Build Phase 2 Context

- [ ] mcp context (pending row until Build Phase 3): "`lib/tokens.ts` is the one token grammar for `promise:` and `lesson:`; a new token kind is added there, never as a second pattern"

#### Build Phase 2 Document

- [ ] `reference/tools/indusk-mcp.md`: `list_lessons` state; `reference/cli/`: `context check-pointers` over every context file

### Build Phase 3: the nested files exist, and the planning one ships

- [ ] `apps/indusk-mcp/templates/planning/CLAUDE.md` (initially only its purpose line — no codeword in a file consumers receive; A3 asserts a real rule sentence that Build Phase 4 moves there); `init` writes and `update` overwrites `.indusk/planning/CLAUDE.md` from it, through the same path skills take
- [ ] Parity: add the planning file to `skill-sync-parity`'s byte-equality set
- [ ] **Replace** `apps/indusk-admin/CLAUDE.md` and `apps/indusk-mcp/CLAUDE.md` — both already exist: the admin one is the single line `@AGENTS.md`, the mcp one is a 485-byte unfilled copy of `templates/CLAUDE.md` (`# {Project Name} — Project Context`) that every session touching an mcp file has been loading. Each becomes its purpose line; both get register rows (deleted content, with the reason)
- [ ] Land the pending rows from Test Phase 1 and Build Phase 2 Context in the planning **template** (so `.indusk/planning/CLAUDE.md` follows by parity) and the mcp file

#### Build Phase 3 Verification

- [ ] A4 passes (`… vitest run src/__tests__/context-tiers-ship src/__tests__/skill-sync-parity`); A1, A2 still pass (`pnpm e2e -- context-tiers`)

#### Build Phase 3 Context

- [ ] Root, Architecture: the tree diagram's `.claude/skills/` line gains the planning context file beside it, and the `CLAUDE.md` line says "root — design intent only; nested files per area" — a rewrite of two existing lines, not an addition, because the root has no headroom until Build Phase 4

#### Build Phase 3 Document

- [ ] New `apps/docs/src/guide/context-tiers.md` (stub: the four kinds and the three files), added to the sidebar in `apps/docs/src/.vitepress/config.ts`

### Build Phase 4: the register and the root rewrite

- [ ] `register.md`: one row per root entry at the baseline commit — entry, tier (enforcer / directory / root / `current.md` / deleted), destination, and for enforcer rows the test or hook and its lesson; for each enforcer row, check whether the enforcer holds the *whole* claim, and keep any unenforced remainder as prose in the row's destination
- [ ] For each enforcer row without a lesson, write the lesson (`add_lesson`), then put `lesson: <name>` at the start of the enforcer's assertion message or refusal line (A5, A6)
- [ ] Move directory rows into `.indusk/planning/CLAUDE.md` (and its template), `apps/indusk-admin/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`
- [ ] Move Current State to `current.md`'s shared region, after retiring every reader of the root section — more than a grep of `src` finds: `SECTION_NAMES` in `lib/context-parser.ts` becomes five (and `context-parser.test.ts` with it), `update_context`'s `z.enum(SECTION_NAMES)` schema follows, `check-pointers`' `**Version**:` claim check moves to read `current.md`'s shared region, `templates/CLAUDE.md` (the consumer root template) drops the section, the five skills that write to it (`claude-md` — which also says "exactly six sections, never remove" —, `retrospective`, `compact-context`, `planner`, `catchup`) are rewritten, and the context-skill ADR's "fixed six-section structure" gets a dated amendment note (A12)
- [ ] Rewrite the root to what the register leaves it, adding the Key Decisions line for this ADR (deferred from acceptance: the root was 2 bytes under budget)
- [ ] `indusk context check-pointers` passes over every file

#### Build Phase 4 Verification

- [ ] A5, A6, A10, A12 pass (`… vitest run src/__tests__/context-tiers-lessons src/__tests__/context-tiers-hook-lesson src/__tests__/context-tiers-register`); A3 passes (`pnpm e2e -- context-tiers`); `pnpm test` green

#### Build Phase 4 Context

- [ ] The register is this phase's context work; confirm every row's destination exists and `check-pointers` passes

#### Build Phase 4 Document

- [ ] `guide/context-tiers.md`: where a new rule goes — the decision diagram (Mermaid), the token, and that guarded is relative to the project scanned (a hook-carried token is guarded everywhere; a test-carried one only where that test lives)

### Build Phase 5: the skills route by tier

- [ ] `/claude-md`: the routing table becomes the tier table
- [ ] `/planner`: a Context gate item names its tier and destination; one aimed at the root says why it must be always-on. If A17 was red, `/planner`'s first step reads `.indusk/planning/master.md` before writing any plan document, so the planning rules are loaded when a plan's first file is authored
- [ ] `/retrospective`: the compaction step becomes classification-at-close — every entry the plan authored is placed in a tier; the periodic pass moves one root entry to a token or a nested file
- [ ] `/catchup`: skim only advisory lesson titles; state both counts
- [ ] Resync every installed copy under `.claude/skills/`

#### Build Phase 5 Verification

- [ ] A9, A15 pass (`… vitest run src/__tests__/context-tiers-skills src/__tests__/skill-sync-parity`); A17 passes (`pnpm e2e -- context-tiers`)

#### Build Phase 5 Context

- [ ] Planning context: the Context gate item shape (tier + destination; root needs a reason)

#### Build Phase 5 Document

- [ ] `reference/skills/` pages for `/claude-md`, `/planner`, `/retrospective`, `/catchup`

### Build Phase 6: the lowered budget

- [ ] Set `context.claude_md_budget_bytes` to the root's size plus at least 25 % and `context.claude_md_budget_reason` beside it (`.indusk/config.json`), and lower the template default for new projects only if the guide argues for it

#### Build Phase 6 Verification

- [ ] A13 passes (`… vitest run src/__tests__/context-tiers-register`); the full suite is green (`pnpm test`); A1–A3 pass (`pnpm e2e -- context-tiers`)

#### Build Phase 6 Context

- [ ] Root: the budget convention states the new value and points to its reason in config

#### Build Phase 6 Document

- [ ] `guide/context-budget.md` and `apps/docs/src/changelog.md` Unreleased: the lowered budget, `lesson:` tokens, the shipped planning file

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
