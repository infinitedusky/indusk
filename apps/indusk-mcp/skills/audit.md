---
name: audit
description: Run the audit step against a plan whose /work, /falsify and /cleanup have completed. Spawns a reader that did not build the plan, on the model workflow.steps.audit.tier names, hands it the plan's documents and diff and a fixed list of questions, and has it write audit.md in the plan folder. Advisory — no gate reads what it says. Runs after /cleanup, before /retrospective.
argument-hint: "{plan-name}"
---

You are about to run the **audit** against a plan whose building and close-out rituals have finished. Every other ritual was run by the agent that built the plan; this one is read cold. Your job is not to read the plan yourself but to **hand it to a reader that has not seen the session** and make sure what it finds is written down.

The audit is **advisory**. `audit.md` must exist (or the impl must say why the audit was skipped) before `/retrospective` starts, but nothing reads what it says. A finding blocks no gate, no checkbox, no merge.

## Steps

1. **Ask which model the audit runs on.**

   ```bash
   indusk plans model {plan} --step audit
   ```

   It prints `<tier> <model>` (`opus`, `sonnet`, `haiku` or `fable`), or `session` when the config names no tier for the step.

2. **Get the inputs.**

   ```bash
   indusk plans audit-inputs {plan}
   ```

   It prints JSON: `documents` (brief, test plan, ADR), `implAsApproved`, `trajectoryNow`, `diff`, `stat` (the files the plan changed), `tree` (every tracked file), `approvedAt`. If it refuses because no approval merge is found, history was rewritten: ask the person for the merge sha and rerun with `--approved <sha>`. Do not audit from the working copy's impl instead — it holds the falsification and cleanup phases the reader must not see.

3. **Spawn the reader.** Call the Agent tool with `model` set to the model step 1 named (omit `model` when it printed `session`). The prompt is the inputs plus the questions below, and nothing else: do not paste your conversation, your own notes, `research.md`, `current.md`, or the falsification and cleanup findings. The point of a second reader is that it has not read the first reader's notes.

   Tell the reader to read the documents at their paths rather than relying on your summary, and to read the approved impl from `implAsApproved.text`, or with `git show <implAsApproved.path>` in the trunk (the path is `<sha>:<file>`, a committed version) — never from the working `impl.md`, which holds the falsification and cleanup phases; `trajectoryNow` is the only field that names the working file. Tell it to write `.indusk/planning/{plan}/audit.md` (in the plan's worktree) in the shape below.

4. **Record the model.** The Agent reports the model it ran on; print it in your reply (`audit ran on claude-…`). If the spawn did not honour the model, say so plainly — do not claim a tier that was not used.

5. **End with the next step.**

   ```bash
   indusk plans next-session {plan}
   ```

   Print its line. It names `/retrospective {plan}` once `audit.md` exists.

**Unattended** (an admin build or `indusk run` — no one to ask): the same steps, without asking. A refused `audit-inputs` is a blocker, not a reason to audit from the working copy; stop and say so.

## The questions

Put these to the reader, verbatim, each as one `##` heading in `audit.md`:

1. **Does each row prove its promise's sentence, or something narrower?** For each promise in the brief, read the trajectory rows that name it and say whether passing them proves the promise as worded.
2. **What does the diff change that no row touches?** Behaviour in the diff that nothing in the trajectory would notice changing.
3. **What does the code do that the brief never promised?** Behaviour present in the diff with no promise, expectation or scope line behind it.
4. **Which rejected ADR alternative does the code quietly take?** Where the implementation matches something the ADR's Alternatives Considered rejected.
5. **Which skip reason would you not accept?** Any `skipped` row, `(none needed)` gate, or `*_skipped` frontmatter pair whose reason does not hold.
6. **What else would have to change for each promise to hold?** Using `tree` (every tracked file) against `stat` (the files the plan changed): files the plan did not touch that a promise depends on.

## The shape of `audit.md`

```markdown
---
plan: {plan}
audited: {YYYY-MM-DD}
model: {the model the reader reported}
---

# Audit — {plan}

## Does each row prove its promise's sentence, or something narrower?
- `<file>:<line>` — <finding>

## What does the diff change that no row touches?
- nothing

(…one `##` per question, in the order above…)
```

The heading is the question's text, unnumbered. Under each heading: findings as `- <file>:<line> — <finding>` (a file and line wherever there is one), or the single line `- nothing`. A heading with neither is an unanswered question; send the reader back.

## Skipping

A trivial plan (a typo, a changelog line) may skip the audit with both fields in the impl's frontmatter:

```yaml
audit: skipped
audit_reason: "why skipping is acceptable for this specific plan"
```

`/retrospective` Step 0 accepts the pair and refuses a bare `audit: skipped`. Under `gate_policy: ask`, ask the person before writing it.

## Output

By the time you hand off to `/retrospective`, one of these must be true:

- `audit.md` exists in the plan folder, written by the reader in the shape above.
- The impl's frontmatter contains `audit: skipped` + `audit_reason` with a real reason.

Read the findings with the person; whether any is acted on is their choice. If one is, add it as an item to the plan like any discovered work.
