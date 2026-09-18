---
title: "Day step 4a — Promises: registry, check, self-hosting, page"
date: 2026-09-18
status: accepted
accepted: 2026-09-18
---

# Day step 4a — Promises: registry, check, self-hosting, page

## Goal

**A project can write down what its system promises, and a check refuses the
registry the moment a promise is declared and not guarded, cited and not
declared, or kept by a plan that no longer exists.**

Today this repo has dozens of structure promises (the single-definition
pins, `check-pointers`, the cleanup pins) that are enforced and never named;
nothing links a test to the commitment it guards, and no page shows what the
system has committed to. After this ADR ships, the package carries one
registry form and one check, this repo self-hosts three promises, the admin
lists every promise with its declared state, and every `enforced` chip is
drawn hollow — declared, not yet observed — because nothing in this step
observes anything.

## Y-Statement

**In the context of:**
Day's contract, where a plan establishes promises, preserves the promises
already in force that its change could break, and is free in how, and where
a promise carries a kind (behaviour, state, structure) that decides what
checks it.

**Facing:**
the need for one registry form that a human writes and reviews, a check that
is language-agnostic because extensions own tool facts, an admin that must
never render a health it has not observed, and a one-repo workbench where
the registry is plan-root state while code sites and tests are code-repo
facts.

**We decided for:**
a directory of markdown files under `.indusk/promises/` — one file per
promise and one per incident, frontmatter carrying the machine fields, the
body carrying the statement and its history — read by one library module
(`lib/promises/`) that the CLI, the MCP server and the admin all import
through a package subpath; explicit `sites:` and `tests:` paths in each entry
verified by the presence of one token form, `promise: <name>`, in the named
file; a per-kind link rule; four states including `declared`; domains
declared in `.indusk/config.json` and ensured on `update`; readable names
with an optional `aliases:` field so a citation written under an earlier
name still resolves.

**And against:**
a single registry document (concurrent plans conflict on one file, and
heading-prefix matching is a known bug class); a registry in the docs tree
(a publication, not plan-root state, and absent from a workbench's plan
root); a JSON registry (the registry is human-authored and reviewed in
diffs, like every other plan document); sequential ids; discovering links by
grep alone with no declared paths (a mention in prose then satisfies the
check); putting the promise unions into `lib/lifecycle.ts` (a promise's
state is not a plan position); and a `contract` field (a contract is a
plan's promises until something makes them differ).

**To achieve:**
a registry form any project can adopt through `indusk update` and a plan of
its own, a check that fails by name for every way the registry can lie, an
admin page that shows declared state and nothing more, and a foundation 4b
and 4c extend without reshaping.

**Accepting:**
that the check proves a test *names* a promise and not that it *validates*
it (binding is Day step 6); that `established`-lifetime promises retire by
hand; and that this repo's one behaviour promise stays hollow until Day
step 5's gate ledger exists.

**Because:**
one home per fact is this project's standing rule and every reader of plan
data already goes through one parser and one subpath; explicit paths plus a
token make the link a checked claim rather than a search result; a state
union pinned by the same parity test as the lifecycle's is how the admin
stays honest when a member is added; and drawing every chip hollow is the
same rule as the trajectory's — unverified is a verdict, not a pass.

## Context

The brief settles the model: promises predate tests, have two sources,
carry a kind and a lifetime, are registered when their breakage would need
a plan to reopen, and are owned by the plan that established them. The test
plan's 24 assertions are the contract this ADR must make satisfiable. The
planning half (promises declared by the planner, rows that establish or
preserve, confirmation at close, the change rule) is `day-contract`; the
telemetry half is `day-monitor`. This ADR decides only what those two will
stand on.

**Starting points.** The registry-and-validator shape is taken from an
existing implementation in one of the projects this system serves
(`looper`: `apps/docs/src/telemetry/expectations.md`, `failures.md`,
`backend/scripts/validate_expectations.py`, `backend/looper/telemetry/shape.py`),
used here as a reference for what to build, not as something this plan
changes. Two of its recorded defects shape decisions below: splitting one
document on heading prefixes read the wrong entry once ids passed nine
(hence one file per promise), and a prose mention satisfied "has a test"
until the check was narrowed to a named argument (hence declared paths plus a
token). A typed telemetry contract that asserts every declared span exists
(`numero`: `scripts/check-telemetry-contract.ts`) is the reference for what a
`structure` promise's build-time check looks like.

What this repo already has that the design reuses: config blocks ensured on
`update` (`papers.destinations`), the admin reading plans through the
`planning/plan-parser` subpath, label maps pinned with `satisfies Record<…>`
plus `lifecycle-render-parity.test.ts`, and `resolveExecutionRoots` for
"where is the plan, where is the code".

## Decision

### D1. The registry is a directory of markdown files at the plan root

`.indusk/promises/<name>.md`, one per promise; `.indusk/promises/incidents/<id>.md`,
one per incident. In a workbench the directory sits at the plan root
(`resolveExecutionRoots(planRoot).planRoot`), beside `.indusk/planning/`.

A promise file:

```markdown
---
name: phase-boundary-record-never-malformed
kind: state                # behaviour | state | structure
lifetime: holds            # holds | established
state: enforced            # declared | enforced | known-violated | retired
domain: planning
owner: lifecycle-rebalance # a plan folder, active or archived
aliases: []                # optional; earlier names that still resolve
sites:
  - apps/indusk-mcp/src/lib/shape/boundary.ts
tests:
  - apps/indusk-mcp/src/lib/shape/boundary.test.ts
incidents: []              # incident ids; required non-empty when known-violated
superseded_by:             # optional; set when retired by supersession
---

The phase-boundary record is never malformed: the writer refuses an append
with the same predicate every reader applies.

## History
- 2026-08-10 — first pinned by lifecycle-rebalance.
```

The first paragraph of the body is the statement. Everything the check reads
is frontmatter; the body is for people. Frontmatter is parsed with
gray-matter the way plan documents are, and malformed YAML is detected
structurally (the gray-matter-in-vitest gotcha), never by catching a throw.

An incident file:

```markdown
---
id: i-2026-09-15-gates-silently-off
promise: gates-ran-at-every-checkoff
source: desk               # local | smoke | deployed | desk
status: fixed              # open | fixed
date: 2026-09-15
---

## Symptom
Eight checkoffs passed a gate that had not loaded.

## Root cause
Hook commands registered relative to the session cwd.

## Fix
hook-cwd-independence: every hook registered by the project root.
```

Names are boundary values: kebab-case, segment-guarded through
`lib/path-segment.ts` before any path join, the file name equal to `name`.

Why a directory and not one document: a promise's history is then its file's
git log; two plans establishing promises at once touch different files; the
admin reads it the way it reads `.indusk/planning/`. Why not the docs tree:
docs are a build artifact and a publication, and a workbench's plan root
has no docs tree.

### D2. Links are declared paths verified by a token

Each entry lists `sites:` and `tests:` as paths relative to the code root.
The check verifies that each listed file exists and contains the token
`promise: <name>` (regex `\bpromise:\s*<name>\b`, so it sits in any comment
syntax, a docstring, a decorator argument or a helper call). It also scans
every file under the code root that is not ignored by git for the token and
requires every name found to be registered (A2) and not `retired` (A9).

The check proves a test **names** the promise. It does not prove the test
validates it — that is Day step 6, binding, and pretending otherwise is the
prose-mention hole. The testing extension may ship a helper
(`expects("name")`) whose only job is to carry the token; 4b's trace-shape
helper takes the name the same way.

Which listed files are "tests" is the entry's declaration, not a glob: a
`structure` promise's check script goes under `tests:` because it is a test
in the only sense the rule needs — it runs in the build and names the promise.

### D3. The per-kind link rule

| Kind | `enforced` requires | Rationale |
|---|---|---|
| `behaviour` | ≥1 site and ≥1 test | broken by inputs in a run; the site is where 4b's span mark goes |
| `state` | ≥1 site and ≥1 test | broken by a change to the code that produces the state |
| `structure` | ≥1 test; sites optional | "exactly one of X exists" often has no single site to mark |

`known-violated` requires ≥1 incident with `status: open` and is exempt from
links. `declared` is exempt from links while its owner plan is not archived
and fails once it is (A8). `retired` is exempt from everything except being
cited: a token naming a retired promise fails (A9), because the old name
must not keep reporting.

### D4. Four states, two lifetimes

`declared` is a state of its own, not `known-violated` with a reason: the
two mean different things to a reader (not built yet vs cannot be upheld
yet), render differently, and `day-contract` flips one and not the other at
close. `lifetime: established` is allowed to be `enforced` while its owner is
open and must be `retired` once the owner is archived (A13) — the same rule
as `declared`, from the other end. Retirement is by hand in this plan;
whether `day-contract` retires at green is its decision.

### D5. Domains are config, ensured on `update`

`promises.domains: string[]` in `.indusk/config.json`, ensured as an empty
list on `update` keyed on block presence, exactly as `papers.destinations`
is (A14). A promise whose domain is not listed fails naming the domain and
the list (A6); an empty list fails on the first promise saying where to
declare one. Domains live in config and not in the registry head because
the registry has no head — it is a directory.

### D6. One library, one subpath, three readers

`apps/indusk-mcp/src/lib/promises/` owns: `registry.ts` (read, parse,
`promiseProblem` / `incidentProblem` — the writer and every reader validate
with the same predicate, the boundary-record rule), `check.ts` (the
refusals, over `resolveExecutionRoots`), `vocabulary.ts` (`PROMISE_KINDS`,
`PROMISE_STATES`, `PROMISE_LIFETIMES`, `INCIDENT_SOURCES` as `as const`
tuples with derived unions). Exported as `@infinitedusky/indusk-mcp/promises/registry`
in `package.json` `exports`; the admin imports from there and never parses
the directory itself. The CLI is `indusk promises check` in
`src/bin/commands/promises.ts`; an MCP tool `list_promises` returns the
parsed registry for `/catchup` and the eval agent. The unions are pinned
single-definition by a count test, like the lifecycle's.

`indusk promises check` exits 2 on refusal and 0 on clean with a summary
(A11). The documented invocation is run verbatim in this repo's suite (A15) —
a library the skills call is not shipped until its documented command has
run.

### D7. This repo self-hosts three, one per kind

- `one-definition-per-shared-rule` — structure; tests: the
  `*-single-definition.test.ts` files; owner `dawn-verify`, the plan that
  wrote the first pin.
- `phase-boundary-record-never-malformed` — state; site
  `lib/shape/boundary.ts`, test its boundary tests; owner
  `lifecycle-rebalance`.
- `gates-ran-at-every-checkoff` — behaviour; site `hooks/check-gates.js`,
  test the hook-runner tests; owner `enforce-plan-gates`; hollow until Day
  step 5's gate ledger observes it.

Domains: `planning`, `gates`, `admin`. The registration rule is re-applied
to the brief's candidate table in Build Phase 1 and the result recorded
here before the check enforces it.

### D8. The Promises page and "holding N"

Route `/p/[project]/promises`, nav entry beside Scorecards in the root
layout header. A server component reads through the subpath (D6), renders a
table with the columns the test plan names, and a grouping control over
owner plan, domain, state and kind. Chip label and colour maps live in
`components/bars/labels.ts` as `satisfies Record<PromiseState, …>` and
`Record<PromiseKind, …>`, and `lifecycle-render-parity.test.ts` is extended
to render every member of both unions. Every `enforced` chip renders hollow
with the label "declared, not yet observed"; the page has no health axis at
all in this plan — not a hidden one, none — so A19 holds by construction.
`retired` rows are hidden behind a toggle. A malformed entry is an error
block naming the file and the field; no registry is an empty state saying
how to create one, like scorecards' "no `.indusk/eval/` yet".

"Holding N" is derived in the admin from the same read: the count of
promises whose `owner` is the plan and whose state is not `retired`,
rendered on the archived segment of the sidebar bars and the plan page. A
plan with none shows no count. No new lifecycle position.

### D9. Workbench

The check and the page both go through `resolveExecutionRoots`: the registry
from the plan root, sites and tests from the code root, and zero or several
declared repos refuse by name (A12), over the four layouts of the versioned
workbench helper. `.indusk/promises/` is written by people, so it is a plan
document and *not* machine state: it is registered with every "what changed"
detector (`phantom.ts`'s `isMachineState`, `shape/changed.ts`'s `isNotCode`,
`cleanup/oversized.ts`) in the commit that first writes it, as "not code",
never as "excluded". No `merge=union`: one file per promise makes concurrent
appends rare and a conflict readable.

## Alternatives Considered

### The registry in the docs tree
Rejected: docs are a build artifact and a publication; the plan root is
where plan documents live and is the only root a workbench guarantees.

### One registry document with headings
Rejected: concurrent plans conflict on one file; splitting on heading
prefixes is a recorded bug class in the starting-point implementation; a
promise's history is cleaner as its file's log.

### JSON or JSONL registry
Rejected: the registry is human-written and reviewed in diffs, like every
plan document; JSONL is this project's shape for machine state, and the
registry is not machine state.

### Sequential ids
Rejected: Day's shape says readable names; an optional `aliases:` field
keeps a citation written under an earlier name resolvable at no cost.

### Links discovered by grep alone
Rejected: a mention in prose satisfies a bare grep; declared paths make each
link a checked claim, and the reverse scan still catches an unregistered
name anywhere.

### Promise unions inside `lib/lifecycle.ts`
Rejected: positions are where a plan stands; a promise's state is not one.
Same pin, separate module, so the lifecycle's single-definition count does
not absorb a second vocabulary.

### A `contract` field
Rejected until a promise can belong to a contract that is not its plan.
"By contract" equals "by plan" on the page.

### Domains as a free tag
Already rejected in the brief (Sandy, 2026-09-17): decided in planning, an
unknown domain fails.

## Consequences

### Positive
- One registry form, language-agnostic by construction (paths and a token),
  checked by one command, adoptable by any project through `indusk update`
  and a plan of its own.
- Every way the registry can lie has a named refusal; a clean registry
  prints what it holds.
- The admin cannot render an unobserved health; adding a state without a
  chip fails the build.
- 4b adds a span mark and a health axis, 4c adds planner and trajectory
  integration, without changing the file shape.

### Negative
- The form is proven on this repo's own three promises; the first adoption
  elsewhere is where the twelve-defects-in-an-hour class shows up, and that
  is a later plan's.
- The token form is a convention, not a type; a typo in a comment is a
  missing link the check reports as such, which is correct but noisy.
- "Holding N" counts `declared` promises too, so a plan looks on the hook for
  something it has not built; that is the honest reading and 4c is where it
  resolves.

### Risks
- **The registry duplicates the trajectory.** Mitigated by the registration
  rule, re-applied in Build Phase 1 and recorded here; a row *preserving* a
  promise cites it and never creates one.
- **A test names a promise and validates nothing.** Accepted and named: the
  check proves linkage, step 6 proves binding.
- **The admin's read of a large registry on every request.** The page is
  request-time like every admin page; a registry is tens of files, not
  thousands. Revisit if a project passes a few hundred.

## Documentation Plan

### Pages
- New: `reference/cli/promises.md` — `indusk promises check`, the file
  shapes, the refusals, the exit codes.
- New: `guide/promises.md` — what a promise is, the three kinds, the two
  lifetimes, the four states, the registration rule, and this repo's three
  as worked examples.
- Update: `guide/plan-lifecycle.md` — the "Expectations … sketched in the
  `midnight` brief" line becomes promises with a pointer; the "two
  authorities" section stays.
- Update: `reference/admin-ui/overview.md` — the Promises page and "holding N".
- Update: `reference/tools/indusk-mcp.md` — `list_promises`.

### Diagrams
- One Mermaid state diagram of the four states and the transitions this
  plan allows by hand (`declared → enforced | known-violated`, `→ retired`),
  in `guide/promises.md`.

### Changelog
- "Added `.indusk/promises/` and `indusk promises check`: a registry of
  what the system promises, with kinds, states, domains and owners, refused
  by name when it lies; the admin's Promises page; dusk self-hosts three."

### ADR in Docs
- Yes: `decisions/day-promises.md`, and the sidebar entry with it.

## References
- [brief.md](brief.md), [test-plan.md](test-plan.md)
- [`day-monitor`](../day-monitor/brief.md), `day-contract` (proposed in the
  brief; created when this plan closes)
- [`pr-shape.md`](../indusk-v4-day/pr-shape.md), artifact 9
- `apps/indusk-mcp/src/lib/worktree/roots.ts` — `resolveExecutionRoots`
- `apps/indusk-mcp/src/lib/shape/boundary.ts` — the writer-validates-with-the-reader's-predicate rule
- `apps/indusk-mcp/src/lib/papers/config.ts` — the ensured-on-update config block pattern
- `apps/indusk-admin/src/components/bars/labels.ts`, `lifecycle-render-parity.test.ts` — the render pin
- Starting points (reference only): `looper` — `apps/docs/src/telemetry/expectations.md`,
  `failures.md`, `backend/scripts/validate_expectations.py`,
  `backend/looper/telemetry/shape.py`; `numero` — `scripts/check-telemetry-contract.ts`
