---
title: "One promise language"
date: 2026-10-15
status: complete
workflow: feature
---

# One promise language — Research

## Question

Where does InDusk show people the words *violated*, *violation*, *known-violated*,
*unverified*, *not seen* and *mark* for a promise, which of those are stored
values that old files and running applications still carry, and what is the
smallest change that makes every word a person reads one of the settled words
(`promise-core`'s master, "The words" and "Signal, not mark")?

## Background

The settled vocabulary (Sandy, 2026-10-15):

| Use | Word |
|---|---|
| A state — a dot, a record | **upheld** / **broken** |
| Right now — a live page | **holding** / **broken** |
| What happened | **held** / **broke** |
| Nothing has reported | **no signal** (never shown as holding) |
| The telemetry behind a clause | its **signal** (not "mark") |

Never *failed*, *passed* or *violated* of a promise. Tests still pass and fail;
only promises change words.

Today three vocabularies mix: the admin already says *held*/*broken* in the
thirty-day counts (`lib/promises/standing.ts`), its chips say *violated* /
*upheld* / *unverified* / *known-violated*, a signal's outcome attribute is
`upheld`/`violated`, and the registry's state is `known-violated`.

## Findings

Counts are lines from `git grep` on `plan/one-promise-language` (2026-10-15),
excluding tests unless stated.

### (a) Words shown to people

**Admin (`apps/indusk-admin/src`)** — 9 files carry `violat`; the strings a
person sees:

- `components/bars/labels.ts` — the state chip `known-violated` (label + aria),
  the health chips `violated` / "violated in the window" (red), "violated in the
  window, every incident fixed" (fixed), `upheld` / "seen upheld in the window"
  (green), `unverified` / "not seen in the window", and `known-violated` /
  "declared known-violated" (amber). 8 lines.
- `components/PromiseTimeline.tsx` — cell titles "violated — unfixed",
  "violated — fixed", "upheld", "no runs".
- `lib/timeline-strip.ts:166` — "violated {n} ago — open".
- `components/PromiseHealth.tsx:66,77` — "N violation(s)", "not seen".
- `components/PlanList.tsx:304-305` — "holds a promise violated in the window".
- `components/Promises.tsx:371`, `components/promise/PromiseProof.tsx:51,100,106,196`
  — "not seen yet"; "no run of it has been marked in any source".
- `components/plan/PlanParts.tsx:35` — a class map keyed `known-violated`
  (identifier, follows the state rename).

**CLI and MCP tools (`apps/indusk-mcp/src`)**:

- `lib/promises/status.ts:56-67` — "no violations in …", "N violation(s) in …",
  "not seen upheld in …".
- `lib/promises/watch.ts:177` — "No new violations — nothing recorded."
- `lib/promises/check.ts:85,206,236` — the summary line every `pnpm test`
  prints (`… known-violated 0 …`) and two refusals naming `known-violated`.
- `lib/promises/incidents.ts:212` — an incident's default symptom "The span
  marked the promise violated and carried no symptom." (written into incident
  files people read).
- `lib/always-on/heartbeat.ts:178,184`, `schedule.ts:33` — server messages
  "Promise violations … are not being heard", "Violations marked in that time".
- `bin/cli.ts:504,663,1283,1293,1327,1329` — command help.
- `tools/promise-tools.ts:173,224` — MCP tool descriptions (agents read these).
- `bin/commands/run.ts:142` — "a gamed gate, not a passed one" is about gates,
  not promises: out of scope.

**VS Code extension (`apps/vscode-extension/src`)**:
`core/view.ts:16,35-36` — "known violated", "not seen"; `core/activity.ts:52`
already says *broke*/*held* but reads the outcome `violated`.

**Docs (`apps/docs/src`)** — `violat` in 28 guide/reference pages (top:
`reference/cli/promises.md` 26, `guide/always-on.md` 20, `guide/promises.md` 18,
`guide/plan-lifecycle.md` 17, `reference/cli/telemetry-server.md` 9,
`reference/admin-ui/overview.md` 7); *mark* in the promise sense in about 20
(top: `reference/cli/promises.md` 24, `guide/promises.md` 11,
`reference/admin-ui/overview.md` 10, `reference/cli/looks.md` 9). History pages
— `changelog.md` (27), `decisions/*` (24), `lessons/*` (13), `strategy/*` (5) —
record what was said when, and are not rewritten.

**Skills and the planning template** — `skills/catchup.md` 11, `falsify.md`,
`planner.md`, `verify.md` 1 each; `templates/planning/CLAUDE.md:140` ("each such
commit is marked a violation of `a-plan-is-written-on-its-own-branch`");
`hooks/check-gates.js` 3; `templates/server/fly.toml` 3, `Dockerfile` 1
(comments in files a person deploys).

### (b) Stored values

**The registry state `known-violated`.** One tuple
(`lib/promises/vocabulary.ts:27`, `PROMISE_STATES`); one writer
(`incidents.ts:232`, opening an incident on an enforced promise); readers in
`incidents.ts:283` (closing the last incident), `health.ts:504` (amber chip),
`standing.ts:196`, `check.ts:230`, `proof.ts`. `registry.ts:241` **refuses** a
file whose state is not in the tuple, so a rename without an alias would make
every existing `known-violated` file unreadable. Dusk's own registry holds
**0** such files today (142 enforced, 6 declared, 1 retired); other projects'
registries may hold some, and `incidents/i-2026-10-03-every-commit-evaluated.md`
mentions the word in prose.

**The signal's outcome value `indusk.promise.outcome = upheld | violated`.**

- *Writers*: one function, `markPromise` (`lib/promises/mark.ts`), with four
  callers — the evaluator (`eval/otel.ts`), the recorder (`record.ts`), the
  trunk-commit signal (`trunk-commit.ts`), the looks check (`looks/report.ts`);
  plus the demo app's own writer (`examples/seat-holds/src/telemetry.ts`) and
  the snippets people copy (`guide/promises.md:162-168`, `guide/always-on.md:131`,
  `examples/seat-holds/README.md`).
- *Readers*: `telemetry.ts:235` (`parseMarkedSpan`, the one parse every Jaeger
  read goes through) **drops a span whose outcome is not exactly `upheld` or
  `violated`** — a signal written `broken` today is silently discarded, read as
  no signal. `always-on/pass.ts:138` asks Jaeger by tag
  `{indusk.promise.outcome: "violated"}`, so the server's announcements would
  never see `broken`. `testing/trace-shape.ts:125,152` (the helper applications'
  tests use) compares to the literals. Downstream of the parse, the in-memory
  value is compared in `store.ts:292`, `health.ts`, `look-standing.ts:113`,
  `proof.ts:275`, `standing.ts:246`, the admin's `timeline-strip.ts:70,153` and
  the editor's `activity.ts:52`; `PROMISE_OUTCOMES` (`vocabulary.ts:136`) is the
  one tuple.
- *Persistence*: the window store (`store.ts`) is in memory only, keyed
  `${traceId}|${at}|${outcome}`; it starts empty on restart, so normalising the
  word at the parse cannot double-count a run. The recorder's heard record
  (`heard.ts`) stores no outcome word.

### (c) Internal identifiers that need not change

Attribute and event names (`indusk.promise`, `indusk.promise.outcome`,
`indusk.promise.violated`, `indusk.promise.symptom`) — the brief keeps them.
Field and function names: `violations`, `lastUpheld`, `violationState`,
`recordViolations`, `PROMISE_MARK`, `markPromise`, `MarkedSpan`, the
`PromiseHealth` keys `red`/`green`/`unverified`/`amber`, JSON keys in `--json`
output. Nobody reads these as words about a promise; renaming them is churn
across about 60 files with no reader helped.

## Decisions

All three are **the planning agent's recommendation**, for Sandy at approval.

- **Rename the registry state `known-violated` to `known-broken`, and keep
  reading the old one.** The state is printed by `pnpm test`'s summary, shown
  on a chip and written into promise files people open, so it is a word people
  read, not only a stored value. The registry parse maps `known-violated` to
  `known-broken` on read; nothing rewrites old files (closing the last incident
  returns the promise to `enforced` anyway, which removes the old word).
  Rejected: keeping the stored value and relabelling only — the file and the
  test summary would still say violated.
- **InDusk's own signals write `broken`; every reader accepts both `broken`
  and `violated` as broken.** The brief's promise says every *signal* says
  broken, and its first clause ("the old word is still read") only has work to
  do if a new word is written. One function decides what an outcome value means
  (both old and new words), used by the Jaeger parse, the server's announcement
  query (which asks for both values), and the test helper. The in-memory
  outcome becomes `upheld | broken`, so the CLI's `--json` output and the
  editor carry the new word. Rejected: keep writing `violated` — smallest code
  change, but the promise would be false of InDusk's own signals.
- **History pages keep their words.** The changelog, decisions, lessons and
  strategy pages say what was true when written; this plan changes the pages
  people use today (guide, reference), the skills, the planning template and
  every surface in the apps.

## Open Questions

- **Version skew**: an application writing `broken` read by an InDusk older
  than this plan (or a recording server running an older image) is read as no
  signal. The server image is published with each release, and InDusk's own
  writers change in the same release as the readers, so InDusk's own signals
  are safe; an application that copies the new docs snippet before upgrading
  its server is not. The docs snippet can say so. Sandy may prefer that
  applications keep writing `violated` until the next release cycle.
- Whether `indusk promises check` should note a `known-violated` file it read
  (a one-line nudge) or read it silently. Recommended: silently — the state
  disappears on its own when the incident closes.

## Sources

- `.indusk/planning/promise-core/master.md` — "The words", "Signal, not mark".
- `.indusk/planning/one-promise-language/brief.md`.
- `apps/indusk-mcp/src/lib/promises/{vocabulary,mark,telemetry,registry,incidents,check,status,watch,store}.ts`,
  `apps/indusk-mcp/src/lib/always-on/pass.ts`, `apps/indusk-admin/src/components/bars/labels.ts`,
  `apps/vscode-extension/src/core/view.ts`.
