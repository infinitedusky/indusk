---
title: "Dawn Hook Parity — Retrospective"
date: 2026-08-03
status: completed
---

# Dawn Hook Parity — Retrospective

## What We Set Out to Do

Close the gap that made the Dawn thin lane a second-class citizen: `atdawn run` enforced only 2 of 5 InDusk hooks, made **zero git commits**, never fired the eval agent, and ran `gate_policy: auto` by contract. A lane that never fires the evaluator cannot teach the system anything — which destroys the one job the thin harness has left, being the control group. Four moves (brief + ADR): wire the budget hook, port the commit cadence, build an eval rail that works without Claude Code, and make headless `ask` a real pause. Plus one deliberate shed.

## What Actually Happened

Six phases, 22 commits, 31 files, +2319/−375. Twelve new files; three consumer-facing files touched.

The four planned moves landed as designed, and the design held up under attack better than the *tests* did:

- **Phase 1** wired `claude-md-budget.js` into the gate chain — chain membership was genuinely the whole wiring, as predicted, because the script self-filters by basename. Research had already corrected the master's hook inventory (5 on disk, not 6 — `check-plan-order.js` died in the context-beam cleanup).
- **Phase 2** put commits in the loop's hands rather than the model's, on a new `onGatedApply` seam so the gate module stayed rule-free.
- **Phase 3** built the queue and its drain, reusing `eval-trigger.js`'s existing CLI mode — the half of the design that already existed and made the whole thing cheap.
- **Phase 4** turned `check-gates`' ask-mode refusal into a pause, entirely loop-side, so the shared hook (and its JS-port twin) never had to change.
- **Phase 5 (falsification) confirmed all four hypotheses as real defects** — see below.
- **Phase 6 (cleanup)** paid a debt Phase 1 had explicitly deferred and split the hook's two jobs.

**Falsification was the phase that earned its keep.** Every hypothesis was real:

- A batched checkoff named **1 of 4** items; the other three rode along unnamed.
- A failed commit left its work staged, and the next commit silently absorbed it — **2 checkoffs in one commit**, misattributed.
- A drain whose evaluator can't run marked every record drained, wrote no scorecard, and **silently destroyed the backlog** — the exact loss the queue exists to prevent.
- Five landed commits were reported as commit failures because the queue append shared the git calls' `try`.

And the ritual's own hypothesis got refuted mid-fix (A11): "unstage and the next commit contains only its own work" is impossible — `git reset` can't un-*write* the working tree, and destroying that work would be worse than mis-naming it. The defect was misattribution, not staging. The fix carries attribution forward; the assertion moved to *whatever a commit contains, its message accounts for*, with the reversal recorded in three places rather than quietly edited.

## Getting to Done

- **A2 and A5 passed the whole time while hiding two real bugs.** A2 only exercised the itemwise checkoff path — the shared harness's *other* mode took the broken one. A5's always-reject hook could never produce the failure-then-success sequence that exposes misattribution. Passing tests, adjacent to the happy path, guarding the plan's headline guarantee.
- **The env-parity lesson written that same morning paid off within hours.** 13 of 16 initial full-suite "failures" were the fresh worktree missing gitignored build artifacts; the fix was `pnpm build` in indusk-mcp *then* indusk-admin plus `bundle-admin.js`, not a diagnosis.
- **Test infra tipped over twice for the same honest reason** — this plan grew the gate chain 2→3 scripts, adding a spawn per edit, and several real-git integration tests outgrew vitest's 5s default. Raised deliberately with the cause in-comment.
- **A vacuous-green caught at authoring**: A3's first draft asserted "one record per commit" when both sides were zero. Hardened with an explicit `> 0` guard before it could pass for the wrong reason.
- **An unexplained incident, recorded not chased**: uncommitted work vanished into a `git stash` and reappeared minutes later, apparently a concurrent eval-agent session stashing the worktree around its evaluation. Flagged as a highlight; named as a falsification candidate; **not investigated** — it's a rail-integrity question, not a hook-parity one.
- `indusk worktree create` still fails outside workbench mode; worked around with plain `git worktree add`.

## What We Learned

- **A test that passes can still be the reason a bug survives.** Two of four falsification defects lived directly under passing assertions whose fixtures happened to take the safe path. When a guarantee has multiple routes (batched vs itemwise, fail-then-succeed vs fail-always), a test that walks one route is evidence about *that route only*.
- **Durability promises must name what they survive.** "Ledger-before-spawn so a crash never double-evaluates" is crash-safety. It says nothing about evaluator *failure* — and the unguarded gap silently destroyed the whole backlog. Every durability claim should be read as "durable against *what*, exactly?"
- **Bookkeeping and enforcement need different failure semantics, and mixing their error channels lies.** A commit failure must not stop a run; a queue-append failure must not be reported as a commit failure. Sharing one `try` made the report claim history that existed didn't exist.
- **Classifying another program's refusal beats modifying it.** Recognizing `check-gates`' ask-mode refusal loop-side kept the shared hook and its JS port untouched, dodging this repo's standing mirror-port maintenance trap.
- **Extraction from a distributed artifact needs its copy path verified first.** The drain module was only safe to lift because `globSync("*.js")` on both init and update copies `_`-prefixed files — verified in code and guarded by a test that loads the hook from a *copied* directory, not the source tree.

## What We'd Do Differently

- **Write the second route's test at the same time as the first.** A2 and A5 should have covered batched checkoff and fail-then-succeed on day one; falsification found in an hour what an extra fixture would have caught at authoring.
- **Arm the parity tripwire before the ritual writes the row.** A14 worked precisely because it existed *before* the extraction. That should be the default shape for any refactor phase, not a thing the cleanup ritual reasons its way into.
- **Don't let a ritual rationalize a `Writable at`.** The cleanup ritual wrote A14 as Phase 6 with a rationale claiming its subjects wouldn't compile — false on inspection. The rationale field is exactly where a rubber stamp hides; read it as an adversary would.
- **Chase the recorded anomaly or say plainly it's out of scope.** The eval-stash incident was flagged and named a falsification candidate, then not investigated. Both are defensible; drifting between them isn't.

## Insights Worth Carrying Forward

- The **provisional-ledger** pattern — write the "done" marker before the risky operation for crash-safety, then *retract it* on a clean failure — generalizes to any at-most-once queue that must also be at-least-once under retry.
- **Carry-forward attribution** beats destructive correction: when work can't be un-done, make the record account for it rather than trying to restore a cleaner past.
- Deferring a known duplication to the cleanup ritual **worked** — Phase 1's note ("loop.test.ts keeps its local copies for the cleanup ritual to converge") was honored six phases later and removed ~232 lines. The rituals are a real backlog, not decoration, if the deferral is written down where the ritual will find it.
- Recorded sheds (`gate-reminder`) and recorded leave-as-is decisions (cross-language `readJsonl`) are worth as much as the changes — the next reader knows they were considered, not missed.
