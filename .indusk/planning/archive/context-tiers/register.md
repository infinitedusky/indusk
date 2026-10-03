---
title: "Context tiers — classification register"
date: 2026-10-02
baseline: 9f108ede
---

# Context tiers — classification register

**Baseline**: `9f108ede` — the trunk commit this plan's worktree branched from.
A10 parses `git show 9f108ede:CLAUDE.md` into entries and fails naming any
entry without a row below. The root as it stood there is the whole input;
nothing is classified from memory.

One row per root entry. Tier is one of:

- `enforcer` — a test or hook already holds the rule; the row names it and the
  lesson its failure message carries (`lesson: <name>`). Where the enforcer
  holds only part of the claim, the remainder column says what stays as prose
  and where.
- `directory` — the rule applies in one area; the row names the context file:
  `planning` is `.indusk/planning/CLAUDE.md` (via its template), `mcp` is
  `apps/indusk-mcp/CLAUDE.md`, `admin` is `apps/indusk-admin/CLAUDE.md`.
- `root` — design intent, orientation, or a cross-cutting convention with no
  enforcer and no home directory; stays, compressed to its rule.
- `current.md` — operational state; the shared region of `.indusk/current.md`.
- `deleted` — removed, with the reason.

Every move compresses: the rule sentence travels, the narrative stays behind
the pointer the entry already carried (a decisions page, a lessons page, an
archived plan). The remainder column names what the destination keeps when a
row's enforcer holds only part of the claim.

## Pending rows (destinations not yet created)

Rules this plan's own Context gates produced before Build Phase 3 created the
nested files. Both landed in Build Phase 3.

| Rule | Destination | From | Landed |
|------|-------------|------|--------|
| A trajectory row's `Test` column may name a `manual:` command; `verify` reports it unverified, never passed | `.indusk/planning/CLAUDE.md` (template) | Test Phase 1 Context | Build Phase 3 |
| `lib/tokens.ts` is the one token grammar for `promise:` and `lesson:`; a new token kind is added there, never as a second pattern; the file that documents a marker must not spell one | `apps/indusk-mcp/CLAUDE.md` | Build Phase 2 Context | Build Phase 3 |

## Replaced nested files (Build Phase 3)

Not root entries, so not in the register table A10 reads; recorded here so
their removal has a reason.

| File | Held at baseline | Tier | Reason |
|------|------------------|------|--------|
| `apps/indusk-mcp/CLAUDE.md` | a 485-byte unfilled copy of `templates/CLAUDE.md` (`# {Project Name} — Project Context`, six empty section placeholders) | deleted | a placeholder loaded into every session that read an mcp file; nothing in it was a rule |
| `apps/indusk-admin/CLAUDE.md` | the single line `@AGENTS.md` | root (kept) | the import is real — `apps/indusk-admin/AGENTS.md` holds the conduct rules plus the Next.js rules block the framework injects — so it stays at the top of the replaced file, above the purpose line |

## Register

| # | Section | Entry (first words) | Tier | Destination | Enforcer / lesson | Remainder kept as prose |
|---|---------|---------------------|------|-------------|-------------------|-------------------------|
| 1 | Architecture | **Apps:** | root | root — Architecture | — | the label for the app list |
| 2 | Architecture | **indusk-mcp** — the InDusk MCP server | root | root — Architecture, one orientation line | — | the promise registry, mark and telemetry-serve mechanics → mcp |
| 3 | Architecture | **`indusk run <plan> --model <name>`** | directory | mcp | — | one clause in the root's indusk-mcp line names `run` and `verify` as the package's two Dawn commands |
| 4 | Architecture | **`indusk verify <plan> --phase N`** | directory | mcp | — | as row 3 |
| 5 | Architecture | **indusk-admin** — Next.js App Router | root | root — Architecture, one orientation line | — | LiveRefresh, bundling and the no-shadcn rule → admin |
| 6 | Architecture | **docs** — VitePress site | root | root — Architecture | — | — |
| 7 | Architecture | **MCP servers** (project `.mcp.json` keep-list | root | root — Architecture, compressed | — | the dash0 re-enable command → mcp |
| 8 | Architecture | **Skills** (process): planner, work | root | root — Architecture, compressed to the list and "edit in `apps/indusk-mcp/skills/`" | — | — |
| 9 | Architecture | **`/work`'s per-phase order gains Shape** | directory | planning | — | the library facts (`changedFilesForPhase`, the boundary record, the three writers) → mcp |
| 10 | Architecture | **Agent roles** (three tiers | root | root — Architecture, compressed | — | — |
| 11 | Conventions | pnpm workspaces + Turborepo | root | root — Conventions | — | — |
| 12 | Conventions | **Biome, not ESLint** | root | root — Conventions | — | — |
| 13 | Conventions | `pnpm test` runs all | root | root — Conventions, compressed | — | the `passWithNoTests` per-app rule → mcp |
| 14 | Conventions | **CLAUDE.md has a hard 60 KB budget | root | root — Conventions (rewritten in Build Phase 1) | — | — |
| 15 | Conventions | **Decay layer**: `indusk agent sweep` | directory | mcp | — | — |
| 16 | Conventions | **Hub push/pull**: `indusk sync promote` | directory | mcp | — | — |
| 17 | Conventions | **`/catchup` is dieted** | root | root — one line: an unrecorded violation outranks the roadmap; unreachable telemetry is said, never a zero | — | the diet's mechanics are the catchup skill's own and `/reference/skills/catchup`; deleted from context |
| 18 | Conventions | **`.indusk/current.md` is per-agent sections** | root | root — Conventions, compressed | — | the lock-file primitive → mcp |
| 19 | Conventions | **Session IDs sanitize at the boundary** | directory | mcp | — | — |
| 20 | Conventions | **`indusk agent list` shows worktree/branch | directory | mcp | — | — |
| 21 | Conventions | **Workbench topology is DECLARED, never inferred** | directory | mcp | — | — |
| 22 | Conventions | **`indusk workbench` = restore / sync | directory | mcp | — | — |
| 23 | Conventions | **Ignore rules are generated from declared locations** | directory | mcp | — | — |
| 24 | Conventions | **Tooling detection runs over the declared repos | directory | mcp | — | — |
| 25 | Conventions | **`indusk verify` judges the code repo | directory | mcp | — | — |
| 26 | Conventions | **The lifecycle is one definition** | enforcer | `apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts` | lesson: structural-single-definition-test-for-must-agree-invariants | "the lifecycle vocabulary is `lib/lifecycle.ts`, read by `parsePlan`, the retrospective gate and the admin" → mcp |
| 27 | Conventions | **A plan that adds a lifecycle position | enforcer | `apps/indusk-admin/src/lib/lifecycle-render-parity.test.ts` | lesson: define-the-vocabulary-once-before-rendering-it | the planning rule (a plan that adds a stage adds its rendering, as a Document gate item) → planning; the active-phase rule → admin |
| 28 | Conventions | **Worktree-per-plan is the default, and trunk refuses code** | enforcer | `apps/indusk-mcp/hooks/trunk-guard.js` | lesson: trunk-guard-edit-refusal-is-not-a-bash-workaround | the planning rule (Phase 1 opens with `indusk worktree create`; `worktree: none` opts out) → planning; the off switches → mcp |
| 29 | Conventions | **A plan's live copy is resolved by `lib/worktree/plan-worktrees.ts`** | enforcer | `apps/indusk-mcp/src/__tests__/plan-worktrees-single-definition.test.ts` | lesson: structural-single-definition-test-for-must-agree-invariants | the record's rules (gone/doubled/missing reported, never guessed; inert in a workbench) → mcp |
| 30 | Conventions | Plans live in `.indusk/planning/{kebab-case}/` | root | root — one line: plans live in `.indusk/planning/`; `/planner` first, not code | — | the document order and the `workflow:` rule → planning |
| 31 | Conventions | **Papers are plan documents** | directory | planning | — | staleness-by-hash and the malformed-status rule → mcp |
| 32 | Conventions | **`papers.destinations[]` and `promises.domains[]` are ensured | enforcer | `apps/indusk-mcp/src/__tests__/promises-cleanup.test.ts` | lesson: structural-single-definition-test-for-must-agree-invariants | `resolveDestination` and the workbench-only `repo` destination → mcp |
| 33 | Conventions | **`.indusk/promises/` is a plan document** | directory | planning | — | the mark, the Jaeger source rule, the announce-once rule, the token and owner rules → mcp |
| 34 | Conventions | **A skill's `description` is its routing key.** | directory | mcp | — | — |
| 35 | Conventions | **`indusk papers publish` commits in the destination | directory | mcp | — | — |
| 36 | Conventions | **Plan hierarchy is declared top-down | directory | planning | — | `readPlanDeclarations`' guards → mcp |
| 37 | Conventions | **Every impl phase has gates** | enforcer | `apps/indusk-mcp/hooks/check-gates.js` | lesson: test-red-at-earliest-writable-phase | the gate list, the OTel-role rule and `gate_policy` → planning |
| 38 | Conventions | **Trajectory rows may carry an optional `Test` column** | directory | planning | — | the exit-code rule and `verify.testCommand` → mcp |
| 39 | Conventions | **Test Trajectory** is mandatory in new impls | enforcer | `apps/indusk-mcp/hooks/validate-impl-structure.js` | lesson: test-red-at-earliest-writable-phase | the table shape, the ID rule and "writable-at = earliest authorable phase" → planning |
| 40 | Conventions | **Close-out rituals**: `/work` → `/falsify` | directory | planning | — | — |
| 41 | Conventions | **Shape's craft rules come from enabled extensions | directory | mcp | — | — |
| 42 | Conventions | **Retrospective compaction step** | directory | planning (rewritten by Build Phase 5 as classification-at-close) | — | — |
| 43 | Conventions | **Thin-lane eval rail** | directory | mcp | — | — |
| 44 | Conventions | **Eval agent** ("evaluator", never "judge") | directory | mcp | — | — |
| 45 | Conventions | Verification items in impls are runnable commands | directory | planning | — | "grep for importers before touching shared code" → root, one clause |
| 46 | Conventions | **`pnpm publish` packs the WORKING TREE | root | root — one line: bump on main after the merge (retrospective Step 11); `pnpm release` enforces the guard; never infer publish state from a version number | — | the guard's four refusals and the record-release rule → mcp |
| 47 | Conventions | Commit cadence: one commit per checklist item | root | root — Conventions | — | — |
| 48 | Conventions | Extensions own tool knowledge | root | root — Conventions, compressed | — | the `autoEnableExtensions` and `.env.example` mechanics → mcp |
| 49 | Conventions | **`indusk setup <cloned-repo>` one-shots workbench creation** | directory | mcp | — | — |
| 50 | Conventions | **The always-on image is built from `docker/`** | directory | mcp | — | "both are unrun until day-always-on-deploy closes" → current.md |
| 51 | Conventions | In local mode (`--local`) | directory | mcp | — | — |
| 52 | Key Decisions | Context skill is pure markdown instructions | root | root — Key Decisions (amended: five sections) | — | — |
| 53 | Key Decisions | Biome over ESLint | root | root — Key Decisions | — | — |
| 54 | Key Decisions | Vitest as committed test runner | root | root — Key Decisions | — | — |
| 55 | Key Decisions | Document skill (per-phase gate) | root | root — Key Decisions | — | — |
| 56 | Key Decisions | GSD-inspired: lessons registry | root | root — Key Decisions | — | — |
| 57 | Key Decisions | Plan-gate enforcement via Claude Code PreToolUse hooks | root | root — Key Decisions | — | — |
| 58 | Key Decisions | Extension system: one system, two sources | root | root — Key Decisions | — | — |
| 59 | Key Decisions | Excalidraw for informal diagrams | root | root — Key Decisions | — | — |
| 60 | Key Decisions | OTel as core instrumentation | root | root — Key Decisions | — | — |
| 61 | Key Decisions | Local init mode | root | root — Key Decisions | — | — |
| 62 | Key Decisions | Test Trajectory as canonical impl shape | root | root — Key Decisions | — | — |
| 63 | Key Decisions | Falsification ritual between work and retrospective | root | root — Key Decisions | — | — |
| 64 | Key Decisions | Cleanup ritual as falsify's twin | root | root — Key Decisions | — | — |
| 65 | Key Decisions | Three-tier agent roles + highlights queue | root | root — Key Decisions | — | — |
| 66 | Key Decisions | Admin UI: standalone Next.js read-only viewer | root | root — Key Decisions | — | — |
| 67 | Key Decisions | Local telemetry: native-binary Jaeger | root | root — Key Decisions | — | — |
| 68 | Key Decisions | `rationale_baseline` frontmatter | root | root — Key Decisions | — | — |
| 69 | Key Decisions | Doppler extension as the env layer | root | root — Key Decisions | — | — |
| 70 | Key Decisions | Multi-agent coordination: per-agent sections | root | root — Key Decisions | — | — |
| 71 | Key Decisions | Git-only substrate (1.31.0) | root | root — Key Decisions | — | — |
| 72 | Key Decisions | Worktree visibility: worktree-per-plan default | root | root — Key Decisions | — | — |
| 73 | Key Decisions | Workbench setup one-shot | root | root — Key Decisions | — | — |
| 74 | Key Decisions | Dawn hook parity: invariants + eval rail | root | root — Key Decisions | — | — |
| 75 | Key Decisions | Test phases as structure | root | root — Key Decisions | — | — |
| 76 | Key Decisions | Shape check: per-phase craft review | root | root — Key Decisions | — | — |
| 77 | Key Decisions | Dawn verify (component 6, the keystone) | root | root — Key Decisions | — | — |
| 78 | Key Decisions | InDusk Makeover (2026-07-23) | root | root — Key Decisions | — | — |
| 79 | Key Decisions | Versioned workbench (1.37.0–1.38.3) | root | root — Key Decisions | — | — |
| 80 | Key Decisions | Dawn workbench execution (6.5) | root | root — Key Decisions | — | — |
| 81 | Key Decisions | Admin UI phase progress: one `lifecycle` module | root | root — Key Decisions | — | — |
| 82 | Key Decisions | Writing skill: papers are plan documents | root | root — Key Decisions | — | — |
| 83 | Key Decisions | Promises (Day 4a) | root | root — Key Decisions | — | — |
| 84 | Key Decisions | Monitor (Day 4b) | root | root — Key Decisions | — | — |
| 85 | Key Decisions | Always-on (Day 4b′) | root | root — Key Decisions | — | — |
| 86 | Known Gotchas | Tailwind 4 requires Node 22 | directory | admin | — | the OTel auto-instrumentation load-order rule → mcp |
| 87 | Known Gotchas | Skill files are `SKILL.md` (caps) | enforcer | `apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts` | lesson: mirrored-artifacts-need-structural-parity-tests | "edit `apps/indusk-mcp/skills/` + `hooks/`, never the installed copies" → mcp |
| 88 | Known Gotchas | Biome 2.x API differs from docs | root | root — Known Gotchas | — | — |
| 89 | Known Gotchas | `validate-impl-structure.js` re-validates the whole file | directory | planning | — | "the hook JS ports mirror `lib/trajectory/` — change TS and every port together" → mcp |
| 90 | Known Gotchas | **Phase identity is `{kind, number}`** | directory | mcp | — | — |
| 91 | Known Gotchas | **Never predict Edit results with `String.replace`** | directory | mcp | — | — |
| 92 | Known Gotchas | **A string from a marked span is untrusted input | directory | mcp | — | — |
| 93 | Known Gotchas | **Hooks discovery is globSync on BOTH sides** | directory | mcp | — | — |
| 94 | Known Gotchas | commander@13 silently drops duplicate | directory | mcp | — | — |
| 95 | Known Gotchas | gray-matter on malformed YAML | directory | mcp | — | — |
| 96 | Known Gotchas | **The admin sidebar tree is derived entirely from declarations** | directory | admin | — | — |
| 97 | Known Gotchas | **The papers module map, one home per fact** | directory | mcp | — | — |
| 98 | Known Gotchas | **A new status word must be registered | directory | mcp | — | — |
| 99 | Known Gotchas | **The admin Papers section renders from the shared parser's | directory | admin | — | — |
| 100 | Known Gotchas | `next/link` needs a `vi.mock` stub | directory | admin | — | — |
| 101 | Known Gotchas | Jaeger v2 IS an OTel Collector distribution | directory | mcp | — | — |
| 102 | Known Gotchas | `extensionsDisable` fires `on_disable` BEFORE | directory | mcp | — | — |
| 103 | Known Gotchas | **Eval rail invariants** | directory | mcp | — | — |
| 104 | Known Gotchas | `indusk agent register/list/prune/sweep` and the MCP write tool | directory | mcp | — | — |
| 105 | Known Gotchas | The eval hook only fires inside Claude Code sessions | directory | mcp | — | — |
| 106 | Known Gotchas | **The cleanup lib throws on non-git roots | directory | mcp | — | — |
| 107 | Known Gotchas | `indusk setup` guard is config-aware | directory | mcp | — | — |
| 108 | Known Gotchas | **`resolveImplPath` (`lib/impl-parser.ts`) and `TERMINAL_STATES` | enforcer | the eight single-definition pins: `src/lib/verify/shared-resolution.test.ts`, `src/lib/shape/shared-definitions.test.ts`, `workbench-repos-single-definition.test.ts`, `execution-roots-single-definition.test.ts`, `head-sha-single-definition.test.ts`, `promises-cleanup.test.ts`, `plan-worktrees-single-definition.test.ts`, `impl-headings.test.ts` | lesson: structural-single-definition-test-for-must-agree-invariants | "which primitive lives where" (the eight homes) → mcp, as a table of pointers |
| 109 | Known Gotchas | **Impl phases are two sequences ordered by document position** | directory | planning | — | `phaseOrdinal`'s reduction and Gate A's `<=` → mcp |
| 110 | Known Gotchas | **Heading/parsing definitions are single-definition on purpose | enforcer | `apps/indusk-mcp/src/__tests__/impl-headings.test.ts` | lesson: structural-single-definition-test-for-must-agree-invariants | the `_`-module mirror rule, the shared test-git runner and "a validator parsing zero phases refuses" → mcp |
| 111 | Known Gotchas | **`fencedLineMask` is load-bearing structure** | directory | planning | — | "an unterminated fence masks nothing (fails open)" → mcp |
| 112 | Known Gotchas | **Verify never reports "could not check" as a verdict** | directory | mcp | — | "`Test` paths are repo-root-relative; `manual:` rows report unverified" → planning |
| 113 | Known Gotchas | **The phase-boundary record | directory | mcp | — | — |
| 114 | Known Gotchas | **Every way a phase-boundary scope can be wrong is silent | directory | mcp | — | — |
| 115 | Known Gotchas | **A library the skills call is not shipped until | directory | mcp | — | — |
| 116 | Known Gotchas | **A newly tracked InDusk artifact must be registered | directory | mcp | — | — |
| 117 | Known Gotchas | **Any detection keyed on "what else changed" | directory | mcp | — | — |
| 118 | Known Gotchas | **`indusk run`'s gate covers tool surfaces, not intentions** | directory | mcp | — | — |
| 119 | Known Gotchas | **A safety argument written in a comment is not enforced | root | root — Known Gotchas, compressed to its rule | — | — |
| 120 | Known Gotchas | **Tests that need a versioned workbench use | directory | mcp | — | — |
| 121 | Known Gotchas | **PostToolUse hooks: stderr at exit 0 goes to the debug log only.** | directory | mcp | — | — |
| 122 | Known Gotchas | **Hook commands are registered by the project root | directory | mcp | — | — |
| 123 | Known Gotchas | **Enabling an extension ships only its `manifest.json`** | directory | mcp | — | — |
| 124 | Current State | **Version**: never hand-copied here | current.md | `.indusk/current.md` — Project (shared); `check-pointers` reads the version-claim rule there now | — | — |
| 125 | Current State | **In flight:** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 126 | Current State | **Budget, workbenches, worktrees** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 127 | Current State | **August** — [run] | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 128 | Current State | **Mid-September** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 129 | Current State | **writing-skill (1.44.0)** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 130 | Current State | **2026-09-18/19** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 131 | Current State | **day-always-on (2026-09-21, Day 4b′)** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 132 | Current State | **release-ritual (2026-10-01)** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 133 | Current State | **admin-plan-type (2026-10-01)** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 134 | Current State | **Active plans**: never copied here | current.md | `.indusk/current.md` — Project (shared), as the standing rule for that region | — | — |
| 135 | Current State | **day-always-on-deploy / day-contract** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 136 | Current State | **indusk-v2-dawn** — parent plan | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 137 | Current State | **Sequence reconciliation (2026-09-14)** | current.md | `.indusk/current.md` — Project (shared) | — | — |
| 138 | Current State | **Test bed**: `~/code/sandbox/chitin-sportsbook` | current.md | `.indusk/current.md` — Project (shared) | — | — |
