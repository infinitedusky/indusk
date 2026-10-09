# A trajectory row whose Asserts joins two claims with "and" tends to get only the first one tested

In the incident-recording plan (.indusk/planning/incident-recording/), A15's Asserts column claimed two things: "`worktree create` on an archived plan with an open Maintenance phase creates its worktree and records the assignment" AND "`list_plans` and the admin read the plan from it." Only the first half was tested; the second was false — the plan-copies resolver read the trunk's archived folder and listed the worktree as unassigned, undetected until Build Phase 7 discovered it by hand.

Why: writing a trajectory row's Asserts as a conjunction makes it easy to author a test for the first clause and feel the row is covered, while the second clause silently has no assertion.

How to apply: when a trajectory row's Asserts contains "and" joining two distinct claims, either split it into two rows or verify the test file has a separate assertion block for each clause before marking the row as covered.
