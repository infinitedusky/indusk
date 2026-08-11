---
title: "Midnight — failure-anchored testing and the expectation corpus"
date: 2026-06-14
status: draft
amended: 2026-08-11
---

# Brief — Midnight

::: warning AMENDED 2026-08-11 — read this first
This brief is **not superseded**. Its mechanism is the plan of record. But one of its four parts was replaced, and two are stale. See [Amendment](#amendment-2026-08-11) below before acting on anything here.
:::

**What this is:** the refactor of InDusk that establishes a different relationship between failures, tests, and planning. Specifically: **failures in production define the test cases.** We stop writing tests speculatively. We write tests when something has actually broken — captured as an expectation that should hold — and the test becomes the assertion that it never breaks the same way again.

## Amendment 2026-08-11

Four parts, reviewed against `lifecycle-rebalance`, `test-phase-structure`, and the Dawn master.

### Kept — the linkage mechanism (the valuable core)

**Unchanged and still the plan of record.** One shared ID threading a test, a code site, and a span: `E-N` comments at enforcement sites, `expectations.enforced` / `expectations.violated` span attributes, `expectTraceShape` naming the expectation it validates, and the collapse-signal query. Phases 1–5 and 7 stand as written.

This is the part worth building, and it does **not** depend on the philosophy below. Splitting them is the point of this amendment: the mechanism should not have to win an argument about test authorship in order to proceed.

### Replaced — "no test until a failure earns it"

The strong claim — *"don't write a test until something has earned that test by failing in production"* — is **replaced by two authorities**:

| | Written | Authority | Answers |
|---|---|---|---|
| Trajectory test | before the code | **specification** | did we build what the plan claimed? |
| Expectation test | after a failure | **failure** | does the system still uphold what it must? |

The brief's critique is correct about its actual target — a unit test written *after* the code, mirroring it, "catches the developer typing." But a test written *before*, derived from a stated commitment, is a different object: it constrains the implementation from an angle the implementation did not choose. Enough of them and the implementation is over-determined — fitted through fixed points rather than invented.

**Consequence:** the success criterion *"every assertion traces back to a real F-N with a real failure date"* is amended to **"every assertion traces to an F-N or a plan assertion. No orphans."** As written it would have deleted every trajectory test.

**And the sharper inversion this unlocks:** telemetry does not replace specification tests — it **grades** them. The highest-information object in the system is *a test that passed while production broke*, because it names your assertion as insufficient rather than merely reporting that code failed. The original framing cannot produce that object, because under it the test would not have existed yet.

### Dropped — `subsystem` as a durable primitive

Midnight's Phase (subsystem-scoped, append-only, never archived) is **not being built.** Its problem is real and correctly diagnosed — four plans for one concern, because plans close — but the fix is a lifecycle change rather than a new noun: **plans become reopenable and gain a `monitor` state.** Closed stays the resting state, so the active surface does not grow without bound.

Recorded in [`/guide/plan-lifecycle`](../../../apps/docs/src/guide/plan-lifecycle.md).

**What would reverse this:** an expectation that genuinely belongs to no plan, or one created by plan A and violated by code from plan B where "which plan reopens?" has no clean answer. If that happens twice, build subsystems then — with evidence, not prediction.

Expectations still need an owner. Under the amendment, the owner is **the plan that created them**, and a violation reopens that plan.

### Stale — the inventory and the sequencing

- **The "What InDusk has today" section is out of date.** It lists Graphiti episodic memory, FalkorDB code graph, code-graph-context and the `/highlight → eval-agent → Graphiti` pipeline as live substrate. `indusk-makeover` removed all of them; highlights now materialize into `.claude/lessons/` via `add_lesson`. Phase 8's bloat audit is *more* right than when written — parts of it already happened.
- **"Not Dawn. Dawn comes later. Dawn is built on top of Midnight"** is superseded by `.indusk/planning/indusk-v2-dawn/master.md`, which has components 1, 2, 3 and 6 done and does not mention Midnight. Dawn was re-founded 2026-07-26, after this brief. **The relationship between the two is an open question and neither document currently answers it.**

### What did not change

Phase 8 (the bloat audit), the collapse-signal concept, the F-corpus, and the claim that expectation-shaped regression is a higher-value class than unit-test regression. All stand.

---

**What this is not:** Midnight is not Dawn. Dawn comes later (loosely "Phase 3"). Dawn is a system multiple people can work on together — wraps any codebase, retrofits / fills in missing structure, supports shared documentation, expectations, and corpus across a team. Dawn is built **on top of Midnight**. Midnight is the engine; Dawn is the product surface that exposes it to teams.

## Goal

Refactor InDusk so that:

1. **Live failures are the source of test authority.** When something breaks in production, that's the event that opens an expectation (named invariant the system was supposed to uphold), files a known-issue with root cause, lands a fix, and writes a trace-shape assertion that prevents that exact regression. No speculative test-writing. No test files that exist because "we should have unit tests" — only tests that exist because something failed in a way that's worth preventing.

2. **Build in production is the workflow, not the slogan.** The deployment goes live. Something deforms. The deformation gets named, mapped, fixed, and the system grows stronger at that exact site. The history of every reshaping is preserved and queryable — six months later, a new agent looking at the subsystem can read "Phase 3 implemented X via approach A; Phase 7 superseded with approach B because expectations E-9 and E-10 kept regressing under A."

3. **InDusk gets leaner while doing it.** InDusk has been built on top of built on top of built. Features exist that probably aren't working and haven't been for some time, that nobody currently checks (code-graph-context — when did anything last query it? multiple agent-runner generations — what's the canonical path? skills with overlapping responsibility — does anyone use `/onboard` vs `/catchup`?). Midnight is the refactor: drop what isn't load-bearing, formalize what is, ship the lean result.

Shipping shape: days-to-weeks, distributed across normal feature work in downstream projects (Numero is the proving ground). Each phase independently useful; stop at any phase and what's shipped is still valuable.

## Why expectation-shaped regression is the high-value class

Unit-test regression catches narrow correctness — "function returned wrong value." Useful, but most unit tests in most projects are speculative theater: they assert that the function we just wrote still does what we just wrote, not that the system upholds anything users care about. They mostly catch the developer typing.

Expectation regression catches **system-level violations** — "the table froze under concurrent sit-down," "mid-hand restart corrupted the in-flight bet," "agent inference timeout cascaded into a frozen seat" — across every code path that should have prevented them. Expectation regressions are also self-amplifying: a system whose expectations keep failing is collapsing under its own weight, and the regression count over time is the collapse signal that tells you "stop adding features, refactor this subsystem."

The principle behind Midnight: **don't write a test until something has earned that test by failing in production.** When it does, the test is anchored to a real expectation, a real failure, a real fix. Everything that exists in the test suite exists because the system needed to remember it.

## What InDusk has today

**Telemetry substrate** (mature):
- OpenTelemetry spans, traces, structured logs through services
- Per-service `telemetry-contract.ts` — typecheck enforces missing-span + orphan-span gates
- Local telemetry (Jaeger + MCP) for dev-time query; Dash0 for production
- In-process test-span buffer for vitest assertions
- W3C traceparent across services + WS messages

**Test substrate** (mature):
- Vitest, Playwright, multi-wallet integration harness
- CI via GitHub Actions
- `/falsify` ritual

**Planning substrate** (mature for waterfall, weak for evolution):
- brief → research → ADR → impl → test-plan → falsify → retrospective → **archive**
- Linear lifecycle; plans end in archive; subsystem refactor spawns a new plan instead of appending. The archive accumulates plans like sediment layers (`bulletproof-state`, `bulletproof-state-machine`, `bulletproof-state-finishout`, `bulletproof-pregame-ui` — four plans, one subsystem).

**Memory substrate** (uneven):
- Lessons (`.claude/lessons/`) — rules from past mistakes
- Plan retrospectives — narrative
- CLAUDE.md Conventions + Known Gotchas — flat, manually curated
- Graphiti episodic memory + FalkorDB code graph — exist, mostly empty for active projects
- `/highlight` → eval-agent → Graphiti pipeline exists

**Workflow surface** (mature):
- `/catchup` `/work` `/verify` `/document` `/handoff` `/falsify` `/retrospective` `/planner`
- Pre/post tool-use hooks for enforcement

**Bloat / unknown-state surface** (audit candidates for the refactor):
- code-graph-context (cgc) — when did anything last query the graph? does it reflect current code?
- Multiple agent-runner generations (poker-agent-runner-0/-2; some archived, some not)
- chitin-plugin (referenced in CLAUDE.md current state, possibly archived)
- Skill overlap (`/onboard` vs `/catchup`)
- Lessons potentially superseded but not removed
- Extensions untouched for months — any load-bearing? any dead?

## What Midnight adds

Three primitives, one loop. Same shapes I sketched earlier — but the framing is now strict: these exist **because failures earned them**, not because the design prescribed them.

**Expectation (E-N)** — named invariant a subsystem upholds. Statement + enforcing code sites (greppable `E-N` comments) + validating trace patterns (test IDs) + historical violators (F-IDs). Lives in `subsystems/<name>/expectations.md`. Each expectation traces back to a real failure that motivated it.

**Known issue (F-N)** — symptom + root cause + violated expectation(s) + status + fix commit + adjacent F-IDs. Lives in `subsystems/<name>/known-issues.md`. The corpus is built from real symptoms, not anticipated ones.

**Phase** — one round of work on a subsystem. Motivation (which E or F triggered it) + approach + what it supersedes + what new expectations it introduces. Append-only. Subsystems never archive; their phases accumulate.

The loop:
```
work begins (normal feature work, no foundation-first ceremony)
  ↓
production failure → opens a new F-N OR matches an existing one
  ↓
F-N closure spawns a new phase on the subsystem
  ↓
fix lands, expectations.md gets E-N updated/added, code site annotated, trace test written
  ↓
E-N becomes a tripwire — next time anything in production violates the trace pattern, the alert says "E-N regressed"
  ↓
collapse signal (repeated violations of related E-IDs over time) → triggers a refactor phase that supersedes prior phases; history preserved
```

The key inversion: tests don't get written when code gets written. Tests get written **when failures earn them.** Every assertion in the codebase has a known story: "this exists because X broke in production on date Y; here's the F-N; here's the phase that closed it."

## Incremental path

| Phase | Effort | What |
|---|---|---|
| 1 | ~3h | **Convention + seeded example.** Pattern README at `.indusk/subsystems/`. Convert one real subsystem (state-persistence from the Numero bulletproof-persistence plan) into the Dawn-shape doc with 2 expectations + 2 known-issues seeded from real failures this week. `/catchup` reads the new directory. |
| 2 | ~1d | **Code annotation convention.** Greppable `E-N` comments at enforcement sites. Span attribute convention: `expectations.enforced` + `expectations.violated`. Lint check: every E-N referenced has ≥1 code site OR test. |
| 3 | ~1d | **Telemetry contract extension.** `telemetry-contract.ts` entries declare `expectations:` field. Typecheck rejects span attribute claims that reference E-IDs not in the relevant subsystem. |
| 4 | ~2d | **`expectTraceShape` helper.** Trace-pattern assertion library. Each pattern names the E-N it validates. CI failure messages reference the violated expectation. This is the test-writing primitive — tests get written to this shape, not to "should the function do X." |
| 5 | ~2d | **Collapse-signal query.** `pnpm midnight:check <subsystem>` shows all expectation violations in the last 24h, sourced from Dash0 + local telemetry. The collapse signal becomes a number. |
| 6 | ~1d | **Skill updates.** `/planner` recognizes subsystem-shaped work and appends phases. `/retrospective` learns archive-eligible feature plans vs live subsystems. `/falsify` runs against the expectation list. |
| 7 | ~2d | **Production-to-corpus loop.** Dash0 alert → bot checks F-corpus → pages with "this is F-N, here's the fix path" or opens a new F-N. The build-in-production loop closes. |
| 8 | ~2d | **InDusk bloat audit + drop.** Inventory every extension, skill, hook, tool. Mark each: load-bearing / superseded / unused / unknown. Drop superseded + unused. For unknown, 1-week telemetry trace + drop if nothing queries. cgc + Graphiti get specific scrutiny. |

**Total: ~2 weeks of focused work**, distributed across normal feature work in Numero. Phases 1–7 are the core system. Phase 8 is the refactor of accumulated bloat.

After Midnight ships: Dawn becomes possible as a follow-on plan. Dawn is the multi-user / team / wraps-any-codebase product surface that exposes Midnight to people who didn't build it.

## Success criteria

- The test suite of any Midnight-using project has no speculative tests. Every assertion traces back to a real F-N with a real failure date.
- A new agent (Claude or human) runs `/catchup`, sees the subsystem corpus, and can answer "what does this project care about?" without reading 30 archived plans.
- A bug surfaces; the operator files an F-N in 30 seconds; the existing skill flow handles next steps.
- A refactor is visible: read the subsystem's `phases.md`, see "Phase 3 implemented X via approach A. Phase 7 superseded with approach B because expectations E-9 and E-10 kept regressing under A."
- Production failure mode is queryable: "how often was E-N violated this week?" → a number that means something.
- InDusk's installed surface is lean enough to enumerate in one screen, with every entry currently used and currently maintained.

## What this is not

- **Not a rewrite of InDusk.** Convention + glue + targeted refactor of bloated edges.
- **Not a substitute for shipping features.** Each phase fits between feature deliveries in downstream projects.
- **Not Dawn.** Dawn is the team-product layer built on top of Midnight after Midnight is stable.
- **Not "more tests are better."** The opposite: tests that exist without a real failure-anchored story are exactly what Midnight is trying to eliminate.

## Cross-references

- Numero's `bulletproof-persistence` is the natural pilot for the subsystem shape — most recent subsystem with active phases, fresh known-issues from real failures this week, and live operator memory. State-persistence becomes the seeded example in Phase 1.
- The eval system (`.indusk/eval/`) is the natural surface to trigger F-N creation on certain failure classes (hook → eval → "is this a known F-N?" → respond).
- Dawn (later plan) will need Midnight's primitives stable before it can layer the multi-user / shared-corpus / external-codebase-wrapping concerns on top.
