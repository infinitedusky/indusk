---
title: "Brief as the contract — Retrospective"
date: 2026-10-13
status: complete
---

# Brief as the contract — Retrospective

## What We Set Out to Do

Make the brief the one document a person writes and approves: looks named in it
and owned by the plan, approval recorded against the brief, a change to what was
agreed stopping the build until a person re-approves it, the plan page showing
the brief's promises, expectations and looks, and a plan that starts as a
conversation held outside the repository and is named at the end (ADR decisions
1–10, ten promises).

## What Actually Happened

All ten promises shipped and are confirmed by passing rows. The plan ran Test
Phase 1, five build phases, then three more it did not plan: a falsification
phase (Build Phase 6, six hypotheses, all confirmed and fixed), a cleanup phase
(Build Phase 7, ~3,000 lines of a plan-page tree the new page no longer used, one
plan lookup for three routes) and an audit-fix phase (Build Phase 8, four holes a
cold reader found). 218 commits; 253 files changed, +13,948/−3,885 (165 source
files, +8,588/−3,658).

Reality diverged from the ADR in three places, each on Sandy's word during the
last day:

- **The brief has its own page.** ADR decision 7 put the parts and the agent on
  the plan page. Working it live, Sandy split them: the brief page is where a
  plan is written (the brief's parts and the brief on the left, the agent in a
  window-tall column on the right that follows what it writes); the plan page is
  where it is followed, opening with a one-to-three-sentence `description:` and
  the brief's state ("incomplete — work on it" as the current step).
- **Planning sessions ask almost nothing.** The planning session asked before
  every write (admin-plan-authoring's A4). Sandy asked for bypass; falsification
  (A26) showed bypass let a draft's agent write into the repository, which breaks
  `a-conversation-that-is-not-kept-leaves-nothing-in-the-repository`. The landed
  rule is a build's: inside the session's own folder, unasked; outside it, the
  person decides.
- **A draft's looks are names, not drawings.** A draft lives outside the
  repository and mockups live in it, so a draft's agent cannot draw a look; the
  brief page's agent can. A17 (the live check) was run on a brief page and
  approved on that basis.

## Getting to Done

- **Pages took 40–80 s.** `LiveRefresh` probed with a HEAD to the page (a full
  render) and then refreshed it (a second one), ticks overlapped, and every
  render re-read the archive (2.1 s, twice per page). Fixed by probing
  `/api/sessions`, skipping a tick while a refresh renders, and caching the
  archive on file mtimes (the first cut keyed on folder mtimes and was stale on
  an in-place edit; falsification A29 caught it).
- **The dev server served stale CSS** after a restart, so two rounds of "the
  column is wrong" were the old stylesheet. Measured in headless Chromium before
  changing anything further.
- **An admin planning session merged `main` into another plan's branch unasked**
  (demo-scenarios). Undone on Sandy's word with a revert commit; a hook refused
  `reset --hard` and `--amend`, rightly.
- **My own splice bug**: the script that appended Build Phase 8 matched the
  string `## Files Affected` inside A34's row text and inserted the phase there.
  The subagent repaired it; no assertion moved.
- The audit found four real holes the plan's own rows missed: workbench plans
  skipped every looks check, the Files Affected check dropped cells with a note
  or two paths, the amendment gate could be skipped with a marker or by deleting
  `approved_brief:`, and drafts were deleted rather than archived.

## What We Learned

- **A cold reader finds what falsification by the builder does not.** Falsify
  hunted the last day's changes and found six; the audit, reading only the
  approved documents and the diff, found four more in phases falsify chose not
  to revisit — including a whole mode (workbench) that skipped the plan's gates.
- **A gate whose switch lives in the file it guards is not a gate.** The
  amendment check ran only while the impl carried `approved_brief:`, and impl
  edits wait for nobody — so one edit turned it off.
- **Measure before re-styling.** Two layout rounds chased a stale stylesheet;
  one headless measurement (column widths, top, bottom) settled it.
- **A design approved as text changes when a person uses it.** The brief page,
  the description and the agent column all came from Sandy using the page, not
  from the ADR.

## What We'd Do Differently

- Use the page earlier: a live session on day one of Build Phase 4 would have
  moved the agent to the brief page before the mockups were drawn and approved
  three times.
- Run the audit's question 6 ("what else would have to change") against workbench
  mode at ADR time; every gate in this plan had a workbench branch nobody tested.
- Never insert into a document at the first match of a heading string; anchor on
  the line.

## Insights Worth Carrying Forward

- Keep falsification and the audit both: they find different things.
- Every new gate gets a row asking how it is switched off, and by whom.
- A planning agent's boundary is its folder; prompts are for leaving it.

## Shape

Shape raised 8 findings across the phases (contract.ts, approve.ts,
amendments.ts, plan-parts-view.ts, page.tsx, drafts/store.ts, the plan page's
stale header comment, accept's `pb` parameter) and recorded 7 files considered
and left as-is. A human judged none of them wrong (0). Not a second consecutive
plan with wrong findings.

## Follow-up

The view cleanup Sandy named, and the audit's findings not fixed here (an
agent can run `plans reapprove` / `plans start --from-draft` from a terminal;
`a-plan-builds-only-after-approval`'s new clause has no row; the plan page
rewrite dropped the Papers section, the type chip and the falsification and
skipped-ritual details without the brief saying so; a draft's agent cannot draw
a look) — a new plan's brief, written after this one lands.

## Checks at close

- Nested-context probe (`vitest --config vitest.e2e.config.ts context-tiers`): 4/4 passing.
- `day-monitor.e2e.test.ts` A24 fails here and identically on main (it expects the evaluator's error text "issue with the selected model", which the current model does not produce) — not this plan's.
- `indusk promises confirm`: ten promises enforced; `a-plan-builds-only-after-approval` re-changed to its brief sentence. The registry check then caught an approved plan (`cockpit-audit-fixes`) refused by the Looks rule after A34; fixed in Build Phase 8 as A37 before landing.

Landed on main at a31a0742, 2026-10-13. Installed locally (`pnpm install:local`, indusk 1.70.0); nothing published — publishing is deliberate (`indusk release`).
