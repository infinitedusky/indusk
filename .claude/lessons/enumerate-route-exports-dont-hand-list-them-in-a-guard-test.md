# A test asserting "every route is guarded" should enumerate the route modules and every handler they export, not a hand-written list

A hand list of routes in a guard-coverage test silently drifts as routes are added — the list in admin-plan-authoring's A34 missed two GET handlers (sessions, plans/build) because nobody updated it when those routes were written. `admin-hosts.test.ts` fixed this by reading the route modules' exports programmatically and comparing against the directory listing, so a new handler is covered automatically or the test fails loudly.

Applies to any "X holds for every Y" test where Y is an enumerable set the codebase already defines (route handlers, exported commands, registered hooks) — derive the set from the code, never re-type it.
