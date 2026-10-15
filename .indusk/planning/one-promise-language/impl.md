---
title: "One promise language"
date: 2026-10-15
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "958e42c0874fe4ae6c0d9dfc541d7a5d5a81f28c882c0a7ca714484d7fe8d766"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-15T19:26:41.174Z"
---

# One promise language

## Goal

Every word InDusk shows about a promise says upheld or broken — holding or
broken when live, no signal when unknown — and the telemetry behind it is its
signal. Every reader is ready for a signal saying `broken`, and the two old
words already written keep working: a signal saying `violated` is read as
broken, and a promise file saying `known-violated` is read as `known-broken`.
InDusk's own signals and the demo app keep writing `violated` this release;
`.indusk/planning/mark-first/` switches them to `broken` next release (Sandy,
2026-10-15). See `adr.md`.

## Scope

### In Scope
- One decision point for what a signal's outcome means (`upheld`; `broken` or `violated` = broken), used by every reader; the always-on server asking Jaeger for both values.
- The registry state `known-violated` renamed `known-broken`, the old one read on load.
- The words in the admin, the CLI and its help, the MCP tool descriptions, the editor, the docs' guide and reference, the shipped skills, the planning rules template and the server's deploy files.
- A word scan that keeps them right.

### Out of Scope
- Attribute and event names (`indusk.promise.*`, `indusk.promise.violated`) — the brief keeps them.
- Internal identifiers (`violations`, `violationState`, `PROMISE_MARK`, `markPromise`, JSON keys, the `PromiseHealth` keys).
- History pages: `apps/docs/src/changelog.md` entries already written, `decisions/*`, `lessons/*`, `strategy/*`.
- Rewriting existing `known-violated` files.
- Switching InDusk's signal writers and the demo app to write `broken` — carried by `.indusk/planning/mark-first/`, next release (Sandy, 2026-10-15).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the thirteen tests, red where the fault is | the test plan |
| Build Phase 1 | `readOutcome`; `PROMISE_OUTCOMES = upheld \| broken`; `PROMISE_STATES` with `known-broken` and the load alias; writers still sending `violated` through one mapping in `markPromise`; the server asking for both values | `lib/promises/vocabulary.ts`, `telemetry.ts`, `registry.ts`, `incidents.ts`, `mark.ts`, `always-on/pass.ts`, `testing/trace-shape.ts` |
| Build Phase 2 | the admin's, CLI's, MCP tools' and editor's words | Build Phase 1's two values |
| Build Phase 3 | the docs, skills, template and deploy files in the new words; the word scan green | Build Phases 1–2 |
| Build Phase 4 | the editor's input on the old word this release; retired, broke — fixed and no signal in the editor and admin; the suite's line and the helper's messages in the new words; a wider scan | Build Phases 1–3 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A signal saying `broken` is read as broken by status, health, timeline, looks standing and the trace-shape helper | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/outcome-words.test.ts |
| A2 | A signal saying `violated` is still read as broken everywhere A1 names | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/outcome-words.test.ts |
| A3 | InDusk's own signals (evaluator, recorder, trunk commit, looks check) and the demo app write `upheld` or `violated` this release, and every reader reads `broken` as broken | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/signal-writers.test.ts, examples/seat-holds/src/seats.test.ts |
| A4 | A promise file saying `known-violated` is read as known-broken by the registry check, the admin and the editor | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/known-broken.test.ts |
| A5 | Opening an incident on an enforced promise writes `known-broken`; fixing the last open one returns `known-broken` or `known-violated` to enforced | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/known-broken.test.ts |
| A6 | The admin's chips, timeline cells, health lines and plan-list warning say upheld, holding, broken, held, broke or no signal — never violated, violation, unverified, not seen or no runs | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-admin/src/components/PromiseWords.test.tsx |
| A7 | A promise nothing has reported on reads no signal in the admin, the CLI and the editor, never green or holding | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-admin/src/components/PromiseWords.test.tsx, apps/indusk-mcp/src/__tests__/promises-cli-words.test.ts, apps/vscode-extension/src/core/view-words.test.ts |
| A8 | The CLI's promise status, watch, check summary and refusals, and the always-on server's messages say broken, held or no signal, never violated or violation | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/__tests__/promises-cli-words.test.ts |
| A9 | The editor's labels say known broken and no signal, and its activity says held or broke for a signal written either way | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/vscode-extension/src/core/view-words.test.ts, apps/vscode-extension/src/core/activity.test.ts |
| A10 | The docs' guide and reference, the skills, the planning template, the deploy files, the CLI help and the MCP tool descriptions carry no violated, violation or known-violated, and say signal, not mark, outside named attribute names | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/__tests__/promise-words.test.ts |
| A11 | A production signal saying `broken` becomes an incident with its owning plan reopened, exactly as a `violated` one does | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-production-break-is-recorded-unasked, promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/record-broken.test.ts |
| A12 | The always-on server announces a production signal saying `broken` exactly as one saying `violated` | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-production-break-is-recorded-unasked, promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/always-on/announce-broken.test.ts |
| A13 | The thirty days count held, broken and neither the same way for signals saying `broken`, `violated` or a mix | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-thirty-days-say-only-what-was-seen, promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/standing.test.ts |
| A14 | An editor installed before this plan still reads a broken run in `indusk promises health --json` as broke: the line's runs carry `violated` this release, for a signal written either way | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/outcome-words.test.ts |
| A15 | The editor shows a retired promise as retired, never holding or in the ok tone; a promise that broke and was fixed as broke — fixed; and an empty activity section as no signal | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-promise-is-upheld-or-broken | apps/vscode-extension/src/core/view-words.test.ts, apps/vscode-extension/src/core/activity.test.ts |
| A16 | The admin's dashboard row and the promise page's thirty-day legend say no signal where nothing has reported, never never seen or nothing seen | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-admin/src/components/PromiseWords.test.tsx |
| A17 | The everyday-suite signal still writes `violated` this release, and the line it prints says broken and signal, never violated or marked | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/__tests__/suite-speed.test.ts |
| A18 | The trace-shape helper's failure messages say broken, never violated | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/lib/promises/outcome-words.test.ts |
| A19 | The word scan also reads the extension skills and the `docker/` image and Fly files, and refuses mark in any promise sense (production marks, a promise's mark, sends marks, what has been marked) | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/__tests__/promise-words.test.ts |
| A20 | No page people read says InDusk's own signals or the demo's are written `broken` this release | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-promise-is-upheld-or-broken | apps/indusk-mcp/src/__tests__/promise-words.test.ts |

## Checklist

### Test Phase 1: Write every test first, failing where the old words are

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

Before any code changes, this phase writes the tests that say what people will read about a promise once the plan is done. They check that a signal reporting a promise broken with the new word is read as broken everywhere InDusk reads signals, that InDusk's own signals and the demo app still send the old word this release so that recording servers already deployed keep reading them, that a promise file in the old known-violated state is read as known broken, that the admin, the command line and the editor say holding, broken, held, broke and no signal, and that the docs and skills no longer say violated or call the telemetry a mark. Most fail today: a signal saying broken is silently dropped, and the old words are everywhere. One passes from the start and guards the promise that already-instrumented applications keep working: a signal saying violated is read as broken. The next phase changes the two stored words.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  `indusk worktree create one-promise-language`, or `indusk worktree assign one-promise-language /Users/the_dusky/code/sandbox/dusk-worktrees/one-promise-language` for the one `plans start` made — worktree-per-plan default.

  </details>
- [x] Write the tests that a signal is read the same whether it says broken or violated, and that the thirty days count both alike.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/outcome-words.test.ts`: build Jaeger-shaped spans with `indusk.promise.outcome` set to `broken` and to `violated` (as `__tests__/helpers/local-jaeger.ts` builds tags) and feed them to `parseMarkedSpan`, `asMarkedSpans`, the look standing's newest-outcome rule and `lib/testing/trace-shape.ts`'s checks. A1: a `broken` span is parsed, counted among the promise's breaks and makes the look standing `broken` (red today: `parseMarkedSpan` returns null). A2: the same with `violated` (green today). A13 in `standing.test.ts`: `dayCounts`/`thirtyDaysOf` over the window built from a `broken`, a `violated` and a mixed set give the same held/broke days (red today on `broken`).

  </details>
- [x] Write the tests that InDusk's own signals and the demo app still send upheld or violated this release, and that what they send is read back as broken.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/signal-writers.test.ts`: call `markPromise` on a fake span (`setAttribute`/`addEvent` recorders) through each caller's path — the evaluator's outcome (`eval/otel.ts`), the recorder (`record.ts`), the trunk-commit signal (`trunk-commit.ts` on a non-merge commit), the looks report (`looks/report.ts`) — passing the in-memory verdict `broken` on a break, and assert the outcome attribute written is `violated` (never `broken` this release) and that `readOutcome` of what was written is `broken`. `examples/seat-holds/src/seats.test.ts`: a late release's attribute value is `violated`, and a span carrying `broken` instead is read as broken by `parseMarkedSpan`. Red today: callers cannot pass `broken`, and `readOutcome` does not exist (write the calls against `parseMarkedSpan` where `readOutcome` is not yet exported, so the file loads). Switching the asserted value to `broken` is `mark-first`'s.

  </details>
- [x] Write the tests that a promise in the old known-violated state is read as known broken, and that incidents move promises in and out of it.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/known-broken.test.ts`, on a temp registry built with `__tests__/helpers/promises-fixture.ts`. A4: a file with `state: known-violated` and an open incident loads with state `known-broken`, the registry check's rules accept it, its health is amber, the admin's chip label is `known broken` (`PROMISE_STATE_CHIP`, `PROMISE_HEALTH_CHIP.amber`) and the editor's label is `known broken` (`apps/vscode-extension/src/core/view.ts`). A5: opening an incident on an enforced promise writes `state: known-broken` into the file; fixing the last open incident returns a `known-broken` file and a `known-violated` file each to `enforced`. Red today.

  </details>
- [x] Write the tests that a production signal saying broken is recorded and announced as a violated one is.
  <details><summary>Technical</summary>

  A11, `apps/indusk-mcp/src/lib/promises/record-broken.test.ts`: the recorder's pass (`record.ts`, with its reads injected as `record.test.ts` does) over production marks saying `broken` opens the incident and reopens the owner, matching the run over `violated`. A12, `apps/indusk-mcp/src/lib/always-on/announce-broken.test.ts`: `violationsSince` against a stubbed `fetch` (`vi.stubGlobal`) whose fake Jaeger answers each `/api/traces` query only with spans whose outcome matches the `tags` asked for, holding one `broken` and one `violated` span; both are returned. Red today: the server asks only for `violated`, and the parse drops `broken`.

  </details>
- [x] Write the tests that the admin, the command line and the editor say holding, broken, held, broke and no signal.
  <details><summary>Technical</summary>

  A6, A7 (admin), `apps/indusk-admin/src/components/PromiseWords.test.tsx` (browser test, as `Promises.test.tsx`): the labels and accessible names in `PROMISE_STATE_CHIP` and `PROMISE_HEALTH_CHIP` (red → `broken`, green → `holding`, unverified → `no signal`, fixed → `broke — fixed`, amber → `known broken`), a rendered `PromiseTimeline` cell's titles (`broke — open`, `broke — fixed`, `held`, `no signal`), a `PromiseHealth` line with breaks ("N breaks", not "violations") and with none ("no signal", not "not seen"), and the plan list's warning ("holds a promise broken in the window"); no rendered text matches `/violat|unverified|not seen|no runs/i`. A7, A8, `apps/indusk-mcp/src/__tests__/promises-cli-words.test.ts`: `formatStatus` with breaks, with none and with nothing seen; the watch summary with nothing new; the check summary line and the two state refusals; the heartbeat and schedule messages — none matches `/violat/i`, and nothing seen reads `no signal`. A7, A9, `apps/vscode-extension/src/core/view-words.test.ts`: the amber and unverified labels read `known broken` and `no signal`; `activity.test.ts` gains a case where an entry with outcome `broken` reads `broke`. Red today.

  </details>
- [x] Write the word scan over the pages, skills, templates and descriptions people read.
  <details><summary>Technical</summary>

  A10, `apps/indusk-mcp/src/__tests__/promise-words.test.ts`: read `apps/docs/src/guide/**/*.md`, `apps/docs/src/reference/**/*.md`, `apps/indusk-mcp/skills/*.md`, `apps/indusk-mcp/templates/planning/CLAUDE.md`, `apps/indusk-mcp/templates/server/{Dockerfile,fly.toml}`, `examples/seat-holds/README.md`, and the string literals of `apps/indusk-mcp/src/bin/cli.ts` and `apps/indusk-mcp/src/tools/promise-tools.ts`; refuse `/\bviolat\w*|known-violated/i` and the promise sense of mark (`/\b(a|its|the|every) marks?\b|\bmarked the promise\b/i`), each match reported as `file:line`, after removing the allowed list — the attribute and event names (`indusk.promise.violated`, `indusk.promise.outcome`), the attribute value `"violated"` in a snippet that sets it, and the sentence beside it saying it is read as broken — named in the test with a reason each. Red today on about thirty files. promise: a-promise-is-upheld-or-broken

  </details>

#### Regression Guards

- **A2** — a signal saying `violated` is read as broken today; the row holds that once the reader also accepts `broken`, which is what keeps already-instrumented applications working.

#### Test Phase 1 Verification

- [x] The new tests exist and fail on their own assertions, and the guard over the old word passes.
  <details><summary>Technical</summary>

  Red: A1, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13. Green: A2. `cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/outcome-words.test.ts src/lib/promises/standing.test.ts src/lib/promises/signal-writers.test.ts src/lib/promises/known-broken.test.ts src/lib/promises/record-broken.test.ts src/lib/always-on/announce-broken.test.ts src/__tests__/promises-cli-words.test.ts src/__tests__/promise-words.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/PromiseWords.test.tsx`; `cd apps/vscode-extension && pnpm exec vitest run src/core/view-words.test.ts src/core/activity.test.ts`; `cd examples/seat-holds && pnpm exec vitest run src/seats.test.ts`. No test fails on a missing import.

  </details>

### Build Phase 1: The two stored words change, and the old ones are still read

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase changes the two words InDusk stores. A signal's verdict is decided in one place: upheld is upheld, and both the new word broken and the old word violated are broken, so every reader — the status, the health chips, the timeline, the thirty days, the looks standing, the recorder that opens incidents and the always-on server that announces them — reads either the same way. InDusk's own signals and the demo app keep sending violated for this release, so recording servers already deployed keep reading them; switching them to broken is the next release's, in the plan that reworks signals. A promise's registry state known-violated becomes known-broken; a file still saying the old word is read as the new one, and nothing rewrites it. The admin's and editor's labels for that state change here too, because they are typed against the state list. After this phase the stored values are right and the old ones still work; the words on screens change in the next.

- [x] Make every reader of a signal decide its verdict in one place, where broken and violated both mean broken.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/vocabulary.ts`: `PROMISE_OUTCOMES = ["upheld", "broken"] as const`; add `readOutcome(value: unknown): PromiseOutcome | null` (`upheld` → `upheld`; `broken`, `violated` → `broken`; else null), with a docblock carrying `promise: a-promise-is-upheld-or-broken`. Use it in `telemetry.ts` `parseMarkedSpan` and `lib/testing/trace-shape.ts`. Replace each in-memory `"violated"` comparison and type with `"broken"`: `store.ts`, `health.ts`, `look-standing.ts`, `proof.ts`, `record.ts`, `trunk-commit.ts`, `timeline.ts`, the admin's `lib/timeline-strip.ts`, the editor's `core/activity.ts` (which reads `--json`; accept both words there by the same rule, copied by value since the extension does not import the package).

  </details>
- [x] Make the always-on server ask Jaeger for signals saying either word.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/always-on/pass.ts` `violationsSince`: one `/api/traces` query per service per value (`broken`, `violated`), merged by span id as today; keep the outcome check through `readOutcome`.

  </details>
- [x] Make InDusk's own signals take the new verdict in code while still writing violated on the wire this release.
  <details><summary>Technical</summary>

  `lib/promises/mark.ts`: `outcome: "upheld" | "broken"` in its argument; it writes the attribute value `violated` for `broken` at this one point (a docblock naming `.indusk/planning/mark-first/` as the plan that switches it), the event and symptom attribute names unchanged. Callers in `eval/otel.ts`, `promises/record.ts`, `promises/trunk-commit.ts`, `looks/report.ts` pass `broken`. `examples/seat-holds/src/seats.ts` and `telemetry.ts` keep writing `violated`, unchanged.

  </details>
- [x] Rename the registry state known-violated to known-broken, reading the old word on load.
  <details><summary>Technical</summary>

  `vocabulary.ts`: `PROMISE_STATES = ["declared", "enforced", "known-broken", "retired"]`, docblock updated. `registry.ts`: map `known-violated` → `known-broken` before `promiseProblem` validates. `incidents.ts` writes `known-broken` on open; on the last fix returns either word to `enforced` (reading the raw file). `check.ts`, `health.ts`, `standing.ts`, `proof.ts` compare to `known-broken`. Admin `components/bars/labels.ts` and `components/plan/PlanParts.tsx` keys, and `__tests__/helpers/promises-fixture.ts`'s `PromiseState`, follow. Existing tests that write `known-violated` fixtures keep doing so (they now prove the alias); assertions that read the state back expect `known-broken`.

  </details>
- [x] Review the shape of the changed reading and writing code.
  <details><summary>Technical</summary>

  Shape per `/work`, over `vocabulary.ts`, `telemetry.ts`, `registry.ts`, `incidents.ts`, `pass.ts`, `mark.ts`.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] A signal saying broken or violated is read, recorded, announced and counted as broken; InDusk and the demo app still send violated; a known-violated file reads known broken, and incidents move promises in and out of it.
  <details><summary>Technical</summary>

  Green: A1, A3, A4, A5, A11, A12, A13; still green: A2. `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/promises/outcome-words.test.ts src/lib/promises/standing.test.ts src/lib/promises/signal-writers.test.ts src/lib/promises/known-broken.test.ts src/lib/promises/record-broken.test.ts src/lib/always-on/announce-broken.test.ts && pnpm exec vitest related src/lib/promises/vocabulary.ts src/lib/promises/telemetry.ts src/lib/promises/registry.ts src/lib/promises/incidents.ts src/lib/always-on/pass.ts src/lib/promises/mark.ts`; `cd examples/seat-holds && pnpm exec vitest run src/seats.test.ts`; `pnpm -w exec tsc -b` clean across the admin and the extension.

  </details>
- [x] The registry check still passes on this repository's own promises, and its summary names known-broken.
  <details><summary>Technical</summary>

  `indusk promises check` exits 0; its summary line names `known-broken`.

  </details>

#### Build Phase 1 Context

- [x] The promise code's own context file says where a signal's verdict and a promise's state words are decided.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md` (area): "A signal's outcome is read only through `readOutcome` — `broken` and `violated` both mean broken, so applications instrumented before 2026-10-15 keep working; the registry reads `known-violated` as `known-broken` and never rewrites it. — `promise: a-promise-is-upheld-or-broken`, see `/decisions/one-promise-language`".

  </details>
- [x] The root context lists this decision among the key decisions.
  <details><summary>Technical</summary>

  root (Key Decisions): "One promise language: upheld/broken, holding/broken live, no signal unknown; every reader takes `broken` and `violated` as broken, writers keep `violated` until `mark-first`; `known-broken` with `known-violated` still read — see `/decisions/one-promise-language`" — always-on because Key Decisions is the one index of every ADR.

  </details>

#### Build Phase 1 Document

- [x] The changelog records that every reader takes both words and that the registry state is renamed.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` (Unreleased): "Every reader accepts a signal saying `broken` as well as `violated`; signals keep writing `violated` this release. The registry state `known-violated` is now `known-broken`; old files are still read."

  </details>
- [x] The promises guide says a signal written either way is read as broken.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/promises.md` snippet (lines 160-170) and `guide/always-on.md:131` keep writing `"violated"`, with one line beside each: "read as broken; `broken` is read the same". `examples/seat-holds/README.md` likewise.

  </details>

### Build Phase 2: The admin, the command line and the editor say holding, broken and no signal

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

With the stored words settled, this phase changes what people see on screen and in the terminal. The admin's chips say holding or broken for now, a timeline cell says held or broke, a promise's line counts breaks rather than violations, the plan list warns of a promise broken in the window, and a promise nothing has reported on says no signal, never green. The command line's status, watch and check output and the always-on server's messages say the same, as do the descriptions agents read of InDusk's promise tools, and the editor's labels. The approved looks do not change: they are held by value, not by text. The next phase brings the docs and skills into line and turns on the scan that keeps them there.

- [x] Make the admin say holding, broken, held, broke and no signal on every promise chip, cell, line and warning.
  <details><summary>Technical</summary>

  `components/bars/labels.ts` (`PROMISE_STATE_CHIP` `known-broken` label `known broken`, aria "known broken — an incident says why"; `PROMISE_HEALTH_CHIP` red `broken`/"broken in the window", fixed `broke — fixed`/"broke in the window, every incident fixed", green `holding`/"seen holding in the window", unverified `no signal`/"no signal in the window", amber `known broken`); `PromiseTimeline.tsx` `SAID` (`broke — open`, `broke — fixed`, `held`, `no signal`); `lib/timeline-strip.ts:166` ("broke … ago — open"); `PromiseHealth.tsx` ("N break(s)", "no signal"); `PlanList.tsx:304-305`; `Promises.tsx:371` and `promise/PromiseProof.tsx:51,100,106,196` ("no signal yet"; "no signal has reported a run of it in any source"). Comments that say violated in these files change with them.

  </details>
- [x] Make the command line and the always-on server say broken, held and no signal.
  <details><summary>Technical</summary>

  `lib/promises/status.ts` ("no breaks in …", "N break(s) in …", "no signal in …", "last seen holding …"); `watch.ts:177` ("No new breaks — nothing recorded."); `check.ts` refusals naming `known-broken`; `incidents.ts:212` default symptom ("The signal reported the promise broken and carried no symptom."); `always-on/heartbeat.ts:178,184` and `schedule.ts:33` ("breaks", "signals"); `bin/cli.ts:504,663,1283,1293,1327,1329` help.

  </details>
- [x] Make the descriptions agents read of the promise tools say breaks and signals.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/tools/promise-tools.ts:173,224` (`promise_health`, `record_breaks`): "breaks", "unrecorded breaks", "signal".

  </details>
- [x] Make the editor say known broken and no signal.
  <details><summary>Technical</summary>

  `apps/vscode-extension/src/core/view.ts:16,35-36` (`"known broken"`, unverified → `"no signal"`); comments in `hover.ts`, `session.ts` follow.

  </details>
- [x] Review the shape of the changed screens and messages.
  <details><summary>Technical</summary>

  Shape per `/work`, over the files above.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 2 Verification

- [x] The admin, the command line and the editor say holding, broken, held, broke and no signal, and nothing unreported reads green.
  <details><summary>Technical</summary>

  Green: A6, A7, A8, A9. `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/promises-cli-words.test.ts && pnpm exec vitest related src/lib/promises/status.ts src/lib/promises/watch.ts src/lib/promises/check.ts src/lib/always-on/heartbeat.ts src/bin/cli.ts src/tools/promise-tools.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/PromiseWords.test.tsx && pnpm exec vitest related src/components/bars/labels.ts src/components/PromiseTimeline.tsx src/components/PromiseHealth.tsx src/lib/timeline-strip.ts`; `cd apps/vscode-extension && pnpm exec vitest run src/core/view-words.test.ts src/core/activity.test.ts`.

  </details>
- [x] The approved looks of the promise pages still match.
  <details><summary>Technical</summary>

  `indusk looks check admin` exits 0 — the looks are held by value, so a text change leaves them matching.

  </details>

#### Build Phase 2 Context

- [x] The admin's context file says what a promise's words are on screen.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md` (area): "A promise is upheld or broken; live, holding or broken; past, held or broke; unknown, no signal — never violated, unverified or not seen, and no signal is never green. `PromiseWords.test.tsx` holds it — `promise: a-promise-is-upheld-or-broken`."

  </details>

#### Build Phase 2 Document

- [x] The admin and editor reference pages show the new labels.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/overview.md` (the chip legend), `reference/admin-ui/promise-page.md`, `guide/promises-in-your-editor.md`.

  </details>

### Build Phase 3: The docs, the skills and the planning rules use the same words, and a scan keeps them

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

The last phase brings everything people read outside the apps into the same vocabulary — the docs' guide and reference pages, the skills InDusk installs into every project, the planning rules template, and the files a person deploys the recording server from — and calls the telemetry behind a promise its signal rather than its mark. Pages that record history, such as the changelog's earlier entries and the decision records, keep the words they were written in. The word scan written in the first phase goes green here and stays in the everyday test run, so a new page or message that says violated is refused with its file and line.

- [x] Make the docs' guide and reference pages say upheld, broken, holding, no signal and signal.
  <details><summary>Technical</summary>

  Every file the scan names under `apps/docs/src/guide/` and `apps/docs/src/reference/` — at least `reference/cli/promises.md`, `guide/always-on.md`, `guide/promises.md` (add the words table: state upheld/broken, live holding/broken, past held/broke, no signal), `guide/plan-lifecycle.md` (Mermaid labels), `reference/cli/telemetry-server.md`, `reference/skills/catchup.md`, `guide/run-your-own-server.md`, `reference/tools/indusk-mcp.md`, `reference/cli/looks.md`. Attribute names stay.

  </details>
- [x] Make the shipped skills, the planning rules template and the server's deploy files use the same words.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/{catchup,falsify,planner,verify}.md` (then `indusk update` syncs `.claude/skills/`); `templates/planning/CLAUDE.md:140` ("each such commit is recorded as a break of `a-plan-is-written-on-its-own-branch`"); `hooks/check-gates.js` messages; `templates/server/{fly.toml,Dockerfile}` comments.

  </details>
- [x] Publish this decision on the docs site.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/one-promise-language.md` from `adr.md`, linked from the decisions index.

  </details>

#### Build Phase 3 Verification

- [x] Nothing people read says violated, violation or known-violated, or calls a promise's telemetry its mark, outside the named exceptions.
  <details><summary>Technical</summary>

  Green: A10. `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/promise-words.test.ts`; `pnpm --filter docs build` succeeds.

  </details>
- [x] The installed skills and planning rules match the package's copies.
  <details><summary>Technical</summary>

  `indusk update` leaves `.claude/skills/` and `.indusk/planning/CLAUDE.md` equal to the package copies (`git diff --stat` shows only the synced files).

  </details>

#### Build Phase 3 Context

- [x] The planning rules say a plan document speaks of promises as upheld or broken.
  <details><summary>Technical</summary>

  planning: `apps/indusk-mcp/templates/planning/CLAUDE.md`, under Documents — "A plan document says a promise or clause is upheld or broken (live: holding or broken; past: held or broke; unknown: no signal), and its telemetry its signal — never failed, passed or violated; tests still pass and fail. — guarded by `promise-words.test.ts` (`promise: a-promise-is-upheld-or-broken`); see `/decisions/one-promise-language`".

  </details>

#### Build Phase 3 Document

- [x] The changelog says the docs and skills now speak the same words.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` (Unreleased): "The admin, the command line, the editor, the docs and the skills say a promise is upheld or broken — holding or broken when live, no signal when unknown — and call its telemetry a signal."

  </details>

### Build Phase 4: Falsification — the words the editor, the extension skills and the docs still get wrong

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

A fresh reader went looking for places where the plan's promise does not yet hold, and found eight. Four surfaces still show the old words or a wrong one. The editor calls a retired promise holding and draws it in the healthy colour, says fixed where the admin says broke — fixed, and says No runs yet where nothing has reported. The admin's dashboard and promise page say never seen and nothing seen. The line the everyday test suite prints says marked … violated. The test helper's failure messages say violated. The word scan reads too little: it misses the extension skills InDusk installs, the server image's own deploy files, and most of the ways a page calls a signal a mark. Several pages also claim the demo, the evaluator and the looks check send `broken`, when this release they send `violated`. Most serious, the editor's input, `indusk promises health --json`, now says `broken` for a break, and an editor installed before this release reads every such run as held. That is the version skew the decision rejected, so this phase keeps that JSON on the old word until the writers switch. Three findings belong to `mark-first`, the next plan, which switches every writer to `broken`: the two writers outside the one writing function, the same skew in the registry state, and the dashboard's green dot for a promise with no signal. Each is carried in that plan's research.

- [ ] Make the editor's input keep saying violated for a break this release, so an editor installed earlier still reads it as broke.
  <details><summary>Technical</summary>

  A14. `apps/indusk-mcp/src/lib/promises/health-line.ts` `newestRuns` / `healthLine` `runs`: map the in-memory `broken` to `"violated"` at the one point the line is written, as `markPromise` does (a docblock naming `.indusk/planning/mark-first/`). The extension already reads both (`activity.ts:7`). Test: build a line from a store read holding one `broken` and one `violated` signal and apply the pre-plan editor rule (`r.outcome === "violated" ? "broke" : "held"`) to its runs. Both read broke.

  </details>
- [ ] Make the editor say retired for a retired promise, broke — fixed for a fixed one, and no signal for an empty activity section.
  <details><summary>Technical</summary>

  A15. `apps/vscode-extension/src/core/view.ts:33,37`: `fixed: "broke — fixed"`, `grey: "retired"` (add both to `Shown`); `markers.ts:84` gives the ok tone only to `holding` and `broke — fixed`. `activity.ts:50`: `"No runs yet."` → `"No signal yet."`. Tests in `view-words.test.ts` (grey, fixed) and `activity.test.ts` (empty).

  </details>
- [ ] Make the admin's dashboard row and the promise page's legend say no signal.
  <details><summary>Technical</summary>

  A16. `apps/indusk-admin/src/components/Promises.tsx:376` `"never seen"` → `"no signal"`; `promise/PromiseProof.tsx:266` `"Grey: nothing seen."` → `"Grey: no signal."`. Assertions in `PromiseWords.test.tsx`.

  </details>
- [ ] Make the everyday suite's printed line say broken and signal, while it still writes violated.
  <details><summary>Technical</summary>

  A17. `apps/indusk-mcp/scripts/suite-speed.js`: the outcome object stays `violated` on the wire (`:37`, `:50`). The line at `:117` prints `signal sent: <promise> broken|upheld (N s)`, and the `not marked:` lines become `no signal sent:`. Test in `suite-speed.test.ts`: the attribute is `violated` and the printed line has no `violated` or `marked`.

  </details>
- [ ] Make the trace-shape helper's failure messages say broken.
  <details><summary>Technical</summary>

  A18. `apps/indusk-mcp/src/lib/testing/trace-shape.ts:156,163`: "marks promise … broken but carries no `indusk.promise.violated` event" and "no span signalled promise … broken". The function name `expectPromiseViolated` stays, as an internal name. The test calls it on spans with no break and asserts that the thrown message does not match `/\bviolated\b(?!\s*event|`)/`, ignoring the event name.

  </details>
- [ ] Widen the word scan to the extension skills, the server image's deploy files and every promise sense of mark, and reword what it then finds.
  <details><summary>Technical</summary>

  A19. `apps/indusk-mcp/src/__tests__/promise-words.test.ts`: add `apps/indusk-mcp/extensions/*/skill.md`, `docker/Dockerfile.always-on` and `docker/fly.always-on.toml` to `scanned()`. Widen `MARK_SENSE` to the promise senses (`(promise|production|one|that|a promise's) marks?`, `sends? marks?`, `marks? (a|the) promise`, `has been marked`, `run, mark,`) and keep `MARK_ALLOWED` for the nav glyph. Then reword what turns red: `extensions/testing/skill.md:39,43,54` (the read-as-broken line beside `// or "violated"`, "Test the signal", "asserts a break"); `docker/*` comments ("break"); `guide/run-your-own-server.md:3,117`, `guide/promises.md:218,263`, `guide/index.md:178,183`, `guide/contract.md:28`, `guide/always-on.md:3`, `guide/try-it.md:24,46`, `reference/cli/telemetry-server.md:47`, `reference/cli/looks.md:414`. Run `indusk update` so `.claude/skills/testing/SKILL.md` follows.

  </details>
- [ ] Make the pages that say InDusk's or the demo's signals are written broken say they are written violated this release and read as broken.
  <details><summary>Technical</summary>

  A20. `guide/try-it.md:35`, `guide/promises.md:217`, `reference/cli/demo.md:40` and `reference/cli/looks.md:415` give the attribute value as `violated` this release, read as broken (the sentence form `ALLOWED` already permits). The scan refuses a line that says InDusk's own signals or the demo's are marked or set to `` `broken` ``.

  </details>
- [x] Carried to `.indusk/planning/mark-first/research.md`, the plan that switches every writer to `broken` next release (commit `24205d54e` on `plan/mark-first`): the two writers outside `markPromise` (`scripts/suite-speed.js` and the health line's runs), the `known-broken` state an older InDusk refuses, and the dashboard dot drawn green for an enforced promise with no signal (an approved look).
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules.

#### Build Phase 4 Verification

- [ ] An editor from before this release reads a break as broke; the editor, the admin, the suite's line and the helper's messages say retired, broke — fixed and no signal, never holding for a retired promise; the widened scan is green over the extension skills, the docker files and every promise sense of mark; no page says the writers send broken this release.
  <details><summary>Technical</summary>

  Red first on today's code, then green: A14–A20. `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/promises/outcome-words.test.ts src/__tests__/suite-speed.test.ts src/__tests__/promise-words.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/PromiseWords.test.tsx`; `cd apps/vscode-extension && pnpm exec vitest run src/core/view-words.test.ts src/core/activity.test.ts`. A1–A13 still pass (same commands with Build Phase 3's files). `pnpm --filter docs build` succeeds.

  </details>
- [ ] The approved looks of the promise pages still match.
  <details><summary>Technical</summary>

  `indusk looks check admin` exits 0 — only text changed on the dashboard row and the legend.

  </details>

#### Build Phase 4 Context

- [ ] The editor's context says a retired promise is never shown as holding, and the promise code's context says the health line keeps the old outcome word until the writers switch.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: "`promises health --json` is a wire: its `runs[].outcome` stays `violated` until `mark-first` switches every writer, because an installed editor is not updated with the package." The extension's rule lives in `apps/vscode-extension/` (its CLAUDE.md, beside the app rules): "grey is retired, never holding — `promise: a-promise-is-upheld-or-broken`".

  </details>

#### Build Phase 4 Document

- [ ] The editor's guide shows retired and broke — fixed, and the testing extension's page says a signal written violated is read as broken.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/promises-in-your-editor.md` (the state words list); the docs page that renders the testing extension's skill, if one exists under `apps/docs/src/reference/`, follows `extensions/testing/skill.md`.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/vocabulary.ts` | `PROMISE_OUTCOMES` upheld/broken, `readOutcome`, `PROMISE_STATES` known-broken |
| `apps/indusk-mcp/src/lib/promises/{telemetry,store,health,look-standing,proof,standing,timeline,record,trunk-commit,mark,registry,incidents,check,status,watch}.ts` | read through `readOutcome`; `broken`; `known-broken` with the alias; words |
| `apps/indusk-mcp/src/lib/always-on/{pass,heartbeat,schedule}.ts` | query both values; words |
| `apps/indusk-mcp/src/lib/{eval/otel,looks/report,testing/trace-shape}.ts` | pass the verdict `broken` (still written `violated`); read both |
| `apps/indusk-mcp/src/bin/cli.ts`, `src/tools/promise-tools.ts` | help and tool descriptions |
| `apps/indusk-mcp/skills/*.md`, `templates/planning/CLAUDE.md`, `templates/server/*`, `hooks/check-gates.js` | words |
| `apps/indusk-admin/src/components/{bars/labels.ts,PromiseTimeline.tsx,PromiseHealth.tsx,PlanList.tsx,Promises.tsx,promise/PromiseProof.tsx,plan/PlanParts.tsx}`, `src/lib/timeline-strip.ts` | labels and state key |
| `apps/vscode-extension/src/core/{view,activity}.ts` | labels; read both outcome words |
| `examples/seat-holds/src/seats.test.ts`, `README.md` | a test that it writes `violated` and `broken` is read; the README's reading line (the demo's writer is unchanged) |
| `apps/docs/src/guide/**`, `apps/docs/src/reference/**`, `decisions/one-promise-language.md`, `changelog.md` | words; new ADR page |
| new tests: `outcome-words`, `signal-writers`, `known-broken`, `record-broken`, `announce-broken`, `promises-cli-words`, `promise-words`, `PromiseWords`, `view-words` | the trajectory |

## Dependencies

- None. `plans-are-promises` and `mark-first` wait on this plan's words.

## Notes

- No version skew this release (Sandy, 2026-10-15): writers keep `violated`,
  so no recording server older than this plan meets `broken`. The switch of
  InDusk's writers and the demo app to `broken` is carried by
  `.indusk/planning/mark-first/` (its research, "First cut"), next release.
- Internal names that still say violation (`violations`, `violationState`,
  `recordViolations`, `PROMISE_MARK.violatedEvent`) are kept on purpose; a
  later plan may rename them if `mark-first` rewrites those modules anyway.
