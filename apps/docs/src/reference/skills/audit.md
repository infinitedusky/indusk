# Audit

The audit skill has a reader that did not build the plan read it once, when the build phases close. Every other close-out ritual is run by the agent that built the plan, in the session that holds every document and diff it wrote; the audit hands the plan to a fresh subagent on the model `workflow.steps.audit.tier` names, and what it finds is written to `audit.md` in the plan folder. The plan's agent then answers every finding, and the person is shown each one it waved away. It is advisory: the retrospective checks that the file exists, never what it says. Before approval, the same skill reads the plan's documents cold (`--before-approval`, below).

## When to Run

When the build phases close, before falsification: `/work` → **`/audit`** → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`. `indusk plans next` answers `audit` and `indusk plans next-session` names `/audit <plan>` once every phase is closed and neither `audit.md` nor a skip is there. An unattended build runs it as a step of its own.

## What the Auditor Gets

[`indusk plans audit-inputs <plan>`](/reference/cli/plans#plans-audit-inputs-name-approved-sha) prints, and the skill passes on, only:

- the brief, the test plan and the ADR, as they stand now (not as approved — an ADR edited during the build reaches the reader edited);
- the impl **as it was merged at approval**, named by a `<sha>:<file>` path the reader opens with `git show` (or reads from the text), never the working file, so what the builder appended since is not in it;
- the trajectory table as it stands, every row in its final state — including rows falsification and cleanup added, whose text is the builder's findings;
- the branch's diff against the trunk, without anything under `.indusk/` (the builder's notes live there);
- a `--stat` of the files the plan changed, and a `tree` of every tracked file.

Nothing from the session's conversation, `research.md` or `current.md`, and none of the falsification and cleanup phases' notes. Two leaks remain, named above: the documents as they stand and the later trajectory rows. A second reader that has read the first reader's notes is not a second reader, so these are the follow-up's to close.

## The Model

`indusk plans model <plan> --step audit` answers the step's tier and model; the skill spawns an Agent with that `model`. With no tier configured it answers `session` and the skill spawns with no model, so the reader runs on the session's. The skill prints the model the Agent reports. The reader runs in the foreground: the skill waits for its report and never ends its turn while the reader runs, because in an unattended run an ended turn ends the step.

## The Questions

1. Does each row prove its promise's sentence, or something narrower?
2. What does the diff change that no row touches?
3. What does the code do that the brief never promised?
4. Which rejected ADR alternative does the code quietly take?

Under each finding the reader writes `- breaks when: <what would show it breaking>` and no remedy.

## Answers

The plan's agent answers each finding beneath its `breaks when:` line: `- answer: fix — <the impl item added>`, `- answer: signal — <invariant>; <where emitted>; <how often it fires>; clause: <promise>/<clause>`, `- answer: nothing — <reason>`, or `- answer: amendment — <part of the brief changed>`. An answer that would change a promise, an expectation, a look or the scope is an amendment: the agent edits the brief and the session ends, and the build stops by name until a person re-approves (`plans next` answers `amendment`). Every other concern is answered without asking. The agent then asks once what let the findings through and writes a closing `## What let these through?` section, with a `mcp__indusk__highlight` (tag `audit-cause`) for each process gap that could recur, or `- no process gap — <reason>`. [`plans audit-answers`](/reference/cli/plans#plans-audit-answers-name-plan-review) refuses a finding left open and prints every dismissal and amendment answer, which the skill shows the person.

## The Shape of `audit.md`

A short frontmatter (`plan`, `audited`, `model`), then one `##` per question in the order above. Under each, findings as `- <file>:<line> — <finding>` with their `breaks when:` and `answer:` lines, or the single line `- nothing`. A heading with neither is an unanswered question.

## Before Approval

`/audit <plan> --before-approval` runs the same reader over [`plans review-inputs`](/reference/cli/plans#plans-review-inputs-name) — the brief, test plan, ADR and impl as they stand and the tracked files, never `research.md` — with four questions: do the planned tests prove each promise's sentence, or something narrower; does the impl build what each promise claims, and nothing it does not; which skip reason would you not accept; what else would have to change for each promise to hold. It writes `plan-review.md`; the planning agent answers with `fix — <document changed>`, `amendment —` or `nothing —`. `plan-review.md` opens with `read: <hash>` (printed by `plans review-inputs`); the review is out of date as soon as the brief, test plan, ADR or impl changes, and the planning run reads the plan cold again. A `signal` answer is refused before approval. At the `ready-for-approval` stop the person also sees what the brief says now that it did not say when accepted. An unattended planning run does it as its last step, and the planner skill runs it before presenting a plan written by hand.

## Skipping

```yaml
audit: skipped
audit_reason: "a one-line copy change; a fresh reader would find nothing to question"
```

Both fields; a bare `audit: skipped` does not pass, and neither does a reason over 120 characters or of more than one sentence: the Step 0 readiness check refuses it and names the length and sentence count. The reason is one sentence; the detail goes in the impl body. [`/retrospective`](/reference/skills/retrospective) Step 0 refuses to start without `audit.md` or the pair.

## What the reader holds

Findings may be `-`, `*` or numbered items. A cause under `What let these through?` must name its findings and its highlight (`- <cause> — findings: <refs> — highlight: <id>`), or be `- no process gap — <reason>`. A clause named in a `signal` answer is read without trailing punctuation and checked against the registry of the plan's own copy. The build counts the audit done only when its answers read complete, and an edit to the brief's Not promised list after approval is an amendment that waits for the person.

## Signals

Each check reports the clause it checks, so a plan with clauses can close on a real run. `indusk plans audit-answers` reports the audit's four clauses (finds, answers, dismissals shown, teaches) or, with `--plan-review`, the four-questions clause; `indusk plans review-inputs` reports that the reader is handed documents only; a planning run reports reading it cold and answering before approval when it stops for approval; a build reports the significant-concern clause when it stops on a waiting amendment. A signal never fails its command.

## Advisory

No gate reads a finding. A plan full of findings closes the same as one with none; whether any is acted on is the person's choice, and the first expectation in the plan's brief measures it over the next five plans closed.
