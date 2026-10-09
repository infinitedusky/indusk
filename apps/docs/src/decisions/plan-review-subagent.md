# Audit Step — a Fresh Reader Before a Plan Closes

**Decided 2026-10-09.** Full ADR: `.indusk/planning/archive/plan-review-subagent/adr.md`.

## What was decided

Every close-out ritual before this one, falsification and cleanup included, is run by the agent that built the plan, so it shares that agent's blind spots. The audit adds one reading by someone who has not seen the session. It runs after `/cleanup` and before `/retrospective`, and it is called `audit`:

- **The skill spawns the reader.** [`/audit`](/reference/skills/audit) asks `indusk plans model <plan> --step audit` for the model, spawns an Agent on it (or on the session's model when no tier is set), and hands it six fixed questions. The reader writes `audit.md` in the plan folder in a fixed shape.
- **The package supplies the inputs and the gate.** [`indusk plans audit-inputs`](/reference/cli/plans) prints the brief, test plan, ADR, the impl as it was merged at approval (found by the approval commit's subject, read with `git show`), the trajectory as it stands, and the branch's diff without `.indusk/`. It also gives a `stat` of the files the plan changed and a `tree` of every tracked file. `checkRetrospectiveReadiness` gains `audit` in `missing`, satisfied by `audit.md` existing or by `audit: skipped` plus `audit_reason`.
- **It runs everywhere a plan is closed.** `plans next` answers `audit`, `next-session` names `/audit <plan>`, the build runner runs it as a step, and the plan bar has an `audit` position between `cleanup` and `review`.
- **It is advisory.** No gate reads what `audit.md` says.

## Tradeoffs accepted

- **No parser.** The impl "without the builder's findings" is the impl at the approval merge, which git already holds, so no parser cuts falsification and cleanup out of the current impl. A rewritten history loses the merge, and `--approved <sha>` names it by hand.
- **Not a phase.** A phase appended to the impl would be written by the builder's hand and would block. The audit is a separate document.
- **Not called `review`.** The person's acceptance view already owns that word.
- **The spawn is checked live, not tested.** A package cannot call Claude Code's Agent tool, so whether the spawn honours the model was observed once (A9).
- **Some of the builder's work still reaches the reader.** The brief, test plan and ADR are read as they stand, not as approved. The trajectory also carries rows that falsification and cleanup added. Closing that is a follow-on recorded in the master plan.

## What its first run found

The plan's own audit, run on itself, found two defects that falsification and cleanup had missed:

- The impl validator hook's step list lacked `audit`, so setting the audit tier would have refused impl edits.
- The plan bar ignored a missing audit, so the admin offered Accept before the audit had run.

Both were fixed before close. The finding that only a fresh reader could reach came from comparing `tree` with `stat`: the files the plan never touched that its promises depend on.
