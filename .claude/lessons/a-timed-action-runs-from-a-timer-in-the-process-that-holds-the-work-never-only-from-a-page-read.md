# An action that must happen at a time is driven by a timer in the process that holds the work; a read path is only the catch-up

If a plan says a thing happens "after N minutes" (a question goes ahead on its recommendation), find what actually fires it. In decisions-as-questions the sweep ran only inside the admin's readWaiting, so a timed question went ahead only when someone rendered the page; with nobody looking it waited forever, holding a session slot. The team believed timers ran; they ran on page render (h-20261020-002).

Why it matters: a promise worded in time ("goes ahead after five minutes") is broken by any path that depends on a reader being present, and the happy-path row (open the page, see it go ahead) passes.

How to apply: for each time-based promise, name the process that holds the work and put the timer there (clear it when the work ends); keep the read path only as a catch-up for a restart or a dead process, driven by a stored deadline. Write a row that never reads the page. Re-arm waits longer than the timer API allows (about 24 days) instead of firing early. Source: .indusk/planning/decisions-as-questions/ (Build Phase 8, T28). Related: a-plan-with-states-lists-how-each-transition-can-fail-and-gives-each-a-row-or-a-signal.
