# Audit

The audit skill has a reader that did not build the plan read it once before it closes. Every other close-out ritual is run by the agent that built the plan, in the session that holds every document and diff it wrote; the audit hands the plan to a fresh subagent on the model `workflow.steps.audit.tier` names, and what it finds is written to `audit.md` in the plan folder. It is advisory: the retrospective checks that the file exists, never what it says.

## When to Run

After `/cleanup`, before `/retrospective`: `/work` → `/falsify` → `/work` → `/cleanup` → `/work` → **`/audit`** → `/retrospective`. `indusk plans next` answers `audit` and `indusk plans next-session` names `/audit <plan>` once falsification and cleanup are done and neither `audit.md` nor a skip is there. An unattended build runs it as a step of its own.

## What the Auditor Gets

[`indusk plans audit-inputs <plan>`](/reference/cli/plans#plans-audit-inputs-name-approved-sha) prints, and the skill passes on, only:

- the brief, the test plan and the ADR, as they stand now (not as approved — an ADR edited during the build reaches the reader edited);
- the impl **as it was merged at approval**, named by a `<sha>:<file>` path the reader opens with `git show` (or reads from the text), never the working file, so the falsification and cleanup phases the builder appended since are not in it;
- the trajectory table as it stands, every row in its final state — including rows falsification and cleanup added, whose text is the builder's findings;
- the branch's diff against the trunk, without anything under `.indusk/` (the builder's notes live there);
- a `--stat` of the files the plan changed, and a `tree` of every tracked file.

Nothing from the session's conversation, `research.md` or `current.md`, and none of the falsification and cleanup phases' notes. Two leaks remain, named above: the documents as they stand and the later trajectory rows. A second reader that has read the first reader's notes is not a second reader, so these are the follow-up's to close.

## The Model

`indusk plans model <plan> --step audit` answers the step's tier and model; the skill spawns an Agent with that `model`. With no tier configured it answers `session` and the skill spawns with no model, so the reader runs on the session's. The skill prints the model the Agent reports.

## The Questions

1. Does each row prove its promise's sentence, or something narrower?
2. What does the diff change that no row touches?
3. What does the code do that the brief never promised?
4. Which rejected ADR alternative does the code quietly take?
5. Which skip reason would you not accept?
6. What else would have to change for each promise to hold? (reading `tree` against `stat`: the files the plan did not touch)

## The Shape of `audit.md`

A short frontmatter (`plan`, `audited`, `model`), then one `##` per question in the order above. Under each, findings as `- <file>:<line> — <finding>`, or the single line `- nothing`. A heading with neither is an unanswered question.

## Skipping

```yaml
audit: skipped
audit_reason: "why skipping is acceptable for this specific plan"
```

Both fields; a bare `audit: skipped` does not pass. [`/retrospective`](/reference/skills/retrospective) Step 0 refuses to start without `audit.md` or the pair.

## Advisory

No gate reads a finding. A plan full of findings closes the same as one with none; whether any is acted on is the person's choice, and the first expectation in the plan's brief measures it over the next five plans closed.
