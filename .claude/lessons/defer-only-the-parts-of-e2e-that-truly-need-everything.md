# Don't defer the whole end-to-end row to the last build phase just because the full scenario needs everything — a thinner real-input version is often writable much earlier

In day-always-on, A21 (the full end-to-end test) was deferred to the last build phase with the justification "needs everything at once" — server, pass, remote source, and health tool together. But the bug it eventually caught (deployment.environment read from the wrong tag — see [[test-fixtures-can-agree-with-the-bug]]) existed from Build Phase 3 and shipped through three phases of fully green unit tests before A21 finally ran.

Why it matters: "the full scenario needs everything" is true, but it doesn't mean *no* real-input test is writable earlier. A thinner version — one process using the real OpenTelemetry SDK sending a span to the server — was writable as early as Build Phase 1, as soon as the server existed. Deferring the *only* test in the plan that uses foreign/real-client input to the very end means the protocol boundary is unverified for the whole plan, not just until A21 lands — every earlier phase's "green" was cheaper than it looked.

What to do instead: when a full end-to-end scenario is deferred because it needs multiple components integrated, ask separately whether a narrower slice of it — specifically, whichever part exercises a real client library or a boundary you don't control — can run standalone, earlier. Author that thin slice at the earliest phase where its dependency exists, even if the full A-numbered end-to-end row stays deferred to the end.

See `.indusk/planning/archive/day-always-on/retrospective.md`.
