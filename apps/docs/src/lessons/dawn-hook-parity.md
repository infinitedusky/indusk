# Dawn Hook Parity — Lessons

Lessons from the `dawn-hook-parity` plan (2026-08-03): wiring InDusk's invariants and eval rail into the Dawn thin lane. Full history in the archive: `.indusk/planning/archive/dawn-hook-parity/`.

## A passing test can be the reason a bug survives

Two assertions guarded this plan's headline guarantee — *one commit per checklist item, each naming its item* — and both passed continuously while two real defects lived underneath them:

- The commit test drove the **itemwise** checkoff path. The shared test harness had a second mode that batched several checkoffs into one edit, and on that route the commit named one item of four, silently absorbing the rest.
- The commit-failure test used a hook that rejected **every** commit, so a failure was never followed by a success — exactly the sequence where the failed item's staged work gets absorbed into the next commit and misattributed.

Neither bug was found by the green suite. Both were found by a deliberate falsification pass an hour later.

**The rule:** when a guarantee can be reached by more than one route — batched vs one-at-a-time, fail-then-succeed vs fail-always, first-run vs retry, empty vs populated — a test that walks one route is evidence about *that route only*. The dangerous case isn't an untested feature; it's a tested feature whose fixture happens to take the safe path. Enumerate the routes before trusting the guarantee.

## Durability promises must name what they survive

The queue drain wrote its "done" ledger entry *before* spawning each evaluator — deliberately, so a drain that crashed mid-record would leave a logged gap rather than double-evaluating. Correct reasoning, and it created the opposite disaster: an evaluator that cleanly exits non-zero (no CLI, broken runner) also left the record marked done. A machine that could evaluate nothing marked the whole backlog processed, wrote zero scorecards, and emptied the queue that existed to protect exactly that case. Health went quiet, because the queue was empty.

"Crash-safe" and "failure-safe" are different properties. Write durability claims as *durable against X*, then list the other failure modes explicitly — clean non-zero exit, timeout, partial write, permission error — and say what happens to the record in each.

The fix generalizes: a **provisional ledger** — write the done-marker before the risky operation (crash-safety), retract it on a clean failure (failure-safety). At-most-once under crash, at-least-once under retry.

## When work can't be un-done, fix the record, not the past

The natural fix for "a failed commit's work gets absorbed into the next commit" is to unstage it. That's impossible: `git reset` unstages, but the change is still in the working tree — it was never committed — and deleting it would destroy real work to protect a bookkeeping property.

The defect was never staging; it was **misattribution**. So the remedy is carry-forward: the commit that actually carries the work names it. The hypothesis was refuted while being fixed, and the assertion moved from *contains only its own work* to *whatever it contains, its message accounts for* — the achievable invariant.

## Separate error channels, not just severities

A commit failure must not stop a run (bookkeeping); a gate refusal must (enforcement). That asymmetry was designed in. What wasn't: the queue append shared the git calls' `try`, so a queue-write failure was reported as a *commit* failure — the run claiming that history which exists doesn't. Different failure kinds need different channels, not just different severities, or the report lies in a direction nobody thought to check.

## Deferrals work when they're written where the ritual will find them

Phase 1 knowingly left duplicated test helpers behind, with a note in the checklist item: *"loop.test.ts keeps its local copies for the cleanup ritual to converge."* Six phases later the cleanup ritual found that note and removed ~232 duplicated lines. The close-out rituals are a real backlog rather than decoration — but only for debt recorded in the plan, not remembered.
