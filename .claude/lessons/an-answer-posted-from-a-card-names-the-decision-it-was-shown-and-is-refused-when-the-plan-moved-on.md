# An answer posted from a card names the decision the card showed, and is refused if the plan now waits on something else

In approval-waits-for-the-planning-run, the decision route re-read what the plan waits on and applied a bare "accept". A plan-review card left on screen (hidden tab pausing LiveRefresh, or the agent finishing inside the refresh gap) could be answered after the review became answered. The plan then waited on approval, so Accept ran approvePlan and merged documents the person never approved. Falsification found it (A22).

Rule: any card that posts an answer posts the kind of decision it displayed (`on`), and the server refuses before anything runs when the plan's current wait differs. Never let an unnamed "accept" resolve against current state. Accepting an absent `on` (older clients) skips the check, so keep the card as the only poster and send it every time.

Pointer: .indusk/planning/approval-waits-for-the-planning-run/impl.md Build Phase 3; apps/indusk-admin/CLAUDE.md entry "A decision's card is read again..."; guard A22 in apps/indusk-admin/src/lib/decisions.test.ts. (highlight h-20261019-022)
