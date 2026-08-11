# An ADR that settles a value's format but not its frame of reference reads as decided and isn't — check base path, encoding, timezone, or units too

The dawn-verify ADR carefully litigated the `Test` trajectory column's FORMAT — "files, not test names or line numbers" — and rejected runner-output parsing on maxim-7 grounds. It never said what the paths are **relative to**. In a monorepo, that gap meant `verify` resolved paths from the repo root while the plan's own trajectory rows used package-relative paths — the author's most natural choice — and every reference silently resolved to nothing.

The gap survived the ADR review, the test plan, five implementation phases, and 33 passing tests. It cost 16 false red-test findings, and the authoring plan's own trajectory violated the convention it had just documented. Nobody caught it earlier because a decided format doesn't *look* incomplete — the ADR has a clear ruling, a rationale, and rejected alternatives. The frame of reference was just never in scope of the question anyone asked.

**Hindsight rule:** when an ADR settles a format for a value that will be resolved, joined, or interpreted later, explicitly check that it also settles the format's frame of reference — base path (repo-root vs package-relative), encoding, timezone, or units. A half-specified decision is more dangerous than an openly-deferred one, because an open question gets revisited and a decided-looking one doesn't.

Related: [[declaration-names-are-path-join-boundary-values]] (a different angle on path-join boundaries — that one is about sanitizing untrusted input before a join, this one is about an ADR never naming which base a path is relative to in the first place).
