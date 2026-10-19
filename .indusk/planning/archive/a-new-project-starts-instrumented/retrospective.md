---
title: "Init sets up telemetry (New Projects)"
date: 2026-10-17
---

# Init sets up telemetry (New Projects) — Retrospective

## What We Set Out to Do

The second child of [telemetry-from-day-one](../../telemetry-from-day-one/master.md).
`indusk init` on Homework Gate's workbench had written its instrumentation at the
workbench root, where no app runs, under the service name `unknown-service`, sending
to the console or to port 4318, which the daemon no longer holds. No span said which
project or environment it came from, and an app had no way to write a promise's signal
except two attributes typed by hand. The skills sent people to a vendor.

The brief made three promises: a scaffolded project reports to the local daemon from its
first run, named and placed, with no file edited by hand; it writes its signals from a
small helper it owns, in the package's one vocabulary; and what `init` prints and the
skills teach is true. The ADR chose one scaffold module behind `init` and `update`, a
settings file each app owns (rendered with the daemon's stored address), a record of
what InDusk wrote so an edited file gets the newer template beside it, and a
hand-written helper in TypeScript and Python pinned to the vocabulary by a test.

## What Actually Happened

All of it shipped in one day (2026-10-17) on one branch: a test phase, three build
phases, a falsification phase (Build Phase 4) and an audit-fix phase (Build Phase 5);
cleanup was skipped with its reason. The diff against the merge base is 76 files,
+3,809 / −674, in 101 commits. Thirty-one trajectory rows, all passing; T11, the
manual live check on a fresh Next.js app, put the project's service in the local
Jaeger with project and `development` on its spans.

Three things went further than the brief named, each written in the ADR or the impl
as it happened:

- **An app with its own OpenTelemetry setup gets only the helper** (ADR decision 9).
  The brief's first promise covers every scaffolded project; this exception means such
  apps carry no project or environment attribute on their own spans.
- **A deleted scaffolded file stays deleted** (Build Phase 4). The brief's limit clause
  spoke of edits; deleting is the same choice by its owner.
- **The shared span reader learned `indusk.clause`.** The brief gave reading to
  mark-first. The helper's round-trip test needed it, so the reader returns the field
  and does nothing else with it.

## Getting to Done

**Falsification found five ways a real app would have reported nothing** — all from
reading, none from the live check, which used the one shape of Next.js app that hides
them. A `create-next-app --src-dir` project never loads a root `instrumentation.ts`.
The helper imports `@opentelemetry/api`, which pnpm's strict layout will not resolve as
a peer. The Python run line told people to use `opentelemetry-instrument`, whose own
provider sends to the standard port as `unknown_service` before the scaffolded one
runs. An environment value like `100%` threw a `URIError` at import and stopped the app
from starting. And a file a person deleted came back on every update with the install
lines reprinted. Each became a row (T25–T29) and a fix.

**The cold audit found the one the builder could not see.** Running `init` on a fresh
copy of the demo printed "you changed `src/telemetry-settings.ts`" for a file nobody
touched. The record held a hash of the exact text, and InDusk's own Biome config, which
`init` installs into the same project, reflows the settings line past 100 characters.
From the first format on, every update would have written the newer version beside the
file, so a daemon address reset would never reach an app. Build Phase 5 made the record
a layout-blind fingerprint (T30, T31). It also closes another audit finding: `indusk
demo` copied under a folder other than `seat-holds` kept the demo's project id, so the
readers dropped its signals; now `init` refreshes the settings file and renders the
copy's own id.

**The close found three things the gates had let through.** The retrospective's
readiness check passed the plan's promises as proven, and then `indusk promises
confirm` refused 19 times. Every test file carried `clause: <promise>/<clause>` but
not the bare `promise: <name>` that confirm also reads, two rows (T27 and T31) named a
clause their file never named, and the two state promises had no code carrying their
token. Those tokens were added at close (the vocabulary's app signal keys and the
scaffold's printed guidance became the code sites). Separately, this plan's own impl had
stopped validating: one Build Phase 4 Shape task carried code on its line, which the
phase-summary rule refuses. And the plan's root context line pushed the root past its
held budget; the daemon entry, already stated in full in `apps/indusk-mcp/CLAUDE.md`,
was cut to a pointer to make room.

**Most audit findings were not acted on at first.** The audit raised about 25 concerns;
Build Phase 5 took one (two counting the demo copy). After the first close, Build Phase 6
fixed three more (the decline's name, the demo's `local` environment, the health check's
package), and the first promise's sentence was amended to what was built: a Next.js
server needs no hand edit, every other app needs the one line `init` prints. Sandy
re-approves that amendment. The rest are carried below.
Nothing yet answers each concern one by one; that is the job of the plan
[audit-concerns-are-answered](../../audit-concerns-are-answered/brief.md).

## What We Learned

- **A scaffold that installs a formatter must survive that formatter.** InDusk wrote
  both the Biome config and a file Biome reflows, and tracked the file by exact bytes.
  Any record of generated files that a person's tools touch needs to compare structure,
  not bytes.
- **A live check on the default shape of a framework proves only the default shape.**
  T11, the live check, passed on a root-layout Next.js app; the `src/` layout, the pnpm
  peer import and the Python wrapper were each a "reports nothing" failure it could not
  see. The falsification checklist should ask for each non-default layout the framework's
  own generator offers.
- **A test that searches every written file for a string proves the string is
  somewhere, not that the code uses it.** The audit showed T3 (service named in code) and
  T7 (project and environment on every span) pass even if a template stopped passing the
  settings to its SDK, because the settings file always contains both strings.

## What We'd Do Differently

- **Run `init` on the demo copy, then the formatter, before the live check.** The
  formatter defect was visible from InDusk's own repo the moment the demo was
  formatted; it reached the audit only because nobody re-ran `init` on a formatted tree.
- **Assert on what each setup file passes, not on the joined text.** T3 and T7 should
  read each runtime's setup file for the settings field it hands its SDK.
- **Match a declined telemetry recommendation by meaning, or fix its name in the
  prompt.** `disableDeclinedTelemetry` matches only a recommendation named exactly
  `telemetry`; the new-project agent's prompt lets it pick any name.

## Insights Worth Carrying Forward

Carried, not done — the audit's open findings that touch a promise, for whoever picks
them up (mark-first, production-is-heard, or a bugfix plan):

- **Wiring the other runtimes itself** (Node's `--import`, Python's import line, the
  Next.js browser half) is a feature for its own plan; the promise now says they need one line.
- **Weak rows:** T3, T7 (see above); T13 writes value, bound, plan and phase but asserts
  none of them; the Python test-run marker has no test; T16 plants the `src/index.ts`
  it checks for; T17 bans five vendor names.
- **Unrowed behaviour:** `update` swallows a scaffold error and still succeeds (an
  unreadable `.indusk/scaffold.json` quietly stops every refresh); a `.indusk-new` file
  is rewritten and announced on every update until the edited file matches.
- **Homework Gate's first expectation is unobserved.** It is measured the day Homework
  Gate's code repo gets its app.

## Quality Ratchet

No Biome rule would have caught this plan's defects: they were placement, package
resolution and record-matching mistakes, not lint. No rule added.

Shape findings: 7 raised (Test Phase 1: 2, Build Phase 1: 2, Build Phase 2: 2, Build
Phase 3: 0, Build Phase 4: 1, Build Phase 5: 0), 0 judged wrong by a human.

## Metrics

- Sessions spent: 1 day, several sessions
- Files touched: 76
- Lines added/removed: +3,809 / −674
- Trajectory rows: 31, all passing (one manual live check)
- Defects found after the build: 5 by falsification, 4 acted on from the audit (Build Phases 5 and 6), one promise sentence amended
- `pnpm test` at close: 3 failures. Two were this plan's (its root context line over the held root budget; its own impl refused by the plan-task rule), both fixed. The third, `looks-admin-approvals-hold` A11, is the trunk failure current.md already records. The impl-corpus check's other refusal, `archive/nav-row-legible`, is also on trunk.
- Nested-context probe (`pnpm e2e`): context-tiers passed. `day-monitor` A24 failed, and it fails on trunk too: it waits for `promises status` to print "1 violation", which has printed "1 break" since one-promise-language.

Landed on main at 40571937, 2026-10-17. Installed with `pnpm install:local` (indusk 1.71.0); nothing published, since this project publishes when the operator decides.
