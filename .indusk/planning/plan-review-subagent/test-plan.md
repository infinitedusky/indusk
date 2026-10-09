---
title: "plan-review-subagent — Test Plan"
date: 2026-10-09
status: draft
---

# plan-review-subagent — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean a plan is audited by a fresh reader before it closes. Each assertion names its level, the smallest that can prove it, and so when its test runs. They are grouped by the promise in the brief that they prove.

## Behavioral Assertions

### `a-plan-is-audited-by-a-fresh-reader-before-it-closes` — audit.md exists, or the impl says why not, before the retrospective

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan with every phase closed, falsification and cleanup done, and no audit.md: the retrospective refuses to start, naming `/audit <plan>`, and `indusk plans next` answers `audit` rather than `review`. | unit |
| A2 | The same plan with audit.md present, or with `audit: skipped` and a reason in the impl frontmatter: the retrospective's gate passes and `plans next` answers `review`; a bare `audit: skipped` with no reason does not. | unit |
| A3 | When the cleanup phase closes, the next-session line names `/audit <plan>`; once audit.md exists it names `/retrospective <plan>`. | unit |
| A4 | An admin build whose cleanup step has ended runs the audit step next, and still stops at the person's review without being asked. | unit |

### `the-auditor-sees-the-plan-not-the-session` — the inputs are the plan's documents and its diff

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | `indusk plans audit-inputs <plan>` lists the brief, the test plan, the ADR, the impl as approved, the trajectory table as it stands, the diff of the branch against the trunk, and a `--stat` of the whole repository — and nothing else: no research, no current.md, no conversation. | unit |
| A6 | After falsification and cleanup have appended phases to the impl, the impl the auditor gets is still the one merged at approval — it holds none of those phases — while its trajectory table shows every row's final state. | unit |
| A7 | The diff the auditor gets holds the plan's code and docs and leaves out InDusk's bookkeeping (`.indusk/` other than the plan's own folder). | unit |

### `the-auditor-runs-on-its-tier` — the configured tier's model, or the session's

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | With `workflow.steps.audit.tier` set, `indusk plans model <plan> --step audit` answers that tier's model; with no tiers configured it answers `session`; `audit` is accepted by the config reader as the other steps are, and an unknown step is refused naming it. | unit |
| A9 | Claude Code runs the audit handed to it on the named model and writes audit.md, observed once against the real `claude` on a scratch plan. | live check |

### `an-audit-blocks-nothing` — findings change no gate

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | An audit.md full of findings leaves the retrospective's gate passing and `plans next` at `review`; an empty audit.md does the same. | unit |

### Must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | The admin's review (`indusk plans review`) prints the same evidence with and without audit.md in the plan folder. | unit |
| A12 | Adding `audit` to the tier steps changes no phase's answer: `plans model <plan> --phase <ref>` answers as before for a config with and without `steps.audit`. | unit |

## Untestable Assertions

None. Whether the auditor's findings are *worth* anything is the brief's first expectation, measured over the next five plans, not a test.

## Notes

- A9 is the one live check; it exists because the skill, not the package, spawns the reader, and nothing in the package can observe Claude Code doing it.
- A6 needs the approval merge: `plans approve` records the merge sha in its output today but not in the plan; the impl will need to decide whether the inputs command finds it from git history (the merge commit whose message names the plan) or from a line the approval writes. A row for that decision is not a behaviour the user sees, so none is listed.
