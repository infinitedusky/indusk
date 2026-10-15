---
title: "One promise language"
date: 2026-10-15
status: proposed
---

# One promise language

## Goal

**Every word InDusk shows about a promise is upheld or broken — holding or broken when live, no signal when unknown — and every reader is ready for a signal that says `broken`, while the old words already written keep working.**

Today the admin's red chip says *violated*, an incident's promise reads
*known-violated* in its file and in every `pnpm test` summary, a promise nothing
has reported on reads *unverified* or *not seen*, and the docs call the
telemetry a *mark*. Worse, a signal that says `broken` is silently dropped by
the one parse every read goes through, so the settled word cannot be written
anywhere without the promise going dark.

## Y-Statement

**In the context of:**
InDusk's promises, whose words were settled with Sandy on 2026-10-15 (`promise-core`'s master, "The words" and "Signal, not mark"), shown in the admin, the command line, the editor, the docs and the skills, and carried in two stored values — the registry state `known-violated` and the signal outcome `violated` — that existing promise files and running applications already hold.

**Facing:**
a vocabulary spread over about 60 source files and 28 docs pages, two stored values that cannot simply be renamed because the registry refuses an unknown state and the signal parse drops an unknown outcome, the brief's clause that an application already instrumented must keep working, and recording servers in the field that run an InDusk older than this plan.

**We decided for:**
changing the words at every surface a person reads; renaming the registry state to `known-broken`, with `known-violated` read as it on load; one reading rule for a signal's outcome — `upheld` is upheld, `broken` and `violated` are broken — used by every reader, with the always-on server asking Jaeger for both values; and, for this release, InDusk's own signals, the demo app and the docs snippets still *writing* `violated`. The switch of writers to `broken` is the next release, carried by `.indusk/planning/mark-first/` (Sandy, 2026-10-15). "No signal" replaces unverified / not seen / no runs; "signal" replaces "mark" in what people read. Internal names (`violations`, `violationState`, `PROMISE_MARK`, `markPromise`, attribute and event names, JSON keys) stay.

**And against:**
relabelling only, keeping the stored state (a promise file and the test summary would still say violated); writing `broken` in this same release (a recording server older than this plan would read every such signal as no signal — version skew, rejected by Sandy); renaming the internal identifiers too (about 60 files of churn no reader sees, colliding with `plans-are-promises` and `mark-first`); rewriting old promise files to the new state; and rewriting history pages — changelog, decisions, lessons, strategy — which record what was said when.

**To achieve:**
one vocabulary in everything a person reads, every reader ready for either outcome word before any writer changes, the two must-not-break promises — a production break recorded unasked, and the thirty days counted only from what was seen — unchanged in behaviour, and a word list the next two plans can build on.

**Accepting:**
that for one release the attribute value InDusk writes is still `violated`, while everything people read says broken. Nobody reads the attribute value — it is read by programs, through the one rule — so the brief's promise, which is about what people read, holds. There is no version skew this release: no reader older than this plan ever meets `broken`.

**Because:**
the brief's promise is about what people read, and the smallest change that makes it true is the surfaces plus the state people see in files and summaries; teaching every reader both words first, and switching writers a release later in the plan that rewrites them anyway, makes the change safe for servers already deployed without a migration.

## Context

See `research.md` for the inventory: where each word lives, which values are
stored, and the finding that `parseMarkedSpan` (`lib/promises/telemetry.ts:235`)
drops a signal whose outcome is not exactly `upheld` or `violated`, and that the
always-on server queries Jaeger by the tag value `violated`
(`lib/always-on/pass.ts:138`). The brief (`brief.md`) holds the one promise,
`a-promise-is-upheld-or-broken`, and its three clauses. Sandy's answers on the
three open decisions are recorded in research, dated 2026-10-15.

## Decision

1. **Outcome values, read.** `PROMISE_OUTCOMES` becomes `["upheld", "broken"]`
   — the in-memory verdict. A new
   `readOutcome(value: unknown): PromiseOutcome | null` in
   `lib/promises/vocabulary.ts` maps `upheld` → `upheld`, `broken` and
   `violated` → `broken`, anything else → null. `parseMarkedSpan`,
   `testing/trace-shape.ts` and the always-on server's `violationsSince` use it;
   the server asks Jaeger once per value (`broken`, `violated`) and merges by
   span id.
2. **Outcome values, written.** Unchanged this release: `markPromise` and its
   four callers, the demo app and the docs snippets write `violated`.
   `markPromise` maps the in-memory `broken` to the attribute value `violated`
   at the one point it writes. `mark-first` switches that value to `broken`
   next release.
3. **Registry state.** `PROMISE_STATES` becomes `declared | enforced |
   known-broken | retired`. The registry parse maps a file's `known-violated` to
   `known-broken` before validating, silently. Opening an incident writes
   `known-broken`; closing the last one returns `known-violated` or
   `known-broken` to `enforced`.
4. **Words people read.** The admin's chip and timeline labels, health lines
   and plan-list warning; the CLI's status, watch, check and server messages and
   command help; the MCP tool descriptions; the editor's labels; the docs'
   guide and reference; the shipped skills; the planning rules template; the
   server's deploy files. Live chips say *holding* / *broken*; past cells *held*
   / *broke*; a state *upheld* / *broken*; the unknown *no signal*; the
   telemetry a *signal*. A docs snippet that sets the attribute keeps
   `"violated"`, with a line saying it is read as broken.
5. **A word scan** guards the result: a unit test reads those files and refuses
   *violated*, *violation*, *known-violated*, and *mark* in the promise sense,
   outside a short named list (attribute names, the attribute value `violated`
   in a snippet that sets it, and the sentence explaining it).

## Alternatives Considered

### Write `broken` in this release
Rejected by Sandy (2026-10-15): a recording server running an InDusk older
than this plan drops `broken`, so a promise would go dark there. Readers first,
writers next release in `mark-first`.

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
- No migration and no version skew: every existing file, signal and server
  keeps working.

### Negative
- For one release the attribute value written is `violated` while the code's
  verdict is `broken`; `markPromise` holds the one mapping until `mark-first`.
- Internal names (`violations`, `violationState`) disagree with the words
  shown; a reader of the code meets both.

### Risks
- **The writer switch is forgotten** — mitigated by its line in
  `.indusk/planning/mark-first/research.md` (carried from this plan, Sandy,
  2026-10-15).
- **A missed surface** — mitigated by the word scan, which fails on any new
  occurrence in the files people read.
- **The thirty days double-count** a run read under both words — ruled out:
  the window store is in memory, keyed after normalisation, and starts empty
  on restart; A13, a test-plan assertion that the thirty days count the same
  for either word, holds it.

## Documentation Plan

### Pages
- Update: `guide/promises.md` — the words table (upheld/broken, holding/broken,
  held/broke, no signal), "signal" for the telemetry; the snippet keeps writing
  `violated`, with a line that it is read as broken and that `broken` is read
  too.
- Update: `reference/cli/promises.md`, `guide/always-on.md`,
  `reference/cli/telemetry-server.md`, `reference/admin-ui/overview.md`,
  `reference/admin-ui/promise-page.md`, `guide/promises-in-your-editor.md`,
  `guide/plan-lifecycle.md`, and every other guide/reference page the scan
  names.

### Diagrams
- None new; the Mermaid labels in `guide/plan-lifecycle.md` change words only.

### Changelog
- "Promises speak one language: upheld or broken, holding or broken when live,
  no signal when unknown. Every reader accepts a signal saying `broken` as well
  as `violated`; writers keep `violated` this release. The registry state
  `known-violated` is now `known-broken`, and old files are still read."

### ADR in Docs
- Yes: `decisions/one-promise-language.md`.

## References
- `.indusk/planning/one-promise-language/research.md`, `brief.md`, `test-plan.md`
- `.indusk/planning/promise-core/master.md` — "The words", "Signal, not mark"
- `.indusk/planning/mark-first/research.md` — carries the writer switch
- `/decisions/day-promises` (the registry), `/decisions/day-monitor` (the
  signal attributes), `/decisions/promise-sources`
- Blocks: `.indusk/planning/plans-are-promises/`, `.indusk/planning/mark-first/`
