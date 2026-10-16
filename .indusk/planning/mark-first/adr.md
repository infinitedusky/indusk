---
title: "Signal first"
date: 2026-10-16
status: proposed
---

# Signal first

## Goal

**A clause is proved twice, and a person looking at a break can tell which clause broke and why its signal was ever added.** Tests prove what was meant; the signal proves what happens where the thing runs; neither stands in for the other, and a plan closes only when both say so.

Today a plan closes when its rows say `passing`, which is a cell in a document, not a test run; a clause with no signal reads as if nothing were wrong; and a break names the tests that were proving it but not the clause. Four of 155 promises have a signal at all.

## Y-Statement

**In the context of:**
closing a plan whose promises are stated as clauses (`plans-are-promises`, landed), where each clause already has test rows and a signal line in its clause plan but nothing reads the signal and closing never runs the tests.

**Facing:**
a signal that is only a copy of a test's assertion run in production, which fails exactly where the test would have and misses what it missed; a closing step that trusts a State cell; and a break that reaches the agent naming files, not the clause it was about.

**We decided for:**
closing and landing that run the tests a clause's rows name and report by clause; a closing that also asks the local daemon whether each clause's signal has reported upheld in a real run; spans and incidents keyed by `promise` and `clause`, with the plan and phase that added the signal as a pointer; readers that ignore a signal produced by a test run; a promise's standing as the worst of its clauses, a resting clause's as the standing of the promise it rests on; and a seventh audit question that hands each concern to the signal loop, answered with a signal, a fix or a reason.

**And against:**
replacing tests with signals; deriving a signal from the test that proves the same clause; letting the agent say in the impl that a signal reported; keying an incident by phase; closing on production traffic; and a separate plan for the audit change.

**To achieve:**
telemetry as a first-class proof beside tests: tests as the map the agent builds against, signals as the check in the territory, a break that points at its clause, and an audit whose concerns become things the system watches.

**Accepting:**
that a signal is detective, so a first break reaches a person; that closing waits on the daemon and on a test run; that a rarely run path leaves its clause on "no signal" for a long time; that a checkout on an older InDusk refuses the registry state `known-broken`; and that the second promise (the audit) shares little code with the first.

**Because:**
a signal derived from the clause's own sentence runs on inputs nobody chose and fails where no test could; every proof that an agent can state without anyone reading it can be gamed, so the proof must be read from the system; and the clause is the one key that outlives the phase that wrote the signal.

## Context

[research.md](research.md) has the origin (the 2026-10-14 conversation, the two bugs found by use, the 100 m dash of splits and limits), what changed since the brief was accepted (a plan holds promises; `plans-are-promises` and `one-promise-language` landed), and what was carried. [brief.md](brief.md) makes two promises, `a-clause-is-proved-twice` (four clauses) and `an-audit-concern-gets-a-solution` (two), and [test-plan.md](test-plan.md) is the clause plan with 32 assertions. This ADR answers "what makes all of them true".

## Decision

**D1. A signal belongs to a clause, keyed `promise/clause`.** A signal's spans and events carry `indusk.promise` and `indusk.clause`. A broken report also carries `indusk.signal.plan` and `indusk.signal.phase`, the plan and phase that added it, as a pointer: plans end, promises and clauses do not, so the pointer helps a person and the clause is what the system trusts. The incident a broken clause opens names the promise and clause first, the pointer second, and its tests are reached through the clause (the rows and files that carry its token), no longer named as the headline. `an-incident-names-its-tests` changes to say so. Asserted by A16–A18. Confidence: high.

**D2. Closing reads the system, not the document.** Closing and landing take the result of running the tests a clause's rows name as an input (a runner injected at the edge, so the rule is a `unit` test) and refuse a clause whose test fails now, naming the clause and the file, even if its row says it passed. Closing then asks the local daemon, through the reader `promises status` already uses, whether each clause's signal has reported upheld, and refuses a clause that has not, saying which half is missing. Both halves are inputs; no part of the rule waits on a clock or a server (`lesson: code-that-decides-takes-its-clock-and-its-reads`). A1, A2, A9, A10; the end-to-end story is A11, a live check. Confidence: high on the rule, moderate on the runner's cost, which is measured at the first landing.

**D3. A signal produced by a test run is not the clause's signal.** A writer sets `indusk.run=test` under a test runner; readers ignore spans carrying it, so a clause with passing tests and a test-made span still reads no signal. A5, A6. The alternative is trusting any span with the right name; it lets a test do the signal's job, which is the pattern this plan exists to end.

**D4. Standing is read from the clauses.** A promise's standing is the worst of its clauses (broken, then no signal, then holding); a clause that rests on another promise has that promise's standing; a promise made only of resting clauses closes when those promises are in force, with no row of its own (the gap `plans-are-promises`' audit left). A clause with no report reads no signal everywhere it is shown, a watcher past its heartbeat reads no signal even if the clause last reported upheld, and a split is broken by missing its budget at its point while a limit is broken by one report over its bound. A8, A12–A15.

**D5. The audit hands its concerns to the signal loop.** `/audit` gets a seventh question — for each concern above, what signal would show us if it breaks, and if telemetry is not the answer, say so — with three answers: a signal (the invariant checked, where it is emitted, which clause it would uphold, how often it would fire, what happens if its first break reaches a user), a fix (a wrong sentence or a missing guard), or nothing with the reason. It offers the kinds of signal as a menu: an outcome where it is felt, an invariant checked on each read, a postcondition after an operation, an expected event that did not happen, a policy that must never be crossed. A test is written when a signal breaks, not up front for every imagined failure; the tests that prove a clause before release stay. The audit remains advisory: no gate reads what it says, and an audit written with six answers still lets the retrospective start. The source is `apps/indusk-mcp/skills/audit.md`; the copy under `.claude/skills/` is synced from it. A19–A24, A28. Confidence: high.

**D6. Signals are derived from the clause, not from a test.** A clause plan's `Signal:` line says where the signal is read and what upheld and broken report, from the clause's sentence; a line that points at a test file is not a signal. This is what makes telemetry fail where no test could. Moderate confidence it pays off outside `behaviour` promises: for pure rules a test proves completely, a signal mostly duplicates the test, and the plan does not force one there.

**D7. One word, signal; the writers switch.** The telemetry a clause carries is called a signal in skills, tool descriptions, docs and code comments; exempt are the Day 4b entry in the root `CLAUDE.md`, archived history, and this plan's own name until it closes. `markPromise`, `scripts/suite-speed.js` and the demo app write `broken`; every reader reads both. The editor's health line keeps `violated` until the editor shipped with the language release has been out a release. A26, A30, A31.

**D8. The registry state `known-broken` is accepted as a skew.** An InDusk older than the language release refuses it; we do not keep writing `known-violated` for them. A checkout updates with `indusk update`, and the changelog says to update every checkout; the registry is the project's own, so the skew only appears when two InDusk versions read one project. Confidence: moderate; the cost of keeping both words is a writer branch that never goes away.

**D9. Tasks in an impl are imperative.** The planner's phase-summary rule says a task reads as work to do and a verification item as an end state that must hold. New impls only; an impl written before still validates. A32.

## Alternatives Considered

### Replace tests with signals
Rejected. Tests are how an agent builds the thing and how a change is stopped before it ships; removing them leaves nothing to say, before a deploy, that a change broke a clause ("the regression is fucked if you remove the tests"). Signals prove it in use; they do not replace the rehearsal.

### A signal derived from the test that proves the same clause
Rejected, against A6 and D6. It runs the same inputs in a different place and fails where the test would, which is what telemetry did before this plan. The value of a signal is that it sees what the test never chose.

### The agent states in the impl that a signal reported
Rejected, against A9 and A11. The closing check reads Jaeger through the daemon's reader; a sentence in a document can be written without a run having happened.

### Key an incident by phase
Rejected, against A17. A phase ends with its plan and its notes can be archived; the clause is permanent. The phase stays as a pointer.

### Close on production traffic
Rejected for now. dusk and most projects have no production traffic when a plan closes; "a run of the real system" through the local daemon is the closing condition, and the production source is read afterwards, by the watcher. `promise-sources` already reads both.

### A separate plan for the audit change
Considered. The audit promise shares little code with the clause promise (the skill and its parity test against the closing and signal readers), so under the planner's own rule it could be a plan under a master. It stays here because it is small, because its question is how signals get written (it is the front door of this plan), and because Sandy asked for it in this plan. A promise of its own keeps its clause plan separate and the first promise's sentence honest.

### Keep writing `known-violated` for older InDusks
Rejected (D8).

## Consequences

### Positive
- A plan cannot close on a document alone: its tests run and its signals report.
- A break leads from its clause to its tests, its signal's emit place, and the phase that added it.
- Silence never reads as health: no report and a blind watcher both read no signal.
- Audit concerns become things the system watches; tests grow from what really broke.
- One word for one thing.

### Negative
- Closing and landing wait on a test run and on the daemon; a plan with a clause whose signal cannot run on a developer machine cannot close until it can (a clause for a deployed system waits for the production source, or is split).
- A signal on a rare path leaves its clause "no signal" for a long time, and a person has to decide whether to wait, add a probe or accept it.
- A faulty signal reads falsely upheld, so a signal needs its own small test.
- A checkout on an older InDusk refuses `known-broken` (D8).

### Risks
- Signals multiply and the useful ones are lost: the audit's three answers and its fire-rate question are the guard, and a signal answer must name its clause.
- Closing on the daemon makes a stopped daemon block every close: the refusal says the daemon is not running and how to start it, never "no signal" as a pass.
- The `indusk.run=test` marker is missed by a writer: A6 fails at the writer's own test.
- Two tests (A29, the content check on a clause's test file) may produce false refusals; it is marked droppable and ships only if it does not.

## Documentation Plan

### Pages
- New: `decisions/mark-first.md`, published from this ADR (`/decisions/mark-first`).
- New: `guide/signals.md` — what a signal is, derived from the clause and not from a test, the kinds, fire rate, and how a break names its clause.
- Update: `guide/briefs.md` ("Promises as clauses": the clause's signal and the two proofs) and `guide/test-trajectory.md` (closing runs the clause's tests).
- Update: `reference/skills/audit.md` (the seventh question and its three answers) and `reference/skills/plan.md` (tasks are imperative).
- Update: `reference/cli/promises.md` (what closing reads) and `guide/context-tiers.md` only if the root's Key Decisions grows.

### Diagrams
- A Mermaid flow in `guide/signals.md`: a clause with its tests (before release) and its signal (in use), joined at the clause key; a broken report arriving at the incident with the clause, the pointer and the tests reached from it.

### Changelog
- Added: a clause is proved by its tests and its signal; a break names its clause; the audit asks for a signal, a fix or a reason for each concern; one word, signal.

### ADR in Docs
- Yes: `decisions/mark-first.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/promise-core/master.md` — "Settled 2026-10-14/15" and "The primitive"
- `/decisions/plans-are-promises`, `/decisions/one-promise-language`, `/decisions/day-monitor`, `/decisions/promise-sources`
