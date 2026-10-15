---
title: "One promise language"
date: 2026-10-15
status: proposed
---

# One promise language

## Goal

**Every word InDusk shows about a promise is upheld or broken — holding or broken when live, no signal when unknown — and the old words already written keep working.**

Today the admin's red chip says *violated*, an incident's promise reads
*known-violated* in its file and in every `pnpm test` summary, a promise nothing
has reported on reads *unverified* or *not seen*, and the docs call the
telemetry a *mark*. Worse, a signal that says `broken` is silently dropped by
the one parse every read goes through, so the settled word cannot be written
today without the promise going dark.

## Y-Statement

**In the context of:**
InDusk's promises, whose words were settled with Sandy on 2026-10-15 (`promise-core`'s master, "The words" and "Signal, not mark"), shown in the admin, the command line, the editor, the docs and the skills, and carried in two stored values — the registry state `known-violated` and the signal outcome `violated` — that existing promise files and running applications already hold.

**Facing:**
a vocabulary spread over about 60 source files and 28 docs pages, two stored values that cannot simply be renamed because the registry refuses an unknown state and the signal parse drops an unknown outcome, and the brief's clause that an application already instrumented must keep working.

**We decided for:**
changing the words at every surface a person reads, and the two stored values with the old ones still read: the registry state becomes `known-broken`, with `known-violated` read as it on load; InDusk's own signals write `broken`, and one function in the promise vocabulary decides what an outcome value means — `upheld` is upheld, `broken` and `violated` are broken — used by the Jaeger parse, the always-on server's query (which asks for both values) and the test helper applications use; "no signal" replaces unverified / not seen / no runs; "signal" replaces "mark" in what people read. Internal names (`violations`, `violationState`, `PROMISE_MARK`, `markPromise`, attribute and event names, JSON keys) stay.

**And against:**
relabelling only, keeping both stored values (a promise file and the test summary would still say violated, and the brief's promise names records and signals); renaming the internal identifiers too (about 60 files of churn that no reader sees, raising merge conflicts with the two plans that follow); rewriting old promise files to the new state (a write nobody asked for, in projects this plan does not own); and rewriting history pages — changelog, decisions, lessons, strategy — which record what was said when.

**To achieve:**
one vocabulary in everything a person reads, a signal written either way read as the same verdict, the two must-not-break promises — a production break recorded unasked, and the thirty days counted only from what was seen — unchanged in behaviour, and a word list the next two plans (`plans-are-promises`, `mark-first`) can build on.

**Accepting:**
version skew: an application that writes `broken` while its recording server still runs an InDusk older than this plan is read as no signal there. InDusk's own writers change in the same release as its readers and the server image ships with each release, so only an application that adopts the new docs snippet before upgrading its server is exposed; the snippet says so.

**Because:**
the brief's promise is about what people read, and the smallest change that makes it true is the surfaces plus the two values people actually see in files and summaries; reading both words at one decision point keeps every existing signal and file working without a migration, and leaving internal names alone keeps the plan a rename and not a refactor.

## Context

See `research.md` for the inventory: where each word lives, which values are
stored, and the finding that `parseMarkedSpan` (`lib/promises/telemetry.ts:235`)
drops a signal whose outcome is not exactly `upheld` or `violated`, and that the
always-on server queries Jaeger by the tag value `violated`
(`lib/always-on/pass.ts:138`). The brief (`brief.md`) holds the one promise,
`a-promise-is-upheld-or-broken`, and its three clauses.

## Decision

1. **Outcome values.** `PROMISE_OUTCOMES` becomes `["upheld", "broken"]`. A new
   `readOutcome(value: unknown): PromiseOutcome | null` in
   `lib/promises/vocabulary.ts` maps `upheld` → `upheld`, `broken` and
   `violated` → `broken`, anything else → null. `parseMarkedSpan`,
   `testing/trace-shape.ts` and the always-on server's `violationsSince` use it;
   the server asks Jaeger once per value (`broken`, `violated`) and merges by
   span id. `markPromise` writes `broken`; its callers pass `broken`. The demo
   app and the docs snippets write `broken`.
2. **Registry state.** `PROMISE_STATES` becomes `declared | enforced |
   known-broken | retired`. The registry parse maps a file's `known-violated` to
   `known-broken` before validating, silently. Opening an incident writes
   `known-broken`; closing the last one returns `known-violated` or
   `known-broken` to `enforced`.
3. **Words people read.** The admin's chip and timeline labels, health lines
   and plan-list warning; the CLI's status, watch, check and server messages and
   command help; the MCP tool descriptions; the editor's labels; the docs'
   guide and reference; the shipped skills; the planning rules template; the
   server's deploy files. Live chips say *holding* / *broken*; past cells *held*
   / *broke*; a state *upheld* / *broken*; the unknown *no signal*; the
   telemetry a *signal*.
4. **A word scan** guards the result: a unit test reads those files and refuses
   *violated*, *violation*, *known-violated*, and *mark* in the promise sense,
   outside a short named list (attribute names; the history pages).

## Alternatives Considered

### Keep writing `violated`; only accept `broken` on read
The smallest code change and no version skew. Rejected: the brief's promise says
every signal says broken, and InDusk's own signals would not.

### Relabel the state only, keep `known-violated` stored
Rejected: the promise file and the `pnpm test` summary line would still print
*known-violated*; both are records people read.

### Rename every identifier
Rejected: no reader is helped, and about 60 files of churn would collide with
`plans-are-promises` and `mark-first`, which touch the same modules next.

### Rewrite old `known-violated` files on read or in a migration
Rejected: a write in projects this plan does not own; the state disappears on
its own when the incident is fixed.

## Consequences

### Positive
- One vocabulary everywhere a person reads; the next plans inherit it.
- A signal written `broken` is no longer silently dropped.
- No migration: every existing file and signal keeps working.

### Negative
- Code holds two words for one outcome at the boundary, permanently.
- Internal names (`violations`, `violationState`) now disagree with the words
  shown; a reader of the code meets both.

### Risks
- **Version skew** (see Accepting) — mitigated by shipping readers and writers
  in one release and a note beside the docs snippet.
- **A missed surface** — mitigated by the word scan, which fails on any new
  occurrence in the files people read.
- **The thirty days double-count** a run read under both words — ruled out:
  the window store is in memory, keyed after normalisation, and starts empty
  on restart; A13 holds it.

## Documentation Plan

### Pages
- Update: `guide/promises.md` — the words table (upheld/broken, holding/broken,
  held/broke, no signal), "signal" for the telemetry, the snippet writing
  `broken` with the skew note.
- Update: `reference/cli/promises.md`, `guide/always-on.md`,
  `reference/cli/telemetry-server.md`, `reference/admin-ui/overview.md`,
  `reference/admin-ui/promise-page.md`, `guide/promises-in-your-editor.md`,
  `guide/plan-lifecycle.md`, and every other guide/reference page the scan
  names.

### Diagrams
- None new; the Mermaid labels in `guide/plan-lifecycle.md` change words only.

### Changelog
- "Promises speak one language: upheld or broken, holding or broken when live,
  no signal when unknown. Signals write `broken` and `violated` is still read;
  the registry state `known-violated` is now `known-broken`, and old files are
  still read."

### ADR in Docs
- Yes: `decisions/one-promise-language.md`.

## References
- `.indusk/planning/one-promise-language/research.md`, `brief.md`, `test-plan.md`
- `.indusk/planning/promise-core/master.md` — "The words", "Signal, not mark"
- `/decisions/day-promises` (the registry), `/decisions/day-monitor` (the
  signal attributes), `/decisions/promise-sources`
- Blocks: `.indusk/planning/plans-are-promises/`, `.indusk/planning/mark-first/`
