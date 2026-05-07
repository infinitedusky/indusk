---
title: "Code Reviewer Agent — MVP plumbing + first findings"
date: 2026-05-07
status: in-progress
trajectory: required
---

# Code Reviewer Agent — Implementation

A second post-commit agent (sibling of the eval agent) that reviews code artifacts for cleanliness, DRY violations, and oversized functions/pages — anchored to the project's CLAUDE.md conventions, never generic best practices.

**Scope discipline:** MVP plumbing + minimal-but-project-aware prompt. No integration with lessons / plans / Graphiti memory yet. "Smarter" features defer to follow-up plans once we see what the real noise floor looks like.

**TDD discipline:** every trajectory row is authored at Phase 0. Tests are written failing before any implementation lands. Phase close requires the trajectory rows tagged `Passes at: Phase N` to flip from `writable` → `written` (red) → `passing` (green).

## Boundary Map

**New files:**
- `apps/indusk-mcp/src/lib/review/prompt-builder.ts` — system prompt with CLAUDE.md anchor + severity tiers
- `apps/indusk-mcp/src/lib/review/reviewer-runner.ts` — spawn `claude --print`, parse output
- `apps/indusk-mcp/src/lib/review/persistent-reviewer.ts` — session reuse via `claude --resume` (mirror eval pattern)
- `apps/indusk-mcp/src/lib/review/scorecard-extractor.ts` — tolerant JSON extraction
- `apps/indusk-mcp/src/lib/review/findings.ts` — fix/ignore lifecycle, key-based persistence
- `apps/indusk-mcp/hooks/review-trigger.js` — PostToolUse hook (sibling of `eval-trigger.js`)
- `apps/indusk-mcp/src/bin/commands/review.ts` — CLI subcommand (`summary | findings | fix | ignore | baseline`)
- `apps/indusk-mcp/src/lib/review/__tests__/*.test.ts` — unit tests
- `apps/indusk-mcp/src/__tests__/review-trigger-*.test.ts` — hook integration tests

**Modified files:**
- `apps/indusk-mcp/src/bin/cli.ts` — register `review` subcommand
- `apps/indusk-mcp/src/lib/config.ts` — add `review.enabled` field (default `false`)
- `apps/indusk-mcp/src/bin/commands/init.ts` — register `review-trigger.js` hook in scaffolded `.claude/settings.json` (gated on `review.enabled`)
- `apps/indusk-mcp/src/bin/commands/update.ts` — propagate hook to existing projects on next update

**Runtime artifacts** (per-project, gitignored):
- `.indusk/review/results.log` — append-only run log (parallel to `.indusk/eval/results.log`)
- `.indusk/review/findings.json` — active + ignored findings store

**NOT in scope** (explicit defers):
- Lessons-registry integration
- Active plan / trajectory-row awareness
- Graphiti memory of prior findings
- Cross-commit dedup beyond same-finding-key
- Auto-fix / agent-driven fix queue
- Cost cap enforcement (deferred to a follow-up — eval doesn't have it either)

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | When `review.enabled: true` in `.indusk/config.json`, `review-trigger.js` spawns a reviewer process on `jj describe` PostToolUse | Phase 0 | Phase 1 | writable |
| T2 | When `review.enabled: false` (default), `review-trigger.js` exits without spawning | Phase 0 | Phase 1 | writable |
| T3 | `indusk review summary` runs without error against an empty findings store and prints a "no findings yet" message | Phase 0 | Phase 1 | writable |
| T4 | First reviewer run auto-creates `.indusk/review/` directory and `results.log` if absent | Phase 0 | Phase 1 | writable |
| T5 | `indusk review` CLI is registered (visible in `--help`); subcommands `summary`, `findings`, `fix`, `ignore`, `baseline` all parse args without error (no-op actions OK) | Phase 0 | Phase 1 | writable |
| T6 | `buildReviewerPrompt({ projectRoot, diff, scm })` includes a literal instruction to read `CLAUDE.md` and `AGENTS.md` from the project root before reviewing | Phase 0 | Phase 2 | writable |
| T7 | `buildReviewerPrompt` includes the three severity tiers (`critical`, `important`, `note`) with explicit definitions | Phase 0 | Phase 2 | writable |
| T8 | `buildReviewerPrompt` instructs the reviewer to refuse generic recommendations that contradict CLAUDE.md (specifically: anti-DRY for project, no comments by default, no premature abstraction) | Phase 0 | Phase 2 | writable |
| T9 | `extractReviewJson` handles prose-prefixed JSON output (mirror of eval's tolerance pattern) | Phase 0 | Phase 2 | writable |
| T10 | `extractReviewJson` handles fenced ```json ... ``` code-block output | Phase 0 | Phase 2 | writable |
| T11 | `extractReviewJson` returns a structured error result on malformed JSON, never throws or crashes the runner | Phase 0 | Phase 2 | writable |
| T12 | Finding key is a deterministic hash of `file + line + rule` — same inputs produce same key across runs | Phase 0 | Phase 3 | writable |
| T13 | `indusk review fix <key>` removes the finding from active findings; subsequent `summary` doesn't list it | Phase 0 | Phase 3 | writable |
| T14 | `indusk review ignore <key>` moves the finding to the ignored set; subsequent reviewer runs don't recreate it | Phase 0 | Phase 3 | writable |
| T15 | Re-running the reviewer on the same diff doesn't duplicate findings — same `(file, line, rule)` produces the same key, store dedupes | Phase 0 | Phase 3 | writable |
| T16 | `review-trigger.js` and `eval-trigger.js` can both be registered in `.claude/settings.json` PostToolUse simultaneously without conflict; both fire independently on `jj describe` | Phase 0 | Phase 1 | writable |

### Deferred Verification

- **U1: Real-commit smoke against dusk repo, project-aware findings**
  - reason: requires real `claude` CLI binary execution against a real diff in this repo; output is non-deterministic across model versions and prompt iterations, so a golden-output assertion would be brittle and high-maintenance.
  - would require: integration test fixture with full `claude --print` invocation, a curated dusk-shaped diff fixture, and a golden-output assertion that needs re-baseline on every prompt or model change.
  - mitigation: scheduled-review at end of Phase 4 — manually run reviewer against the last 5 dusk commits; assert qualitatively that no recommendations contradict CLAUDE.md (no "extract helper for these similar functions," no "add docstring to this function," no "split this 80-line function" without project-justified reasoning). Findings rate > 30 per commit OR contradiction detected = prompt regressed; reopen Phase 2.

## Checklist

### Phase 1 — Plumbing skeleton

- [ ] Write red tests T1–T5, T16 first; commit failing
- [ ] Create `apps/indusk-mcp/src/lib/review/` directory with empty stub files for the five modules
- [ ] Create `apps/indusk-mcp/hooks/review-trigger.js` modeled on `eval-trigger.js`; gates on `review.enabled` from `.indusk/config.json`; exits silently when disabled
- [ ] Add `review.enabled?: boolean` field to config schema in `apps/indusk-mcp/src/lib/config.ts` (default `false`)
- [ ] Create `apps/indusk-mcp/src/bin/commands/review.ts` with no-op subcommand actions (just arg parsing)
- [ ] Register `review` subcommand in `apps/indusk-mcp/src/bin/cli.ts`
- [ ] Modify `init.ts` to register `review-trigger.js` in scaffolded `.claude/settings.json` PostToolUse (sibling of eval-trigger)
- [ ] Modify `update.ts` to ensure `review-trigger.js` is registered in existing projects on next update
- [ ] Auto-create `.indusk/review/` directory and `results.log` on first reviewer run
- [ ] Flip T1–T5 + T16 to passing

#### Phase 1 Verification

- [ ] T1 passes: hook spawns reviewer when `review.enabled: true`
- [ ] T2 passes: hook silent when `review.enabled: false`
- [ ] T3 passes: `indusk review summary` runs against empty store
- [ ] T4 passes: directory + log auto-created
- [ ] T5 passes: CLI subcommands parse without error
- [ ] T16 passes: review-trigger and eval-trigger coexist in settings.json
- [ ] `pnpm --filter indusk-mcp test src/lib/review/` — all green
- [ ] `pnpm --filter indusk-mcp build` — clean
- [ ] `pnpm --filter indusk-mcp tsc --noEmit` — clean

#### Phase 1 Context

- [ ] Add Architecture section entry: code reviewer agent module at `apps/indusk-mcp/src/lib/review/` mirrors `apps/indusk-mcp/src/lib/eval/`
- [ ] Add Conventions entry: `review.enabled: false` default; opt-in per project; never blocks commits

#### Phase 1 Document

- [ ] Add a stub page at `apps/indusk-docs/src/reference/review/overview.md` linked from sidebar; describes the reviewer at high level and points at this plan for current scope

---

### Phase 2 — Prompt v1 + tolerant output parsing

- [ ] Write red tests T6–T11 first; commit failing
- [ ] Implement `buildReviewerPrompt({ projectRoot, diff, scm })` — system prompt that:
  - Names the reviewer's persona (project-aware code critic, not generic best-practices)
  - Instructs reading `CLAUDE.md` and `AGENTS.md` from project root before reviewing
  - Defines the three severity tiers (`critical` / `important` / `note`) with examples
  - Defines the MVP rule set: code cleanliness, DRY violations, oversized functions/pages
  - Explicitly forbids generic recommendations that contradict CLAUDE.md (anti-DRY for some projects, no comments by default, no premature abstraction)
  - Specifies output schema: JSON object with `findings: Array<{ key, severity, file, line, rule, description, suggestion }>`
- [ ] Implement `reviewer-runner.ts` — spawn `claude --print` with prompt + allowed tools whitelist; parse output via `extractReviewJson`
- [ ] Implement `persistent-reviewer.ts` — session reuse via `claude --resume` for subsequent commits in the same session (mirror eval's persistent pattern)
- [ ] Implement `scorecard-extractor.ts` — three-strategy tolerant parser (trim-and-parse → fenced-block regex → balanced-brace scan); never throws
- [ ] Wire reviewer-runner into `review-trigger.js` so the hook actually executes a review (was a stub in Phase 1)
- [ ] Append review output to `.indusk/review/results.log`
- [ ] Flip T6–T11 to passing

#### Phase 2 Verification

- [ ] T6 passes: prompt contains CLAUDE.md/AGENTS.md read instruction
- [ ] T7 passes: prompt contains three severity tiers with definitions
- [ ] T8 passes: prompt contains the project-convention-anchor refusal clause
- [ ] T9, T10, T11 pass: extractor handles prose-prefix, fenced, and malformed shapes
- [ ] `pnpm --filter indusk-mcp test src/lib/review/` — all green

#### Phase 2 Context

- [ ] Add Known Gotchas entry: reviewer prompt is project-context-anchored — generic recommendations that contradict CLAUDE.md must be suppressed by the prompt itself, not post-filtered. Symptom of regression: reviewer suggests "extract helper for these similar functions" on a project whose CLAUDE.md says "three similar lines is better than a premature abstraction"

#### Phase 2 Document

- [ ] Update `reference/review/overview.md` with the MVP rule set and the project-anchor discipline

---

### Phase 3 — Findings lifecycle

- [ ] Write red tests T12–T15 first; commit failing
- [ ] Implement `findings.ts`:
  - `findingKey({ file, line, rule })` — stable hash function
  - `addFinding(...)` / `getActive()` / `getIgnored()`
  - `fix(key)` — removes from active, audit-trail entry
  - `ignore(key)` — moves to ignored set; subsequent runs skip same-key findings
  - JSON storage at `.indusk/review/findings.json`
- [ ] Wire findings.ts into reviewer-runner: after each run, dedupe findings by key, persist
- [ ] Implement CLI `indusk review summary` (count by severity), `findings` (full list), `fix <key>`, `ignore <key>`, `baseline --task <path>` (mirror eval baseline pattern)
- [ ] Flip T12–T15 to passing

#### Phase 3 Verification

- [ ] T12 passes: deterministic finding key
- [ ] T13 passes: fix removes from active
- [ ] T14 passes: ignore moves to ignored set
- [ ] T15 passes: re-run dedupes
- [ ] `pnpm --filter indusk-mcp test` — full suite green

#### Phase 3 Context

- [ ] Add Conventions entry: review findings persist until fixed or ignored — same lifecycle as eval findings; agents see unresolved findings on every commit

#### Phase 3 Document

- [ ] Add `reference/review/cli.md` documenting the five subcommands

---

### Phase 4 — Dogfood + tune

- [ ] Enable `review.enabled: true` in dusk's `.indusk/config.json`
- [ ] Run reviewer against the next 5–10 commits; observe findings rate, severity distribution, and whether recommendations contradict CLAUDE.md
- [ ] Tune the Phase 2 prompt against observed noise (too many notes? too few criticals? generic recommendations leaking through? add explicit prompt counter-examples)
- [ ] Run U1 manual smoke against the last 5 dusk commits; document outcome inline in this plan
- [ ] Mark U1 mitigation as run (or reopen Phase 2 if smoke surfaces contradictions)

#### Phase 4 Verification

(no tests flip at this phase — reason: infra)

- [ ] U1 manual smoke documented inline (above)
- [ ] T1–T16 all remain passing after Phase 4 prompt tuning (regression check)
- [ ] No regressions in eval agent (eval-trigger and review-trigger coexist cleanly across 5+ commits)

#### Phase 4 Context

- [ ] Update Current State in CLAUDE.md: code reviewer agent shipped at indusk-mcp v1.X.Y; dogfooding active on dusk
- [ ] Add a Known Gotchas entry per actual issues surfaced during dogfood (likely: prompt-tuning notes, severity-tier-misuse patterns, etc.)

#### Phase 4 Document

- [ ] Update `reference/review/overview.md` with the prompt-tuning notes from dogfood
- [ ] Add a changelog entry: "Code reviewer agent — opt-in, project-aware, mirrors eval agent shape"
- [ ] Falsification ritual: run `/falsify code-reviewer-agent` and address the resulting Falsification Phase before retrospective

## Out of scope (explicit defers)

| Deferred | Why | When to revisit |
|---|---|---|
| Lessons-registry integration | Adds noise + complexity; MVP signal first | After 2 weeks dogfood with stable findings rate |
| Active plan / trajectory-row awareness | Requires plan-parser integration; not load-bearing for cleanliness rules | After integration thesis is proven by lessons integration |
| Graphiti memory of prior findings | Cross-commit memory adds value at team scale; solo dev sees marginal benefit | When second engineer joins or in Dawn |
| Auto-fix / agent-driven fix queue | High-leverage but high-risk; needs manual fix workflow first | After 1 month of stable manual-fix usage data |
| Cost cap enforcement | Eval doesn't have it either; symmetric punt | When monthly LLM bill becomes a real constraint |
| Cross-CLI adapters (Cursor, Codex) | Claude Code only for MVP, parallel to indusk-mcp's surface | Becomes Dawn-shape concern, not MVP |

## Notes for next session

- Sandy chose path (a) — skip brief, write impl directly. Trade-off accepted: faster start, less ceremony, partner-readable rationale lives in CLAUDE.md and the future changelog entry rather than a separate brief
- Tests-red-first is enforced trajectory-shape: every row authored at Phase 0, flipped to passing at later phases
- Reviewer is **a new petal in the Dawn-shaped architecture** — emits findings; future Dawn-app correlation can read them alongside eval scorecards, OTel traces, test results
