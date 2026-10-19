---
name: audit
description: Run the audit step against a plan whose build phases have closed (or, with --before-approval, a plan not yet approved). Spawns a reader that did not build the plan, on the model workflow.steps.audit.tier names, hands it the plan's documents and a fixed list of questions, and has it write audit.md (plan-review.md before approval). The plan's agent then answers every finding with a fix, a signal or a reason, and shows the person each dismissal. Runs when the build phases close, before /falsify.
argument-hint: "{plan-name}"
---

You are about to run the **audit** against a plan whose build phases have closed. It runs before falsification and cleanup: the order is `/work` → `/audit` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`. Every other ritual is run by the agent that built the plan; this one is read cold. Your job is not to read the plan yourself but to **hand it to a reader that has not seen the session**, make sure what it finds is written down, and then **answer every finding yourself** — you are the agent that knows the plan.

The audit is **advisory**. `audit.md` must exist (or the impl must say why the audit was skipped) before `/retrospective` starts, but nothing gates on what it says. What the audit asks of you is an answer to each finding, and that the person sees every finding you waved away.

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

   It prints JSON: `documents` (brief, test plan, ADR), `implAsApproved`, `trajectoryNow`, `diff`, `stat` (the files the plan changed), `tree` (every tracked file), `approvedAt`. If it refuses because no approval merge is found, history was rewritten: ask the person for the merge sha and rerun with `--approved <sha>`. Do not audit from the working copy's impl instead — it holds what was added since approval, which the reader must not see.

3. **Spawn the reader.** Call the Agent tool with `model` set to the model step 1 named (omit `model` when it printed `session`). The prompt is the inputs plus the questions below, and nothing else: do not paste your conversation, your own notes, `research.md`, `current.md`, or your own notes on the build. The point of a second reader is that it has not read the first reader's notes.

   Tell the reader to read the documents at their paths rather than relying on your summary, and to read the approved impl from `implAsApproved.text`, or with `git show <implAsApproved.path>` in the trunk (the path is `<sha>:<file>`, a committed version) — never from the working `impl.md`, which holds what was added since approval; `trajectoryNow` is the only field that names the working file. Tell it to write `.indusk/planning/{plan}/audit.md` (in the plan's worktree) in the shape below.

4. **Record the model.** The Agent reports the model it ran on; print it in your reply (`audit ran on claude-…`). If the spawn did not honour the model, say so plainly — do not claim a tier that was not used.

5. **Answer every finding.** For each finding in `audit.md`, add one answer line beneath its `- breaks when:` line, one of four kinds:

   - `  - answer: fix — <the impl item added>` — add the fix to the impl as discovered work (in the build phase it belongs to, or a new one) and say which item it is.
   - `  - answer: signal — <the invariant>; <where it is emitted>; <how often it fires>; clause: <promise>/<clause>` — the finding is answered by telemetry that would show it breaking, naming the clause it upholds.
   - `  - answer: amendment — <the part of the brief changed>` — see below.
   - `  - answer: nothing — <reason>` — the finding is real but you are not acting on it. Give the reason in one line; it is shown to the person.

   **A significant concern goes to the person, by one rule.** An answer that would change a promise, an expectation, a look or the scope the person approved is an edit of the brief, recorded as an `amendment` answer. Make the edit to the brief, then **end the session**: the build stops by name until the person re-approves. Never decide whether a concern is significant by how serious it feels; only by whether the answer changes what was approved. Every other concern you answer without asking.

6. **Ask once what let these through.** Across all the findings, not one by one, ask what in the planning or the building let them through. Group the findings by cause. For each cause that is a process gap that could recur, write a highlight so the evaluator decides whether it becomes a lesson:

   ```
   mcp__indusk__highlight({ tag: "audit-cause", note: "<the cause, and the findings it let through>", level: "important" })
   ```

   Close `audit.md` with a section listing each cause:

   ```markdown
   ## What let these through?
   - <cause> — findings: <question or file:line refs> — highlight: <id>
   ```

   A one-off slip is not a gap and gets no highlight. When there is no gap, write the single line `- no process gap — <reason>`. An audit with findings and no such section is not finished.

7. **Show the person what you waved away.**

   ```bash
   indusk plans audit-answers {plan}
   ```

   It exits 2 naming any finding with no `breaks when:` line, no answer, or a `signal` answer that names no clause, and any missing question or causes section: answer what it names and run it again. When it passes it prints every dismissal (each `nothing` answer, with its finding and reason) and every amendment answer. Print them to the person in your reply, before the next step.

8. **End with the next step.**

   ```bash
   indusk plans next-session {plan}
   ```

   Print its line. It names `/falsify {plan}` once `audit.md` exists, or says the build waits for the person's re-approval of an amendment.

**Unattended** (an admin build or `indusk run` — no one to ask): the same steps, without asking. A refused `audit-inputs` is a blocker, not a reason to audit from the working copy; stop and say so. An `amendment` answer ends the session; the build stops for the person.

## The questions

Put these to the reader, verbatim, each as one `##` heading in `audit.md`. They are `AUDIT_QUESTIONS` in `lib/audit/answers.ts`:

1. **Does each row prove its promise's sentence, or something narrower?** For each promise in the brief, read the trajectory rows that name it and say whether passing them proves the promise as worded.
2. **What does the diff change that no row touches?** Behaviour in the diff that nothing in the trajectory would notice changing.
3. **What does the code do that the brief never promised?** Behaviour present in the diff with no promise, expectation or scope line behind it.
4. **Which rejected ADR alternative does the code quietly take?** Where the implementation matches something the ADR's Alternatives Considered rejected.

The skip reasons and the files a promise depends on that the plan did not touch are asked before approval, of the plan, not of the code (see "Before approval" below).

Tell the reader to **write what would show each finding breaking, and no remedy**: a finding is a place and a claim, and `- breaks when:` states the condition under which it fails in use. The fix is yours to choose, not the reader's.

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
  - breaks when: <what would show it breaking>
  - answer: fix — <the impl item added>

## What does the diff change that no row touches?
- nothing

(…one `##` per question, in the order above, then the closing section…)

## What let these through?
- <cause> — findings: <refs> — highlight: <id>
```

The heading is the question's text, unnumbered. Under each heading: findings as `- <file>:<line> — <finding>` (a file and line wherever there is one), each with a `  - breaks when:` line the reader writes and an `  - answer:` line you write, or the single line `- nothing`. A heading with neither is an unanswered question; send the reader back. The closing `## What let these through?` section is yours, not a question.

## Before approval (`/audit {plan} --before-approval`)

The same reader, shape and answers, but run on a plan nobody has approved: the plan is read cold before the person is asked to sign it. The planner runs it before presenting a plan written by hand, and an unattended planning run does it as its last step (`plan-review`).

1. **Get the inputs.** `indusk plans review-inputs {plan}` prints JSON: `documents` (`brief`, `testPlan`, `adr`, `impl`, as they stand) and `tree` (every tracked file). Never `research.md` and never the conversation — they hold the decisions the reader must not inherit. The model is the same `audit` tier.
2. **Spawn the reader** with the inputs and these four questions, verbatim, each one `##` heading in `.indusk/planning/{plan}/plan-review.md` (they are `PLAN_REVIEW_QUESTIONS` in `lib/audit/answers.ts`):

   1. **Do the planned tests prove each promise's sentence, or something narrower?**
   2. **Does the impl build what each promise claims, and nothing it does not?**
   3. **Which skip reason would you not accept?**
   4. **What else would have to change for each promise to hold?**

   Findings are written as in `audit.md`, each with its `- breaks when:` line and no remedy; a question with nothing to say gets `- nothing`.
3. **Answer each finding yourself**, the planning agent, with one of: `  - answer: fix — <document changed>` (change the test plan, the ADR or the impl, and name which), `  - answer: amendment — <the part of the brief changed>` (edit the brief, and tell the person plainly — nothing is approved yet, so there is no re-approval to wait for, but it is theirs to see), or `  - answer: nothing — <reason>`. There is no `signal` answer before approval: no code exists to emit one.
4. **Run `indusk plans audit-answers {plan} --plan-review`** until it passes. It prints each dismissal and amendment answer; show them with the plan when you present it for approval, every one, so nothing waved away is hidden.

An unattended planning run ends at a stop that carries the same dismissals for the person.

## Skipping

A trivial plan (a typo, a changelog line) may skip the audit with both fields in the impl's frontmatter:

```yaml
audit: skipped
audit_reason: "a one-line copy change; a fresh reader would find nothing to question"
```

The reason is one sentence of at most 120 characters (`promise: a-skip-reason-is-one-sentence`); the detail goes in the impl body or the retrospective, and the retrospective refuses a longer one.

`/retrospective` Step 0 accepts the pair and refuses a bare `audit: skipped`. Under `gate_policy: ask`, ask the person before writing it.

## Output

By the time you hand off to `/falsify` (and, later, `/retrospective`), one of these must be true:

- `audit.md` exists in the plan folder, written by the reader in the shape above, every finding answered, and `indusk plans audit-answers {plan}` has passed and its dismissals been shown to the person.
- The impl's frontmatter contains `audit: skipped` + `audit_reason` with a real reason.

A fix is added to the plan like any discovered work; `/work` runs it before `/falsify` starts, in the plan's open build phase.
