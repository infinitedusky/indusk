---
name: retrospective
description: Structured audit and knowledge handoff after impl completion. Reviews docs, tests, quality, and context accuracy. Distills planning artifacts into the docs site and archives the plan.
argument-hint: "[plan name]"
---

You know how to close out plans in this project.

## What Retrospective Does

The retrospective skill replaces the freeform "write a retrospective" step with a structured audit and knowledge handoff. It runs after all impl phases are complete and produces:

1. A retrospective document (the written reflection)
2. Verified documentation accuracy
3. Test coverage assessment
4. Quality ratchet updates
5. Context accuracy confirmation
6. Published knowledge in the docs site
7. Archived planning artifacts

## When to Use

- After `/work` completes all impl phases and the status is `completed`
- When `/planner {name}` detects the impl is completed and the next step is retrospective
- Directly via `/retrospective {plan-name}`

## The Audit Checklist

Work through these steps in order. Each step is blocking — do not skip ahead.

### Step 0: Ritual Gate — Falsification + Cleanup

**This gate blocks everything below. Do not proceed to Step 1 until it passes.**

Before writing a single word of the retrospective, confirm that the plan has completed **both** closing rituals — falsification **and** cleanup. Each is satisfied either via its phase-authoring flow (a Falsification Phase / a `### Phase N: Cleanup` phase, both terminal in impl.md), via a legacy sidecar log (falsification only), or via an explicit skip-reason frontmatter pair. **Both must pass.** The composed check is `checkRetrospectiveReadiness(planRoot, implContent)` from `@infinitedusky/indusk-mcp/cleanup/gate` (monorepo: `apps/indusk-mcp/src/lib/cleanup/gate.ts`) — it returns `{ passes, missing }`, where `missing` names any unsatisfied ritual.

**Falsification** is satisfied by any of the three conditions below.

Check the gate by reading three sources in this order:

1. **All impl phases terminal (new flow default):** Parse the impl's `## Test Trajectory` table. The gate passes if every phase is terminal — every `Passes at: Phase N` trajectory row is in a terminal state (`passing`, `skipped`, or `blocked`), AND the last phase is not a marker of open falsification work. In practice: if the `/falsify` ritual authored a Falsification Phase and `/work` subsequently closed it (and any fix-in-scope phases it spawned), this condition is automatically true. The phase sequence itself is the proof that the ritual ran.
2. **Legacy completion (pre-1.27.4 flow):** Does `.indusk/planning/{plan-name}/falsification.md` exist with a terminator entry? Use `isFalsificationComplete(planRoot)` from `apps/indusk-mcp/src/lib/falsification/log.js` (invoke via `tsx` or an MCP tool wrapper). Plans authored under the old flow still pass this way; the library is kept unchanged for backwards compatibility.
3. **Skip:** Does the impl's frontmatter contain BOTH `falsification: skipped` AND `falsification_reason: "{non-empty text}"`? Use `isFalsificationSkipped(implContent)`.

The **falsification** requirement passes if ANY of the three conditions above holds.

**Cleanup** must ALSO pass, by either of:

- **Complete:** the plan's impl.md has a terminal `### Phase N: Cleanup` phase — `isCleanupComplete(planRoot)` from `@infinitedusky/indusk-mcp/cleanup/gate` (monorepo: `apps/indusk-mcp/src/lib/cleanup/gate.ts`).
- **Skip:** the impl's frontmatter contains BOTH `cleanup: skipped` AND `cleanup_reason: "{non-empty text}"` — `isCleanupSkipped(implContent)`.

Cleanup runs AFTER falsification: `/work` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`. Evaluate both rituals at once with `checkRetrospectiveReadiness(planRoot, implContent)`. The gate passes only when BOTH requirements are satisfied. If either fails, refuse to run the retrospective and surface this message to the user:

> **Retrospective blocked: ritual gate not satisfied for `{plan-name}` (missing: `{the `missing` list — falsification and/or cleanup}`).**
>
> Before closing out a plan, run `/falsify {plan-name}` to exercise the bounty-hunting ritual — investigate the code, form specific hypotheses about what should be broken, and author a Falsification Phase in the plan's impl.md capturing the hypothesis tests + fix items. `/work` then picks up the phase and closes it normally; once all impl phases are terminal, this gate passes automatically.
>
> To skip the ritual intentionally, add these two fields to the impl's frontmatter:
>
> ```yaml
> falsification: skipped
> falsification_reason: "why skipping is acceptable for this specific plan"
> ```
>
> If cleanup is the missing ritual, run `/cleanup {plan-name}` to author a Cleanup Phase (decomposition recommendations `/work` then executes), or skip it intentionally:
>
> ```yaml
> cleanup: skipped
> cleanup_reason: "why skipping is acceptable for this specific plan"
> ```
>
> The skip-reasons are recorded in the archive and surfaced in retrospectives. Use sparingly — typically only for trivial typo-fix plans where the ritual cost exceeds the discipline value.

Do not proceed to Step 1 until the gate passes. This is structural enforcement of the discipline documented in the [Falsification Ritual guide](apps/indusk-docs/src/guide/falsification-ritual.md) — happy-path authoring produces happy-path tests, and the ritual is the mechanism for surfacing the gaps the author couldn't think of.

### Step 1: Write the Retrospective Document

Create `.indusk/planning/{plan-name}/retrospective.md` using the template from the plan skill. This is the reflective writing — what we set out to do, what actually happened, what we learned.

Key sections to fill in honestly:
- **What We Set Out to Do** — recap from the brief
- **What Actually Happened** — how did reality differ from the plan?
- **Getting to Done** — the unplanned work, debugging, surprises
- **What We Learned** — technical, process, or domain insights
- **What We'd Do Differently** — hindsight decisions
- **Insights Worth Carrying Forward** — takeaways for future plans

### Step 2: Structural Audit (Code Graph)

**Run `git diff --stat` against the plan's base** to understand what actually changed. Include structural findings in "What Actually Happened" — e.g., "Plan touched 8 files, +900/−250 lines."

### Step 3: Docs Audit

Review every documentation page that was written or updated during this plan's impl phases.

For each page:
- Does it describe what was **actually built**, not what was **planned**?
- Are code examples accurate and runnable?
- Are diagrams up to date with the final architecture?
- Are links valid?

Fix any discrepancies found. Plans often diverge from their impl during execution — the docs must reflect reality.

### Step 4: Test Audit

Review the test files created or modified during this plan.

- Are there obvious coverage gaps? (untested error paths, edge cases, integration points)
- Were any test files planned but not created?
- Do all tests pass? Run `pnpm test` to confirm.

Flag gaps but don't necessarily fix them all now — add them as items to a follow-up plan if they're significant.

#### Step 4a: Test Trajectory Audit

If the impl used a `## Test Trajectory` (frontmatter `trajectory: required`), run the trajectory audit:

```ts
// From apps/indusk-mcp/src/lib/trajectory/audit.ts
import { auditPlanAtClose } from "./audit.js";
const result = auditPlanAtClose(implBody);
// result.deferred: MitigationClassification[] — one per Deferred Verification row
// result.blocked: BlockedRowFinding[] — rows ending in `blocked` state
```

For each finding, act on it:

- **Blocked rows** — these ended the plan unresolved. For each: either (a) fix the test and update State to `passing` as a retroactive phase-close, (b) move the row's `Passes at` to a later plan with a link, or (c) promote to Deferred Verification with a real mitigation. Do not leave blocked rows unresolved — they're a debt flag.
- **Deferred rows with vague mitigations** (`warning` non-null) — the mitigation text was too short or unclassifiable. Propose a more concrete commitment: a specific OTel metric name, a named review owner with cadence, a linked plan ID, a documented canary procedure. Update the impl.md's Deferred Verification row before archiving.
- **Deferred rows classified as `downstream-plan`** — verify the referenced plan exists and is either `accepted` or `in-progress`. If it's `draft` or missing, either accept the referenced plan now or pick a different mitigation.
- **Deferred rows classified as `telemetry-alert`** — verify the named metric actually exists in the codebase (grep for it). If the metric hasn't been wired up, the mitigation is aspirational — either wire it up now or change the mitigation.

Flag findings as a highlight — the eval agent reads it, materializes a lesson when a durable rule emerged, and marks it processed:

```
mcp__indusk__highlight({
  tag: "retro-audit",
  note: "{plan-name}: {finding classification}; {what was done}; {warning if any}",
  level: "important"
})
```

Include the classification, the warning (if any), and what was done. This is the signal the eval agent uses to detect mitigation drift over time.

### Step 5: Quality Audit

Review mistakes made during this plan's implementation.

- Were there recurring lint errors or type errors during `/work`?
- Did any mistakes suggest a missing Biome rule?
- If yes: add the rule to `biome.json` and document the rationale in `biome-rationale.md`

The quality ratchet only gets tighter. Every retrospective is an opportunity to prevent the same class of mistake from happening again.

### Step 6: Lesson Capture

Review the plan's journey — research, implementation, debugging, surprises — and ask:

**"Did we learn anything non-obvious that applies beyond this specific plan?"**

Examples of good lessons:
- "Never use fallback values where a required config value is expected — it hides missing env vars"
- "Always check if the library has an official plugin before building custom"
- "Run the full test suite after changing shared types, not just the tests in the changed package"

If yes, call `add_lesson` for each one. These become personal lessons in `.claude/lessons/` — available to the agent in every future session across all projects.

If no lessons emerged, that's fine — not every plan produces new knowledge. Move on.

**Also flag each retrospective insight as a highlight** so the eval agent can materialize durable ones into lessons that surface in every future catchup.

For each item in the retrospective's **What We Learned** section:
```
mcp__indusk__highlight({
  tag: "retro-lesson",
  note: "{plan-name}: {the insight, with enough context for the eval agent to write a full episode}",
  level: "important"
})
```

For each item in the retrospective's **What We'd Do Differently** section:
```
mcp__indusk__highlight({
  tag: "retro-hindsight",
  note: "{plan-name}: {the hindsight item, with reasoning}",
  level: "important"
})
```

The eval agent reads each highlight, writes a lesson when it carries a durable rule (`community-` prefix if clearly cross-project), and marks it processed. The working agent does not write the lesson directly.

**Contradictions:** If the retrospective surfaces a moment where "we thought X but found Y", flag it as a highlight naming BOTH the old assumption and the overturning fact — the resulting lesson records the reversal explicitly so a future session doesn't re-introduce the overturned assumption.

Skip silently if `mcp__indusk__highlight` is unavailable — highlights are best-effort, and lesson recording via `add_lesson` remains the canonical local path.

### Step 7: Context Audit

Re-read CLAUDE.md in full. After the entire impl is done, verify:

- **Architecture** — does it reflect the current state of the repo?
- **Conventions** — are all conventions that emerged during this plan captured?
- **Key Decisions** — was the ADR decision added (post-ADR trigger)?
- **Known Gotchas** — were all surprises and corrections captured?
- **Current State** — does it reflect what's actually in progress?

Fix any inaccuracies. The impl may have changed things that weren't anticipated in the per-phase context updates.

#### Current State entries are ONE LINE + link to archive (1.31.11)

When you add a Current State entry for a newly-completed plan, write it as **one line + a link to the archive**, not as a multi-paragraph prose entry. Every retrospective accretes Current State; over 20-30 plans, paragraph entries push CLAUDE.md past 30KB of always-loaded prose. The detail lives in the archived plan + the docs site decisions/lessons pages — the Current State entry is a pointer, not a duplicate.

**Use this shape:**

```markdown
- **{plan-name} ({version})** — one-sentence summary of what shipped. See [archive](.indusk/planning/archive/{plan-name}/) for full detail.
```

Example:

```markdown
- **workbench-mode-rail-integrity (1.31.10)** — eval→Graphiti pipeline works on workbench-shaped projects; 4 hooks refactored, stray-state audit added, falsification surfaced 2 more bugs both fixed. See [archive](.indusk/planning/archive/workbench-mode-rail-integrity/) for full detail.
```

**Counter-example — do NOT write this shape going forward**:

```markdown
- **plan-name shipped in 1.X.Y (2026-XX-XX)** — three paragraphs of detail
  about what the plan did, what shipped in each phase, what bugs were
  found in falsification, what lessons were captured, what's deferred to
  follow-up work, with embedded code references and file paths and...
  [continues for ~500 chars]
```

The counter-example is **token bloat on every catchup**, paid by every Claude Code session forever. The one-line shape preserves discoverability (the plan name + version + link is enough for the agent to know what to query) at a fraction of the cost.

Existing multi-paragraph entries (pre-1.31.11) can be collapsed via `indusk prune --dry-run` (which surfaces them) plus manual operator cleanup — they are not auto-migrated.

#### Compaction step (indusk-makeover — the decay half of the budget)

Adding one-line entries stops NEW growth; this step produces shrinkage. As part of every plan close:

1. **Demote this plan's own narratives.** The plan accumulated Current State prose while in flight (per-phase context updates, in-flight markers). Replace all of it with the single one-line entry above. Any multi-paragraph Conventions/Gotchas entries this plan authored get compressed to 1–3 lines: the operative rule sentence(s) + a pointer to the decisions/lessons page or archived plan doc. **The rule stays; the narrative moves behind the pointer.**
2. **Sweep one stale narrative while you're here** (the periodic pass): pick the oldest multi-paragraph Current State entry for an already-shipped plan and collapse it to the one-line shape. One per retrospective keeps the backlog draining without a dedicated session.
3. **Verify pointers**: run `indusk context check-pointers` — every pointer you just wrote must resolve. A dead pointer under this regime is a lost rule body.

The `claude-md-budget.js` hook enforces the 60 KB ceiling at write time (`context.claude_md_budget_bytes`); if your retrospective edit trips it, do more of step 1/2 rather than fighting the hook. If the file is *already* multiples over budget (the hook was installed after it grew, or incremental compaction never ran), this per-close step can't catch up on its own — run `/compact-context` (the bulk-remediation companion) for a full editorial pass. See [the context-budget guide](../../docs/src/guide/context-budget.md).

Why this matters: CLAUDE.md is auto-loaded into every Claude Code session. Every byte you add accrues to every prompt indefinitely. The discipline is "thinner navigation layer, queryable detail" — see [context-budget brief](../../.indusk/planning/context-budget/brief.md) for the full rationale.

### Step 8: Knowledge Handoff

Distill planning artifacts into the docs site so the knowledge survives archival.

**ADR → Decisions page:**
Create `apps/indusk-docs/src/decisions/{plan-name}.md` with:
- A concise summary of what was decided and why
- Link to the full ADR in the archive: `.indusk/planning/archive/{plan-name}/adr.md`
- Key tradeoffs accepted

**Retrospective insights → Lessons page:**
If the retrospective produced broadly useful insights, create `apps/indusk-docs/src/lessons/{plan-name}.md` with:
- What we learned that applies beyond this specific plan
- What we'd do differently and why

Not every plan produces a lessons page — only create one if the insights are genuinely reusable.

**Update sidebar:** Add new decision/lesson pages to the VitePress sidebar config in `apps/indusk-docs/src/.vitepress/config.ts`.

### Step 9: Archival

Move the planning artifacts to the archive:

```bash
mkdir -p .indusk/planning/archive
mv .indusk/planning/{plan-name} .indusk/planning/archive/{plan-name}
```

The docs site now holds the published knowledge. The archive holds the process history. Both are preserved, but the docs are the primary reference going forward.

Update CLAUDE.md Current State to remove the plan from the active plans table.

## Important

- Work through the steps in order. Each builds on the previous.
- The retrospective document is reflective writing, not a status report. Be honest about what went wrong.
- The docs audit checks reality against documentation, not documentation against the plan.
- The quality ratchet only gets tighter — never remove Biome rules during a retrospective.
- Archival is a knowledge handoff, not just filing. The docs site must capture what matters before the plan moves to archive.
- If you discover significant issues during any audit step, flag them to the user before continuing.
