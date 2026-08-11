# A passing test proves the route it walks — enumerate a guarantee's other routes before trusting it

In dawn-hook-parity, two assertions guarding the plan's headline guarantee ("one commit per checklist item, each naming its item") passed continuously while two real defects lived underneath them:

- The commit test drove the *itemwise* checkoff path; the shared test harness had a second mode that batched several checkoffs into one edit — and on that route the commit named 1 of 4 items, silently absorbing the rest.
- The commit-failure test used a hook that rejected EVERY commit, so a failed commit was never followed by a successful one — exactly the sequence where the failed item's staged work got absorbed into the next commit and misattributed.

Both bugs were found by a deliberate falsification pass, not by the green suite.

**The rule:** when a guarantee can be reached by more than one route — batched vs one-at-a-time, fail-then-succeed vs fail-always, first-time vs retry, empty vs populated — a test that walks one route is evidence about *that route only*. Before trusting a guarantee, enumerate its routes explicitly and ask which ones the fixtures actually take. The dangerous case isn't an untested feature; it's a tested feature whose test happens to take the safe path.

