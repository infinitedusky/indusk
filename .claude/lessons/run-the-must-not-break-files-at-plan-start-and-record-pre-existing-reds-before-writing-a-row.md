# Run the must-not-break files at plan start and record any already red before writing a row, not at phase close or landing

In approval-waits-for-the-planning-run, cockpit-nav.test.tsx (a must-not-break file for decisions-wait-in-one-place, 19 of 19 red) and DecisionCard.test.tsx (older cases red) were red on render timing in the main checkout before the plan began. They surfaced only at Build Phase 2's close and again at landing. Each time cost a round trip, and the plan ended up landing with a must-not-break promise already red and no baseline list to compare against.

Rule: at Test Phase 1, run every must-not-break file the brief names and write the exact failing tests into the impl Notes as the baseline. Then "no regression" at close is a comparison against a list, not a memory. If a must-not-break file is red on main, say so at plan start; the person decides whether to fix it first.

Pointer: .indusk/planning/approval-waits-for-the-planning-run/retrospective.md "What We'd Do Differently"; impl.md Notes (Build Phase 2). (highlight h-20261019-024)
