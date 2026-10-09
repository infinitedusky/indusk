# Writing a plain-language explanation of a feature can surface a bug the tests already passed on — reread the promise's own words, not just the test's assertions

incident-recording's break-inbox hook (Build Phase 3) passed its tests marking a break "delivered" project-wide — the first session to take any turn after the break consumed it, and every other already-running session in the same project silently never heard it. The unit and hook-level tests at the time only ever ran one session, so nothing caught it.

The bug was found writing apps/docs/src/guide/multi-agent.md: putting the mechanism into one plain sentence ("every live session in the project hears each break once, on its next turn") forced a re-read against the promise it serves, `a-break-reaches-the-working-agent` — which says "the working agent" (every running session), not "whichever session gets there first." The mismatch was only visible once the behavior was restated in the promise's own language, not the test's.

Fixed in c9a04edb: delivery marks became `{ id, session }` instead of bare `{ id }`, with an absent `session` field in old records counting as delivered-to-everyone (the "schema gains a field, absence is a rule not a migration" pattern already in this registry). A18 gained the second-session case as a direct regression test.

Applies generally: when authoring a Document gate item for a promise or contract, restate the behavior in the promise's own words before writing the prose, and treat a mismatch between "what the tests check" and "what the promise says" as a bug to fix, not a wording problem to paper over. Document-writing is a second, independent check on a claim that's already green — not busywork after the real work is done.
