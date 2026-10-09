---
title: "plan-review-subagent — the audit step"
date: 2026-10-09
status: proposed
---

# plan-review-subagent — the audit step

## Goal

**Every plan is read once, before it closes, by a reader that did not build it, on the strongest tier, and what it finds is written down where the retrospective must see it.**

Today the three close-out rituals are run by the same agent that built the plan, in the session that holds every document and every diff it wrote. Falsification is a goal-flip of that one mind; it found four holes in `model-per-phase`, and all four were the builder's blind spots pointed at by the builder. Nothing in the close-out is read cold. This ADR adds that reading as a step — `/audit` — run by a fresh subagent on `workflow.steps.audit.tier`, writing `audit.md`, advisory.

## Y-Statement

**In the context of:**
closing a plan whose phases were built on cheap tiers (`model-per-phase`), where the expensive model should be spent where output is short and a missed defect is costly, and where every close-out ritual today is run by the agent that built the plan.

**Facing:**
a reviewer that shares the builder's context shares its blind spots; a reviewer that blocks on findings would stall unattended builds on taste; and the builder's own findings (falsification, cleanup) live as prose inside the impl, so "the plan without them" cannot be cut out without a parser.

**We decided for:**
a step after cleanup, before the retrospective, named `audit`: the skill spawns a subagent with the configured tier's model and hands it only file paths and a diff — the brief, test plan, ADR, the impl *as it was merged at approval* (found by the approval merge commit, `plan(<plan>): approved — …`), the trajectory table as it stands, the branch's diff against the trunk with InDusk bookkeeping excluded, and a repository-wide `--stat` — plus a fixed list of questions. The subagent writes `audit.md`. `checkRetrospectiveReadiness` gains the word `audit`, satisfied by the file's existence or by `audit: skipped` with a reason. The build runner gains the step. The package supplies the inputs (`plans audit-inputs`) and the gate; the skill supplies the spawn; no finding is read by any gate.

**And against:**
making the auditor a phase in the impl, as falsification is (it would be the builder's hand writing the fresh reader's findings into the builder's document, and it would block); a package-side spawn (the package cannot call Claude Code's Agent tool, only a session can); stripping falsification and cleanup from the current impl with a parser (a parser to maintain for a document git already holds in the right state); calling the step `review` (the admin's acceptance panel owns that word and its promise); and a free-form "review this" prompt (long taste lists, no cheap output).

**To achieve:**
one expensive read per plan, input-heavy and output-light, whose findings are independent of the builder's — so agreement with falsification says the cheap tiers' hunt works and disagreement says what it misses — and a record the retrospective cannot skip without saying so.

**Accepting:**
the auditor can repeat what falsification already found (that is information, not waste); the audit reads the plan and its diff and cannot see what the plan never touched beyond the `--stat` question; whether the findings are acted on is the person's choice, measured by the brief's first expectation; and the live check of the spawn (A9) is observed once, not tested.

**Because:**
the point of a second reader is that it has not read the first reader's notes. Git already holds the impl before any finding was written into it, at the approval merge, so the independent input is free; the retrospective's readiness list is already the one place every ritual is counted; and the subagent-on-model hand-off already exists in `/work`, so the audit is one more use of it rather than new machinery.

## Context

See `research.md`: what exists (`TIER_STEPS`, `BuildStepName`, `stepPrompt`, `nextBuildStep`, `checkRetrospectiveReadiness`, `branchFileChanges`), the name collision, and Sandy's three choices (advisory as a document; documents and diff never the conversation; a step for interactive plans and admin builds). The brief holds the four promises; the test plan, A1–A12.

## Decision

1. **A new ritual word, `audit`.** `checkRetrospectiveReadiness` adds `audit` to `missing` when `audit.md` is absent from the plan folder and the impl's frontmatter does not carry `audit: skipped` with a non-empty `audit_reason`. `nextBuildStep` answers `{ step: "audit" }` when `missing` holds it and neither `falsification` nor `cleanup` is missing. `nextSession` maps it to `/audit <plan>`. `RITUAL_ORDER` is not changed: the audit is a document, not a phase, and the admin's activity derivation reads phase titles.
2. **`plans audit-inputs <plan>`** prints, as JSON, the paths and texts the auditor gets: `brief.md`, `test-plan.md`, `adr.md` (when present), the impl at the approval merge (`git show <sha>:<path>`, the sha found as the first-parent merge on the trunk whose subject is `plan(<plan>): approved`), the current `## Test Trajectory` table, `git diff <merge-base>...<branch>` over the branch's paths less `.indusk/**` other than the plan's own folder, and `git diff --stat` over the whole tree. It refuses, naming what is missing, when the approval merge cannot be found: an audit of an unapproved plan has no "as approved".
3. **`plans model <plan> --step audit`** answers the step's tier and model as `--phase` does for a phase; `audit` joins `TIER_STEPS`.
4. **The skill `/audit`** runs `plans model --step audit`, then `plans audit-inputs`, spawns an Agent on the named model (or none, when `session`) with the inputs and the fixed question list, requires the result to be written as `audit.md` with a fixed shape (one heading per question, findings as a list with file and line where there is one, an explicit "nothing" where there is none), and ends by printing `plans next-session`. The question list is in the skill, not the package: it is prose for a reader.
5. **The build runner** adds `audit` to `BuildStepName` and `stepPrompt`; `stepEnv` marks it as a build step. The step's `model` comes from the same tier read the admin would use for a phase (not promised here; the admin's Build button passing models is still the model-per-phase follow-up — the runner names the tier and the session's skill spawns on it, so the admin needs no change for the audit to run on its tier).
6. **The retrospective skill** names `audit` in its Step 0 refusal text and accepts the skip pair, as it does for the other two rituals.

## Alternatives Considered

### The audit as a phase appended to the impl
Rejected: it would be written by the builder's hand and gated by the builder's checkboxes, and a phase blocks the retrospective until closed — the opposite of advisory.

### A parser that removes the falsification and cleanup phases from the current impl
Rejected: a second reader of phase boundaries to keep in step with `impl-headings`, for a document git already holds in the needed state at the approval merge.

### `review` as the name
Rejected: `plans review` and `a-review-shows-its-evidence` own the word for the person's acceptance view.

### Spawning from the package
Rejected: the package cannot call the Agent tool. The split — package supplies inputs and gate, skill spawns — is the same one `/work` uses for phases.

## Consequences

### Positive
- One strong read per plan at the cheapest point to spend it.
- The retrospective cannot skip it silently.
- Agreement or disagreement with falsification becomes measurable.

### Negative
- One more ritual word in four places (readiness, next-step, next-session, the retrospective skill's text).
- `audit.md` is unread by any gate; its value depends on the person reading it.

### Risks
- The approval merge is found by commit subject; a rewritten history loses it. Mitigation: `audit-inputs` refuses and says so; the skill then asks for the sha by hand (`--approved <sha>`).
- The spawn is a live check, not a test (A9). Mitigation: the skill prints the model the subagent reports, as `/work` does.

## Documentation Plan

### Pages
- New: `reference/skills/audit.md` — what the auditor gets, the question list, the shape of `audit.md`, the skip pair.
- Update: `reference/cli/plans.md` — `plans audit-inputs`, `plans model --step`, `plans next` and `next-session` answering `audit`.
- Update: `guide/plan-lifecycle.md` — the close-out is `/falsify` → `/cleanup` → `/audit` → `/retrospective`.
- Update: `reference/skills/retrospective.md` — Step 0 names the audit.

### Diagrams
- The close-out sequence in `guide/plan-lifecycle.md` gains the audit step (Mermaid, existing diagram).

### Changelog
- Added: the audit step; `plans audit-inputs`; `plans model --step`; `workflow.steps.audit.tier`.

### ADR in Docs
- Yes: `decisions/plan-review-subagent.md`, titled "The audit step".

## References
- `research.md`, `brief.md`, `test-plan.md` in this folder
- `.indusk/planning/archive/model-per-phase/` — tiers and the subagent-on-model hand-off
- `.indusk/planning/archive/admin-plan-authoring/adr.md` — D4–D7, the build runner and the person's review
