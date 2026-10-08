# Record a live check in the last phase that changes its subject, and typecheck every package a phase touches

A live check's output is only true as of the commit it was recorded against. If a later phase changes the thing the live check verified, the recorded output goes stale and nothing re-runs it — the check reads as passing while the underlying rule is actually broken on the machine.

Why: small-fixes (2026-10-08) recorded A1's live check (`indusk ui status`) in Build Phase 1. Build Phase 3 then changed the daemon identity rule the live check depends on (A17, the `ps`-command-line → start-time rewrite). Nothing re-ran A1 after that change, so the identity rule was silently broken on the actual running machine until the falsification phase (Build Phase 5) read real `ps` output and caught it. The fix wasn't a bug in A17's logic — it was recording the live check too early, in a phase that didn't own the final shape of what it verified.

Companion finding from the same plan: the admin app's `tsc` stayed red for two phases because only the mcp package was typechecked during that stretch — a phase that touches multiple packages needs to typecheck all of them, not just the one it mainly worked in.

How to apply: when authoring a Test Trajectory row for a live check, set its "Passes at" phase to the *last* phase in the plan that changes the subject the live check verifies, not the first phase that makes it checkable. If a later phase edits that subject again, re-run the live check there too — don't assume an earlier recorded pass still holds. And when a build phase touches files across more than one package/app, run that phase's verification across every touched package's typecheck, not just one.
