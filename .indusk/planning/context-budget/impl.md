---
title: "Context Budget — Impl"
date: 2026-06-29
status: in-progress
trajectory: required
gate_policy: ask
---

# Context Budget — Implementation (Pieces 1 + 2)

Two pieces ship as 1.31.11:

- **Piece 1**: `indusk prune --dry-run` CLI command — measurement + surface, no behavior change
- **Piece 2**: `/retrospective` skill emits **one-line Current State entries** going forward

Piece 3 (current.md auto-archive + `context.budget_tokens` + beam-default catchup) is its own subsequent plan with full ADR — too big for this patch.

## Boundary Map

**New files**:
- `apps/indusk-mcp/src/bin/commands/prune.ts` — new CLI command. Reports CLAUDE.md size by section, current.md per-section ages + sizes, lessons sorted by file age, total auto-loaded context estimate, recommended manual cleanup commands. `--dry-run` is the DEFAULT — no destructive action in v1.
- `apps/indusk-mcp/src/lib/prune/measure.ts` — pure-function library that reads project state and returns a structured `PruneReport` (size-per-section, per-lesson-age, per-section-age). CLI prints the report; library is testable.
- `apps/indusk-mcp/src/__tests__/prune-measure.test.ts` — unit tests against tmpdir fixtures.
- `apps/indusk-mcp/src/__tests__/prune-cli.test.ts` — CLI integration test.
- `apps/indusk-mcp/src/__tests__/retrospective-skill-one-line.test.ts` — source-grep test asserting the one-line discipline is documented in the skill.

**Modified files**:
- `apps/indusk-mcp/src/bin/cli.ts` — register `prune` subcommand
- `apps/indusk-mcp/skills/retrospective.md` — Step 7 (Context Audit) gains explicit "one-line entry + link to archive" guidance; replaces the current implicit paragraph pattern. Existing entries unchanged (migration is operator's hand via `indusk prune` recommendations).
- `apps/indusk-mcp/package.json` — bump 1.31.10 → 1.31.11
- `apps/docs/src/changelog.md` — 1.31.11 entry covering both pieces

**Runtime artifacts**: none new. `indusk prune --dry-run` is pure-read.

**NOT in scope** (explicit defers to Piece 3):
- Any auto-pruning or destructive action (no `--apply` flag in v1)
- `current.md` auto-archive to `.indusk/current-archive/`
- `.indusk/config.json` `context.budget_tokens` field
- Beam-default catchup (catchup still loads everything; prune just surfaces the bill)
- Lesson auto-pruning (operator confirms each removal manually after seeing the surface)

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `measureProjectContext(projectRoot)` library returns a `PruneReport` with sizes per CLAUDE.md section, per-lesson ages, per-current-md-section ages, and a total-auto-loaded-bytes estimate | Phase 0 | Phase 1 | writable |
| T2 | `measureProjectContext` against a project with NO `.indusk/` returns a degraded but non-throwing report (most fields null/empty + a `notes: ["no .indusk/ found"]` entry) | Phase 0 | Phase 1 | writable |
| T3 | `measureProjectContext` flags CLAUDE.md sections larger than the configurable threshold (`large_section_chars`, default 4000) — flagged sections appear with a `recommended_action` field naming the cleanup | Phase 0 | Phase 1 | writable |
| T4 | `measureProjectContext` flags lessons whose mtime is older than the configurable threshold (`stale_lesson_days`, default 180) — flagged lessons appear with their last-modified date and an opt-in recommended deletion command | Phase 0 | Phase 1 | writable |
| T5 | `measureProjectContext` flags `current.md` per-agent sections older than the configurable threshold (`stale_section_days`, default 7) — flagged sections appear with their session ID + last-updated timestamp | Phase 0 | Phase 1 | writable |
| T6 | `indusk prune` CLI invokes `measureProjectContext` and prints the report. `--dry-run` is the default; running with no flags prints the report and exits 0 without modifying any file | Phase 0 | Phase 2 | writable |
| T7 | `indusk prune --help` lists `--dry-run` as the default mode and explicitly states "no destructive action in this version" | Phase 0 | Phase 2 | writable |
| T8 | CLI integration test: against a tmpdir with a bloated CLAUDE.md (one section > 4000 chars), `indusk prune` exits 0 and stdout contains the section name + recommended cleanup | Phase 0 | Phase 2 | writable |
| T9 | `apps/indusk-mcp/skills/retrospective.md` Step 7 (Context Audit) source contains the literal "one-line entry" / "one line plus a link" guidance for Current State entries — defends the new discipline against future skill drift | Phase 0 | Phase 3 | writable |
| T10 | `retrospective.md` contains a counter-example block warning AGAINST multi-paragraph Current State entries with the rationale (token cost on every catchup) — operators reading the skill see WHY, not just WHAT | Phase 0 | Phase 3 | writable |

### Deferred Verification

- **U1: Real Numero CLAUDE.md diet impact measurement**
  - reason: Numero's actual CLAUDE.md token cost depends on Sandy's manual collapsing of completed-plan Current State entries — can't be programmatically asserted; the success metric is Sandy's subjective "catchup feels lighter" + a one-time before/after `wc -c CLAUDE.md` comparison.
  - would require: instrumenting catchup with per-step token measurement + a baseline comparison run, which is its own plan (Piece 3).
  - mitigation: Sandy runs `indusk prune --dry-run` on Numero after 1.31.11 ships; surface tells him what to collapse; he does the manual diet; before/after `wc -c CLAUDE.md` comparison documented inline below the trajectory. If reduction is < 20% the surface didn't identify the right targets — reopen Phase 1 to tune thresholds.

## Checklist

### Phase 1 — `measureProjectContext` library + prune CLI

- [ ] Write red tests T1, T2, T3, T4, T5 first; commit failing
- [ ] Create `apps/indusk-mcp/src/lib/prune/measure.ts` exporting:
  - `interface PruneReport { claudeMd: SectionReport[]; lessons: LessonReport[]; currentMd: CurrentMdReport; estimatedAutoLoadBytes: number; notes: string[] }`
  - `function measureProjectContext(projectRoot: string, thresholds?: Partial<Thresholds>): PruneReport`
  - Pure: no writes, no side effects
  - Reads CLAUDE.md via existing context parser if available; falls back to a simple `## ` section split
  - Reads `.claude/lessons/*.md` for sizes + mtimes
  - Reads `.indusk/current.md` via existing current-md.ts library (`parseCurrentMd`) for section ages
- [ ] Add `apps/indusk-mcp/src/__tests__/prune-measure.test.ts` covering T1, T2, T3, T4, T5 against tmpdir fixtures
- [ ] Flip T1-T5 to passing

#### Phase 1 Verification

- [ ] T1-T5 pass
- [ ] `pnpm --filter indusk-mcp test src/__tests__/prune-measure.test.ts` — green
- [ ] `pnpm --filter indusk-mcp build` — clean

#### Phase 1 Context

- [ ] Add Architecture entry to CLAUDE.md: `apps/indusk-mcp/src/lib/prune/` is the measurement library for context-budget surfacing. Pure-function, no side effects. CLI consumes it.

#### Phase 1 Document

- [ ] No new docs page — `apps/docs/src/guide/context-budget.md` belongs in Piece 3 (the architectural plan). For 1.31.11, the changelog entry suffices.

---

### Phase 2 — `indusk prune` CLI

- [ ] Write red tests T6, T7, T8 first; commit failing
- [ ] Create `apps/indusk-mcp/src/bin/commands/prune.ts`:
  - Imports `measureProjectContext` from `lib/prune/measure.ts`
  - Resolves project root via existing `resolveProjectRoot` helper
  - Prints a structured human-readable report
  - `--dry-run` is the default (no `--apply` flag yet — defer to Piece 3)
  - Threshold flags: `--large-section-chars=4000`, `--stale-lesson-days=180`, `--stale-section-days=7`
  - Exit 0 if report is clean (nothing flagged), exit 0 with the report otherwise (informational, never an error)
- [ ] Register `prune` subcommand in `apps/indusk-mcp/src/bin/cli.ts`
- [ ] Add CLI integration test in `apps/indusk-mcp/src/__tests__/prune-cli.test.ts` (T6, T7, T8)
- [ ] Flip T6-T8 to passing

#### Phase 2 Verification

- [ ] T6-T8 pass
- [ ] `indusk prune --help` shows `--dry-run` as the default mode and explicit "no destructive action in this version" disclaimer
- [ ] CLI exits 0 on a clean project AND on a bloated project

#### Phase 2 Context

- [ ] Add Conventions entry to CLAUDE.md: `indusk prune` is the recommended way to audit InDusk context bloat. Run periodically (~monthly) to see what's accreted. Pure-read; never modifies. Auto-pruning is intentionally deferred to a future architectural plan.

#### Phase 2 Document

- [ ] (defer to Piece 3) — changelog entry for 1.31.11 covers both pieces

---

### Phase 3 — `/retrospective` skill: one-line Current State entries

- [ ] Write red tests T9, T10 first; commit failing
- [ ] Edit `apps/indusk-mcp/skills/retrospective.md` Step 7 (Context Audit):
  - Replace any guidance that implies multi-paragraph entries with explicit "one-line entry + link to archive"
  - Add a code-block example showing the right shape: `- **{plan-name} ({version})** — one-sentence summary. See [archive](.indusk/planning/archive/{plan-name}/) for full detail.`
  - Add a counter-example block warning AGAINST multi-paragraph entries with the rationale (every retrospective adds prose; over 20 plans Current State alone becomes ~10KB always-loaded; the detail lives in the archive anyway)
  - Add a brief note: existing multi-paragraph entries can be collapsed via `indusk prune --dry-run` surface + manual cleanup; not auto-migrated.
- [ ] Sync the updated skill to `.claude/skills/retrospective/SKILL.md` (mirror change for dusk's own usage)
- [ ] Add source-grep test in `apps/indusk-mcp/src/__tests__/retrospective-skill-one-line.test.ts` covering T9, T10
- [ ] Flip T9, T10 to passing

#### Phase 3 Verification

- [ ] T9, T10 pass
- [ ] `pnpm --filter indusk-mcp test src/__tests__/retrospective-skill-one-line.test.ts` — green
- [ ] Manual: re-read the updated retrospective.md and verify the new shape is unambiguous (no operator should produce a paragraph entry after reading)

#### Phase 3 Context

- [ ] Add Conventions entry to CLAUDE.md: completed-plan Current State entries are ONE LINE + link to archive, going forward. Multi-paragraph entries are token bloat; the detail lives in the archive.

#### Phase 3 Document

- [ ] (covered by changelog entry for 1.31.11)

---

### Phase 4 — Bump + changelog + ship

- [ ] Bump `apps/indusk-mcp/package.json` 1.31.10 → 1.31.11
- [ ] Add 1.31.11 changelog entry to `apps/docs/src/changelog.md`:
  - Added: `indusk prune --dry-run` measurement surface
  - Changed: `/retrospective` skill emits one-line Current State entries going forward; existing entries unchanged (operator's hand to migrate)
- [ ] Verify full test suite passes
- [ ] Commit + push

#### Phase 4 Verification

(no tests flip at this phase — reason: infra)

- [ ] All T1-T10 trajectory rows passing
- [ ] Full test suite green
- [ ] Changelog entry visible in docs build

#### Phase 4 Context

- [ ] (no additional context entries — covered by per-phase entries above)

#### Phase 4 Document

- [ ] Falsification ritual: run `/falsify context-budget` and address any findings before retrospective. Likely findings: thresholds may need tuning against real Numero data; surface format may need adjustment; CLI ergonomics may have edge cases.

## Out of scope (explicit defers to Piece 3)

| Deferred | Why | When to revisit |
|---|---|---|
| `current.md` auto-archive to `.indusk/current-archive/` | Requires "baked into Graphiti" signal design — too big for this patch | Piece 3 |
| `.indusk/config.json` `context.budget_tokens` field | Requires catchup-side enforcement logic — its own architectural decision | Piece 3 |
| Beam-default invocation before file edits | Requires skill content updates across multiple skills + new `/context-for` slash command | Piece 3 |
| `indusk prune --apply` (auto-pruning) | Need operator trust in the dry-run output first; v1 is surface-only | When Piece 3 ships with the broader architectural shape |
| Migration script for existing multi-paragraph Current State entries | Sandy's manual one-time diet is the right scope for now; future operators get the prune surface to guide them | If multiple operators report the migration is painful |
| Output token budget (vs input context) | Different concern; different mechanism | Separate plan |

## Notes for next session

- The immediate impact comes from Sandy's MANUAL one-time Numero CLAUDE.md diet (~30 min by hand) — Pieces 1 and 2 make the diet sustainable going forward but don't perform it
- Piece 3 (the larger architectural plan) is where the structural fix lives — `context-budget-architecture` or similar. ADR required before impl. Likely 1-2 weeks of work
- This plan is the read-side inverse of `code-reviewer-agent` (write-side new petal). Both inform Dawn's eventual "what auto-loads, what queries on-demand" decision
- The mental-model correction from Sandy (Graphiti grows; the leverage is TARGETED RETRIEVAL, not subtractive Graphiti) is baked into the brief — preserve it in the Piece 3 ADR
