# A promise that produces a sentence needs at least one row driven from a real record on disk — rows that feed hand-built inputs to pure functions never cover the real end states

The a-run-can-be-trusted audit (audit.md, highlight h-20261019-033) found that the situation and next-step rows (A65–A71) fed hand-built inputs to pure functions. No row covered real end states: a planning run that ended normally and was then approved read "Stopped — ready-for-approval" (situation.ts:156); the nav row built without confirmations told the person "everything is confirmed" while the page listed open signals (next-step.ts:59); an empty confirmation list from a swallowed read error read "Everything it promised is confirmed" (PlanStatusCard.tsx:55).

Rule: when a promise is about words the system shows, give it at least one row that builds a real record or plan folder on disk, reads it through the production reader, and asserts the sentence. Pure-function rows pin the table; they cannot find an input the author never built. A swallowed read error must not render as the empty (good) state.

See .indusk/planning/a-run-can-be-trusted/audit.md. Related: a-clause-signal-reads-a-source-independent-of-the-code-it-judges.
