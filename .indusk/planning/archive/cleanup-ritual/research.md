---
title: "Cleanup Phase Gate"
date: 2026-07-06
status: complete
---

# Cleanup Phase Gate — Research

## Question

Can InDusk enforce code-structure discipline (file decomposition, component reuse, size caps) at phase close — and can it do so without forcing whole-codebase refactors on projects that already carry oversized legacy files? What machinery exists, what's missing, and what does external prior art say about ratchet/baseline enforcement?

Motivating incident: numero's `apps/poker/app/table/[tableId]/page.tsx` reached 1,439 LOC and `packages/game-ui/src/BratPokerTable.tsx` 1,135 LOC with zero decomposed components (no Chip/Bet/Pot/Board files existed) — despite the project carrying a documented E-PNM-1 convention (≤200 LOC per component + `__tests__/` sibling). The advisory convention demonstrably failed.

## Findings

### 1. Why the existing quality stack missed it

Every existing checkpoint inspects behavior, process, or the delta — never the accumulated artifact:

| Layer | Structural reason it can't catch accretion | Evidence |
|---|---|---|
| Advisory (CLAUDE.md / conventions) | Nothing forces recall at write time. Numero had E-PNM-1 documented; the monolith grew anyway. | numero incident |
| Verify skill | One advisory bullet: "Watch file length... if a file grows past ~200 lines, consider extracting" — per-item, unenforced, not phase-close. | `apps/indusk-mcp/skills/verify.md:157` |
| Biome ratchet | Trigger is "retro finds a mistake → add rule." Accretion is never one plan's mistake, so the trigger never fires. Dusk's biome.json has **no** size/complexity rules today. | `biome.json:16-37`; `apps/indusk-mcp/skills/retrospective.md:129-137` |
| Phase gates | check-gates.js parses impl.md checkboxes only. Zero git operations, zero filesystem inspection beyond impl.md + config. A monolith closes every phase green. | `apps/indusk-mcp/hooks/check-gates.js` (full file: no execFile/git) |
| Eval agent | Diff-scoped per commit. +40 lines to an 1,100-line file looks locally fine every time. | `apps/indusk-mcp/skills/eval-review.md:11-15` |
| Retrospective | Plan-close cadence, plan-scoped quality audit. | `apps/indusk-mcp/skills/retrospective.md:129-137` |
| quality_check MCP tool | Runs project-wide commands (execSync, cwd=projectRoot). No changed-files scoping, no per-phase awareness, no config from `.indusk/config.json`. | `apps/indusk-mcp/src/tools/quality-tools.ts:141-166` |

No LOC-per-file or line-count assertion exists anywhere in the repo; the only numeric structural cap is the 50 MB tarball test (`apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts:63`).

### 2. Gate machinery — what a fifth gate type touches

The gate-type list (verification/otel/context/document) is **not centralized**. Adding a "Cleanup" gate type requires ~15 edit sites across 5 files, plus authoring surfaces:

| Surface | Sites | Evidence |
|---|---|---|
| `apps/indusk-mcp/hooks/check-gates.js` | 2 — `WORKFLOW_GATES_BASE` map + gate-header regex | `:147-152`, `:185` |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | ~7 — requirements map, per-gate booleans, 4 header regexes, opt-out tracking, missing checks, opt-out validation, `NEXT_GATE` terminator regex | `:156-160`, `:174-182`, `:191-217`, `:225-234`, `:249-252`, `:263-268`, `:552` |
| `apps/indusk-mcp/hooks/gate-reminder.js` | 1 — gate regex (already drifts: OTel absent) | `:57` |
| `apps/indusk-mcp/src/lib/impl-parser.ts` | 4 — `GateType` union, `GATE_SUFFIXES`, regex, `uncheckedByGate` (already omits OTel entirely) | `:4`, `:30-34`, `:100`, `:154-159` |
| `apps/indusk-mcp/src/lib/trajectory/validator.ts` | 1 — `NEXT_GATE_HEADING` alternation. **Without this edit, a Cleanup section placed after Verification would be counted as Verification items.** | `:38` |
| `apps/indusk-mcp/skills/planner.md` | impl template emits `#### Phase N {Gate}` sections | `:467-483` |
| `apps/indusk-mcp/skills/work.md` | five-gate completion order prose ("all five") | `:55-63` |

Key mechanics:

- **check-gates.js blocking flow**: fires on Edit/Write to `*/impl.md`; detects checkbox transitions; when an *implementation* item in Phase N is newly checked, every prior phase must have all required-gate items checked or overridden, else exit 2 blocks the edit. Gate-item check-offs themselves are always allowed. (`check-gates.js:29-31, 71-94, 246-291`)
- **The hook never runs the checks** — Verification items are executed by the agent; the hook only enforces that checkboxes are checked. A mechanical cleanup check would follow the same trust model: gate item = runnable command, hook enforces the checkbox.
- **Config-conditional gate precedent**: `shouldEmitOtelGate(statePath)` inlined in both blocking hooks reads `${statePath}/.indusk/config.json`, filters "otel" out of required gates; fails open (gate on) for missing/malformed config. statePath is workbench-aware via `_hook-paths.js` `resolveStateAndGitPaths` (1.31.7). (`check-gates.js:128-143`; `validate-impl-structure.js:47-72`)
- **Non-checkbox structural blocking precedent**: trajectory Gates A/B block phase close on table-row *state*, not checkboxes. (`check-gates.js:294-380`)
- **gate_policy** (strict/ask/auto) governs opt-outs: auto accepts bare `(none needed)`/`skip-reason:`; ask requires conversation proof; strict allows none. Resolution: impl frontmatter → `.claude/settings.json` `indusk.gate_policy` → default ask. (`check-gates.js:37-57, 254-272`)
- Hooks never write files and do no git today; the only hook shelling to git is eval-trigger.js (`rev-parse --short HEAD`) plus `_hook-paths.js` path resolution.

### 3. Phase-close insertion point and the changed-files question

- Phase close is defined as "before checking the first implementation item in Phase N+1"; per-phase completion order is Implementation → OTel → Verification → Context → Document, followed by trajectory State flips and best-effort `graph_sync`. (`apps/indusk-mcp/skills/work.md:55-63, 79-87, 201`)
- **The work skill already cuts a fresh branch `plan/{plan-name}-phase-{n}` from freshly-pulled main at phase start** (`work.md:283-289`). A phase's changed files are therefore the branch's diff from merge-base — but no skill step currently derives or uses that diff.
- The only changed-files computation in the repo is the worktree preflight: `MERGE_BASE=$(git merge-base "$BASE_BRANCH" HEAD)`, then the sort-u union of `git diff --name-only $MERGE_BASE..HEAD` + `--cached` + unstaged, filtered to extant files. Base-ref defaults to origin/main with fetch-fallback; empty set exits 0 fast. Directly reusable mechanics. (`apps/indusk-mcp/extensions/worktree/scripts/preflight.sh:131-172`)
- Per-phase in-impl artifact precedent that is *not* a gate: `#### Phase N Forward Intelligence` (context skill authors, work skill reads at next phase start). (`apps/indusk-mcp/skills/context.md:123-136`; `work.md:25-28`)
- Latent mismatch found in passing: bugfix/refactor workflow templates emit only a Verification section while `WORKFLOW_GATES_BASE` demands more (refactor: all four; bugfix: verification+document). (`templates/workflows/bugfix.md:54-56`, `refactor.md:61-63` vs `check-gates.js:147-152`)

### 4. Biome's capabilities and limits (installed: 2.5.1)

- **Rules exist**: `noExcessiveLinesPerFile` — promoted from nursery to the **style** group in Biome v2.5, opt-in (not in recommended), options `maxLines` (default 300) / `skipBlankLines`. `noExcessiveLinesPerFunction` and `noExcessiveCognitiveComplexity` live in the complexity group. All verified present in the installed 2.5.1 schema. (node_modules schema; biomejs.dev/linter/rules/no-excessive-lines-per-file; v2.5 blog)
- **No baseline concept**: rule options are absolute caps (`additionalProperties: false`, no grandfather field). Biome has **no suppressions/baseline file** as of 2026-07 — only inline `// biome-ignore` (+ `-all`, `-start/-end`) comments and `biome lint --suppress`, which mass-writes inline comments *into source files*. Baseline-file support is an open RFC discussion (biomejs/biome#1064, unresolved since 2023). Consequence: a Biome LOC cap on a codebase with legacy monoliths either fails constantly or requires polluting every legacy file with suppression comments.
- **Scoping works**: top-level `overrides[]` with `includes` globs (dusk already uses one for `**/*.vue`) can scope caps to e.g. `components/**`. (`biome.json:39-50`)
- **No distribution channel to consumers**: `indusk init` copies a static `templates/biome.template.json` skip-if-exists; **`indusk update` never touches biome.json** (grep: zero hits). Pushing new rules into existing consumer projects has no current path. Template pins ^2.4.8 while dusk runs 2.5.1. (`init.ts:779-787`, `:212`; `update.ts` full-step structure)

### 5. Config plumbing and state-file precedents

- Established pattern for a new config block: reader function with default constants *in the reader*, optional chaining, type-guard at read, absence → default. Most recent full-stack precedent (`agents.stale_ttl_minutes`): local-cast reader in the feature module, init writes the default at step 12 (`init.ts:1278-1280`), update migrates idempotently via read-check-spread-write at step 7c (`update.ts:590-601`), JS hooks inline a mirror copy (fail-open on parse error).
- CLAUDE.md documents the dual-maintenance trap: TS source + every JS hook port must update in lockstep; the 1.25.0→1.25.1 regex-anchoring drift bug established TS↔JS subprocess parity tests as the fix pattern (`rationale-baseline-parity.test.ts`).
- **No committed per-project baseline/snapshot file exists.** Nearest analogues: `.indusk/eval/findings.json` (tool-RMW'd but gitignored), `~/.indusk/projects.json` (machine-global; atomic tmp+rename; quarantine-on-corrupt), `.indusk/worktree-configs/*.json` (user-authored, Ajv-validated — the only schema-validated config surface). `.indusk/` gitignore is partial: graph/, eval/, extensions/ ignored; planning/, config.json, current.md committed.

### 6. Sibling plan: documentation-phase-gate (coordination required)

- Status: brief `accepted` (2026-06-25), ADR `proposed`, no impl.md. It **removes** the per-phase Document gate in favor of a mandatory final Documentation phase gated before /retrospective via an `isDocumentationComplete(planRoot)` helper. (adr.md:34-44, 77-89)
- It edits the identical enforcement surfaces (check-gates.js, validate-impl-structure.js, impl-parser.ts, planner template). Changes are not logically contradictory but merge order must be coordinated.
- Two reusable patterns from its ADR: (a) validator changes must be strictly additive/grandfathered — "the validator gates every plan; a bug breaks all planning" (adr.md:117-119); (b) the repo's enforcement split: close-out gates = skill-instruction + `isXComplete` helper; per-phase gates = PreToolUse hook exit-2. (adr.md:52-56)
- Note: its ADR **rejected** config-keyed gate opt-out (the otel.role pattern) for its case, preferring `skip-reason:` — relevant tension for a cleanup gate whose *rules* must live in config regardless. (adr.md:96-98)
- Test approach precedent: "vitest (subprocess hook invocation)" is the established pattern for JS hook port behavior. (test-plan.md:20-26)

### 7. In-repo structural-test prior art

- **T16 component-reuse audit** (`apps/indusk-admin/src/__tests__/component-reuse-audit.test.ts`): walk tree → regex per line against forbidden-pattern table → exemption function (ui/ primitives, tests, Markdown.tsx) → assert `violations` equals `[]` with `path:line — actionable message` output. Self-documented "grep-based v1 — simple > clever." Same shape recurs in `scm-rip-out-grep.test.ts` and the eval-trigger source-grep tests.

### 8. External prior art — ratchet/baseline families

| Family | Tool | Baseline lives | Tightens | Blocks | Fit signals |
|---|---|---|---|---|---|
| Snapshot ratchet | Betterer | committed `.betterer.results` (Jest-snapshot-like, per-file issue arrays keyed by file hash) | **automatically on improvement** (unique) | on regression | requires adopting its own runner + `.betterer.ts`; results file churns with line movement; semi-dormant: last stable npm release 2022-08, one alpha 2024-12, no stable in ~4 years |
| Count file | ESLint bulk suppressions (v9.24.0+, 2025-04) | committed `eslint-suppressions.json` `{file: {rule: {count}}}` | errors on stale counts → forced manual `--prune-suppressions` | on growth (reports ALL violations, not delta) | runs inside normal eslint; error-rule-only; N/A for Biome projects |
| Exclude list | RuboCop `.rubocop_todo.yml`, PHPStan `phpstan-baseline.neon`, detekt `baseline.xml` | committed config | manual edit or full regeneration only | nothing about legacy files until entries removed | whole-file granularity: partial improvement changes nothing |
| Merge-target comparison | qntm ratchet essay + HN CI variant | **no file** — baseline is the merge target's own count | implicitly on merge | count(branch) > count(target) | zero maintenance; needs a defined base ref; per-branch scope |
| High-water marks | apiology/quality gem | committed `metrics/` files | explicit `rake ratchet` task | worse-than-mark | Ruby-toolchain-bound |

Biome fits none of these natively (no baseline surface — see Finding 4), so ratchet semantics for a Biome-linted project must be implemented outside Biome.

## Open Questions

- Which workflows require the gate (feature/refactor certainly; bugfix?) — and does the fifth gate type go into the TS impl-parser (core-four precedent) or JS-hooks-only (OTel precedent)?
- Merge order with documentation-phase-gate — who lands first on the shared enforcement surfaces?
- What ref anchors "phase start" when the per-phase branch convention isn't followed (direct-to-main work, hotfixes)? Preflight's merge-base + fallback logic covers the branch case; the fallback case needs a defined answer.
- Mechanical rule strictness for touched over-cap files: strict shrink (must end smaller) vs no-growth (must not end bigger)?
- Should `indusk init`/`update` also scaffold Biome's `noExcessiveLinesPerFile` (editor feedback in scoped new-code dirs), given update.ts currently never touches biome.json?

## Sources

- Workflow run wf_f541710c-0df (6 parallel readers, 2026-07-06) — all file:line citations verified against working tree
- https://biomejs.dev/linter/rules/no-excessive-lines-per-file/ · https://biomejs.dev/blog/biome-v2-5/ · https://biomejs.dev/analyzer/suppressions/ · https://github.com/biomejs/biome/discussions/1064
- https://phenomnomnominal.github.io/betterer/docs/results-file/ · https://phenomnomnominal.github.io/betterer/docs/updating-results/
- https://eslint.org/blog/2025/04/introducing-bulk-suppressions/ · https://eslint.org/docs/latest/use/suppressions
- https://docs.rubocop.org/rubocop/latest/usage/auto_gen_config.html · https://phpstan.org/user-guide/baseline · https://detekt.dev/docs/introduction/baseline/
- https://qntm.org/ratchet · https://github.com/apiology/quality
