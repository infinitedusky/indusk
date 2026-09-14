---
title: "InDusk Makeover — Retrospective"
date: 2026-09-14
status: complete
---

# InDusk Makeover — Retrospective

Written seven weeks after the impl completed, as part of the 2026-09-14
sequence reconciliation. The delay is itself a finding and is recorded below.

## What We Set Out to Do

Every session paid a fixed context tax before any work happened: roughly
120k tokens of CLAUDE.md, another 55k for catchup, plus MCP schemas. The
brief's answer was to make InDusk's value explicit, the rituals and the
curated artifacts they produce, and cut everything else, with a budget that
keeps it cut. Five moves: a 60 KB hard budget on CLAUDE.md enforced at write
time with a compaction ritual behind it; decay for `current.md` and dead
drafts; removal of Graphiti and CodeGraphContext entirely, with the
highlight-to-eval rail retargeted at lessons; a catchup diet; and hub
push/pull so rules travel between projects. The ADR is
[adr.md](adr.md) and its decisions page is `/decisions/indusk-makeover`.

## What Actually Happened

All of it shipped, in nine phases: a Phase 0 of baseline measurement scripts
as red tripwires, six build phases, a falsification phase and a cleanup
phase. Nineteen trajectory rows, all passing; 79 of 79 checklist items. The
measured outcome that mattered, catchup, went from about 55k tokens to about
8.2k, and the CLAUDE.md budget hook has held the file under 60 KB through
every retrospective since.

Falsification found three defects by reading, all fixed in Phase 7:

- The budget hook predicted an Edit's result with `String.replace`, whose
  `$`-substitution in the replacement string diverges from the Edit tool's
  literal semantics. Replaced with an index splice. This became a Known
  Gotcha and a lesson.
- `list_plans { active: true }` omitted plans whose impl was `completed`,
  which is exactly the state of a plan awaiting its close-out rituals. A
  completed plan still inside `planning/` is active by definition; only
  archival removes it. Registered `completed` with the active-status set.
- The plan's own gates script discarded stderr and counted an empty stream as
  zero findings. A classifier that cannot run now fails the gate rather than
  passing it.

Cleanup extracted the one genuine repeat the plan introduced, the legacy MCP
server removal loop that `init` and `update` each carried, into
`lib/mcp-migration.ts`, and left the init/update monoliths as they were with
reasons recorded.

## Getting to Done

The impl completed on 2026-07-23 and the close-out did not happen until
2026-09-14. Nothing blocked it. The plan sat in the root master's "close-outs
and the small queue" with the note "owes its retrospective, any time", and
"any time" is when it happened: never, until a deliberate pass through every
folder outside the sequence forced a fate on each one. Two of its own
mechanisms could not help. `archive-dead` only takes all-draft plans, and
this one's accepted brief protected it. The `completed` status that Phase 7
made visible in `list_plans` kept it on the active list, correctly, for seven
weeks.

One item the CLAUDE.md entry carried as open, that `guide/getting-started.md`
still advertised the removed CodeGraphContext and Graphiti tools, had already
been fixed by a later plan; the note outlived the problem.

## Step 4a: the two deferred rows

Both deferred rows named a mitigation, and only one of them was honored.

- **U1, compressed CLAUDE.md effectiveness.** Mitigation: "a scheduled
  2-week review grepping new-session mistakes against archived entries." No
  such review was scheduled or run. What did happen is the intended
  mechanism working without the review: every retrospective since has run the
  compaction step, and the file has stayed under budget with no repeat bug
  traced to a compressed entry. The mitigation as written was aspirational;
  the mitigation that exists is the per-close compaction step.
- **U2, quota burn drops proportionally.** Mitigation: before/after
  comparison of sessions per limit window, plus user reports. No comparison
  was recorded. The user reports are the only evidence, and they say the tax
  dropped. Unverified as a number.

Neither row is reopened. Both mitigations are rewritten in the impl to say
what actually holds them.

## What We Learned

- **A close-out with no deadline and no blocker never happens.** "Any time"
  is a fate, not a schedule. The reconciliation that finally closed this plan
  should be a standing step, not a one-off.
- **A completed impl is active.** The fix for `list_plans` was right and it
  also proves the point: the tool showed this plan as owing its close-out for
  seven weeks and nothing acted on that. Visibility is not a trigger.
- **A mitigation that names a cadence needs an owner and an arrival point.**
  U1's two-week review had neither, which is the lesson already on file from
  another plan, applied to this one.
- **Predicting an edit with `String.replace` is a silent divergence.** Known
  Gotcha and lesson, carried forward.

## What We'd Do Differently

- Write the retrospective in the same session the impl completes, or in the
  next one, and let the ritual gate refuse a plan that has sat `completed`
  for more than a week without one.
- Give every deferred row's mitigation a concrete arrival point in the impl
  that will act on it, or do not defer.

## Insights Worth Carrying Forward

The plan's rules are in CLAUDE.md as conventions: the 60 KB budget, the
decay layer, the hub push/pull, the dieted catchup, the eval rail materializing
lessons. The Edit-prediction gotcha and the status-registration rule are
lessons in the registry. No lessons page was created; the durable insights
were already published in `/decisions/indusk-makeover` and the registry at the
time.

## Quality Ratchet

No new Biome rule. Shape did not exist when this plan ran (it arrived with
lifecycle-rebalance on 2026-08-10), so the Shape count is not applicable
rather than zero.

## Metrics

- Sessions spent: not recomputed at this distance
- Phases: 9 (baseline, six build, falsification, cleanup)
- Trajectory rows: 19 passing, 2 deferred
- Checklist: 79 of 79
- Falsification defects: 3 found, 3 fixed
- Catchup cost: ~55k → ~8.2k tokens (measured at the time)
- Days from impl complete to retrospective: 53
