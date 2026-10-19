# Never call a red test pre-existing from an old note or a loaded run; re-run it on main, and update the older tests your own fix outdated

This corrects the premise of the lesson run-the-must-not-break-files-at-plan-start-and-record-pre-existing-reds-before-writing-a-row, which says the reds in approval-waits-for-the-planning-run were on main before the plan. They were not. Both files pass on main (26 of 26, quiet machine). cockpit-nav.test.tsx was red only under machine load. DecisionCard.test.tsx had three older cases red because this plan's falsification fix made every posted answer carry `on`, and those cases still expected the old body. The plan recorded "pre-existing, not this plan's" in its Build Phase 2 notes and retrospective from a loaded run and carried it to landing; `plans land` refused it. Fix: three cases now expect `on: "question"`.

Rules:
1. Before calling a failure pre-existing, re-run that file on main on a quiet machine. A note from an earlier session, or a run under load, is not evidence.
2. A red in a file your diff touches is yours until shown otherwise. When a fix changes a shared contract (here the posted body), update every older test that pinned the old shape in the same commit.
3. Record the must-not-break baseline at Test Phase 1 as exact results, so close is a comparison against a list.

Pointer: .indusk/planning/approval-waits-for-the-planning-run/retrospective.md "Correction (2026-10-19, by hand)".
