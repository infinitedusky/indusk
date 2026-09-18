---
title: "Day step 4a — Promises — Implementation"
date: 2026-09-18
status: draft
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Day step 4a — Promises — Implementation

## Goal

A project can write down what its system promises under `.indusk/promises/`,
`indusk promises check` refuses the registry by name the moment it lies,
this repo self-hosts three promises (one per kind) with the check in its own
suite, and the admin's Promises page lists every promise with its declared
state and every `enforced` chip hollow. The ADR's nine decisions, built in
four phases after one test phase.

## Scope

### In Scope
- `apps/indusk-mcp/src/lib/promises/` — vocabulary, registry read, the check
- `indusk promises check` (CLI), `list_promises` (MCP), the package subpath
- `promises.domains` in config, ensured on `update`
- This repo's three promises and their tokens
- The admin Promises page, chip maps, parity pin, "holding N"
- Docs: `reference/cli/promises.md`, `guide/promises.md`, plan-lifecycle,
  admin overview, MCP tools reference, ADR page, changelog

### Out of Scope
- The span mark, health of any kind, `indusk promises status` — `day-monitor`
- Planner questions, rows that establish/preserve, confirmation at close,
  the change rule, the per-plan Promises section — `day-contract`
- Automatic retirement of `established` promises at green — `day-contract`
- Any change to a repository other than this one

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `promises-check.test.ts`, `promises-workbench.test.ts`, `promises-cli.test.ts`, `promises-single-definition.test.ts`, `promises-detectors.test.ts`, `http-project-promises.test.ts`, `helpers/promises-fixture.ts`; RED | `helpers/cli.ts` (`runCli`, `REPO_ROOT`), `helpers/versioned-workbench.ts` (`LAYOUTS`), `helpers/git-tmp-project.ts`, admin `__tests__/helpers/next-dev.ts` |
| Build Phase 1 | `lib/promises/{vocabulary,registry,check}.ts`, `bin/commands/promises.ts`, MCP `list_promises`, `exports["./promises/registry"]` | `resolveExecutionRoots`, `lib/path-segment.ts`, gray-matter, `lib/git.ts` |
| Build Phase 2 | `lib/promises/config.ts` + the `update` ensure; docs pages | `ensurePapersConfig` pattern; the detectors as they stand |
| Build Phase 3 | `.indusk/promises/*.md` ×3, `incidents/` ×1, tokens in sites and tests, `promises.domains` here | Build Phase 1's check, `skill-sync-parity` |
| Build Phase 4 | admin route, `components/Promises.tsx`, `lib/promises-reader.ts`, label maps, parity extension, "holding N" | the subpath from Build Phase 1, `bars/labels.ts`, `lifecycle-render-parity.test.ts` |

## Test Trajectory

Test paths are repo-root-relative. Rows A1–A24 mirror the test plan; A25 and
A26 are structural pins the ADR adds (D6, D9).

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | In a project with no registry, `indusk promises check` exits non-zero and names the path where one is expected; never reports clean | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A2 | A `promise: <name>` token in code or a test with no registry entry fails, naming the file and the name | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A3 | An `enforced` `behaviour` or `state` promise with no test naming it, or no site naming it, fails naming the promise and the missing link | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A4 | An `enforced` `structure` promise with no test fails; one with a test and no site passes | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A5 | A `known-violated` promise with no open incident fails; one with an open incident passes with no site and no test | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A6 | A domain not in `promises.domains` fails naming the domain and the list; an empty list fails on the first promise saying where to declare one | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A7 | An owner that is not a plan folder (active or archived) fails naming the owner | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A8 | A `declared` promise passes with no links while its owner is not archived and fails once the owner is archived | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A9 | A token naming a `retired` promise fails naming the file | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A10 | An entry missing kind, state, statement or owner, or with malformed frontmatter, fails naming the entry; it is never skipped | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A11 | A clean registry exits 0 and prints promises by state and by kind, and the incident count | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A12 | In a one-repo workbench the registry is read from the plan root and sites/tests from the code root, over every layout; zero or several declared repos refuse by name | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-workbench.test.ts |
| A13 | An `established`-lifetime promise still `enforced` after its owner is archived fails naming it; the same promise passes while the owner is open | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A14 | `indusk update` on a project without the block writes `promises.domains: []` and nothing else; a second run writes nothing; no check runs unless invoked | Test Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/src/__tests__/promises-cli.test.ts |
| A15 | This repo holds three promises, one per kind, and `indusk promises check` at the repo root exits 0 as part of `pnpm test` | Test Phase 1 | Build Phase 3 | planned | apps/indusk-mcp/src/__tests__/promises-cli.test.ts |
| A16 | An incident carries promise, source (one of four), status, date, and `## Symptom` / `## Root cause` / `## Fix` sections; one missing a field or with an unknown source fails naming the incident | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-check.test.ts |
| A17 | `/p/<project>/promises` responds 200 with a Promises entry in the project nav and one row per registry promise carrying name, statement, kind, domain, owner and state | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-project-promises.test.ts |
| A18 | Grouping by owner plan, domain, state and kind shows every promise exactly once per grouping | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/Promises.test.tsx |
| A19 | Every `enforced` promise renders a hollow chip labelled "declared, not yet observed"; no element on the page carries an upheld or violated health | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/Promises.test.tsx |
| A20 | A `known-violated` chip shows its incident; a `declared` chip is outlined; `retired` rows are hidden by default and shown by a toggle | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/Promises.test.tsx |
| A21 | Every promise state and kind has a label and colour; a member added to either union without one fails the parity test naming the member | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/lib/lifecycle-render-parity.test.ts |
| A22 | An archived plan owning promises shows "holding N" on its archived segment in the sidebar and plan page; one owning none shows no count | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/Promises.test.tsx |
| A23 | A malformed entry renders an error block naming the file and the field, never an empty table; a project with no registry renders an empty state saying how to create one | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-project-promises.test.ts |
| A24 | An entry added to the registry appears on the next request with no restart | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-project-promises.test.ts |
| A25 | Exactly one definition of the promise vocabulary (`PROMISE_STATES`, `PROMISE_KINDS`, `PROMISE_LIFETIMES`, `INCIDENT_SOURCES`) exists under `src/`, in `lib/promises/vocabulary.ts` | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-single-definition.test.ts |
| A26 | A file under `.indusk/promises/` is not code to Shape's changed-files scope, not machine state to phantom detection, and not a decomposition candidate to the cleanup scan | Test Phase 1 | Test Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-detectors.test.ts |

### Deferred Verification

None.

## Checklist

### Test Phase 1: Author every assertion RED

**Goal**: every row exists as a test and fails on its own claim before any
promise code exists. Rows A1–A16 and A25 go through the CLI boundary
(`runCli` spawns the built binary; an unknown subcommand is a non-zero exit
before any assertion of ours runs, so the red is real and no file fails to
load). A17, A23 and A24 hit a route that 404s today. A18–A22 import a
component and unions that do not exist yet, so they are deferred with their
bodies reviewed.

- [ ] Create/confirm this plan's worktree (`git worktree add ../dusk-worktrees/day-promises -b plan/day-promises` — dusk is normal-mode, so `indusk worktree create` does not apply) — worktree-per-plan default; skip only if `worktree: none` in frontmatter. Then `pnpm --filter indusk-admin build && node apps/indusk-mcp/scripts/bundle-admin.js` there, because a fresh worktree has no admin bundle and nine daemon tests plus the tarball test fail without it
- [ ] `src/__tests__/helpers/promises-fixture.ts`: builds a temp project (`git init`, `.indusk/config.json` with `promises.domains`, plan folders under `.indusk/planning/` and `archive/` for owners, `.indusk/promises/<name>.md` and `incidents/<id>.md` from small object literals, code and test files that carry or omit the `promise: <name>` token). One builder, every row's precondition; it throws when it cannot establish one
- [ ] `src/__tests__/promises-check.test.ts`: A1–A11, A13, A16 through `runCli(dir, ["promises", "check"])` — each case asserts the exit code AND that stderr names what the row says it names (a refusal message is a factual claim); A11 asserts the summary lines
- [ ] `src/__tests__/promises-workbench.test.ts`: A12 over `LAYOUTS` from `helpers/versioned-workbench.ts` — the registry at the workbench root, the token in the code repo; plus the zero-repos and two-repos refusals by name
- [ ] `src/__tests__/promises-cli.test.ts`: A14 via `runCli(dir, ["init", "--local", "--no-index"])` then `update` twice, reading `.indusk/config.json` between runs and asserting nothing else in the file changed; A15 via `runCli(REPO_ROOT, ["promises", "check"])` asserting exit 0 and three promises in the summary, one per kind
- [ ] `src/__tests__/promises-single-definition.test.ts`: A25 — count definitions of each vocabulary tuple across `src/`, assert exactly one, in `lib/promises/vocabulary.ts` (zero today, so red)
- [ ] `src/__tests__/promises-detectors.test.ts`: A26 through the public functions — Shape's changed-files scope for a phase excludes `.indusk/promises/x.md`; phantom detection with a diff touching `impl.md` plus a promise file reports no phantom (the file counts as work); the cleanup scan lists nothing under `.indusk/promises/`
- [ ] `apps/indusk-admin/src/__tests__/http-project-promises.test.ts`: A17, A23, A24 through `__tests__/helpers/next-dev.ts` against a temp project registered in a temp `INDUSK_HOME` — one file, serial (`fileParallelism: false` is load-bearing); A24 writes a second promise file between two requests
- [ ] Run every file; record each red's message; set A1–A17, A23–A26 to `written` (A26 to `passing`, see Regression Guards)

#### Deferred to Build Phase 4

- **A18, A19, A20, A22** — their subject is `components/Promises.tsx` (and the bars' "holding N" prop), which Build Phase 4 introduces; the file would fail to load, and a hand-written prop on an existing component would turn `typecheck.test.ts` red for the wrong reason. Bodies reviewed:

  ```tsx
  // apps/indusk-admin/src/components/Promises.test.tsx (vitest browser project)
  import { render, screen, within } from "@testing-library/react";
  import { PromisesTable } from "@/components/Promises";
  import { ArchivedSegment } from "@/components/bars/ProgressLines";
  import { promises } from "./fixtures/promises"; // 6 promises: 2 enforced, 1 declared, 1 known-violated (1 incident), 1 retired, 1 established+enforced

  // A18: every grouping shows every non-retired promise exactly once
  for (const by of ["owner", "domain", "state", "kind"] as const) {
    render(<PromisesTable promises={promises} groupBy={by} />);
    expect(screen.getAllByRole("row", { name: /promise/ })).toHaveLength(5);
  }
  // A19: enforced → hollow, and nothing on the page says upheld/violated
  expect(screen.getAllByLabelText("declared, not yet observed")).toHaveLength(3); // 2 enforced + 1 established
  expect(screen.queryByText(/upheld|violated in window/)).toBeNull();
  // A20: known-violated shows its incident; declared is outlined; retired behind a toggle
  expect(within(row("seat-never-double-booked")).getByText(/i-2026-/)).toBeVisible();
  expect(chip("boundary-record-never-malformed")).toHaveAttribute("data-state", "declared");
  expect(screen.queryByText("old-name")).toBeNull();
  await user.click(screen.getByRole("button", { name: /show retired/ }));
  expect(screen.getByText("old-name")).toBeVisible();
  // A22: holding N on the archived segment; none → no count
  render(<ArchivedSegment plan="lab" holding={3} />); expect(screen.getByText("holding 3")).toBeVisible();
  render(<ArchivedSegment plan="empty" holding={0} />); expect(screen.queryByText(/holding/)).toBeNull();
  ```

- **A21** — extends `lifecycle-render-parity.test.ts` to import `PROMISE_STATES` and `PROMISE_KINDS` from the subpath and render each through the label maps; the import does not resolve before Build Phase 4 wires the subpath into the admin. Body reviewed:

  ```ts
  import { PROMISE_KINDS, PROMISE_STATES } from "@infinitedusky/indusk-mcp/promises/registry";
  import { promiseKindLabel, promiseStateChip } from "@/components/bars/labels";
  for (const s of PROMISE_STATES) expect(promiseStateChip[s], `no chip for promise state ${s}`).toBeDefined();
  for (const k of PROMISE_KINDS) expect(promiseKindLabel[k], `no label for promise kind ${k}`).toBeDefined();
  ```

#### Regression Guards

- **A26** — passes the moment it is authored because the blanket `.indusk/` rules in Shape's scope and the cleanup scan, and phantom's narrow machine-state list, already classify a promise file as "a plan document, not code, not machine state". The guard pins that classification so a later narrowing of those rules (registering the directory by name, as the ADR's D9 requires) keeps it; the item in Build Phase 2 makes the registration explicit under this row

#### Test Phase 1 Verification
- [ ] `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/promises-check.test.ts src/__tests__/promises-workbench.test.ts src/__tests__/promises-cli.test.ts src/__tests__/promises-single-definition.test.ts src/__tests__/promises-detectors.test.ts`; then `cd` back — every CLI case red as commander's unknown-command exit where 0 or 2 was asserted, A25 red on count 0, A26 green
- [ ] `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-project-promises.test.ts --project node`; then `cd` back — A17, A23, A24 red on 404
- [ ] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?
- [ ] Rows A1–A17, A23–A25 set to `written`; A26 to `passing`

#### Test Phase 1 Context
- [ ] Known Gotchas, the versioned-workbench helper entry: tests that need a promise-bearing project use `src/__tests__/helpers/promises-fixture.ts` (one builder for registry, incidents, owners, tokens; throws when a precondition cannot be established) — beside `papers-fixture.ts` and `versioned-workbench.ts`

#### Test Phase 1 Document
- [ ] `apps/docs/src/guide/promises.md` opened with the concept half, which needs no code: what a promise is, the three kinds, the two lifetimes, the four states, the registration rule with the brief's candidate table; a "how to write one" section marked "lands with Build Phase 1"; sidebar entry under Guide

### Build Phase 1: The registry and the check

**Goal**: `lib/promises/` reads a registry and refuses every lie by name; the CLI and MCP surfaces exist; the subpath is exported.

- [ ] `lib/promises/vocabulary.ts`: `PROMISE_KINDS = ["behaviour","state","structure"] as const`, `PROMISE_STATES = ["declared","enforced","known-violated","retired"] as const`, `PROMISE_LIFETIMES = ["holds","established"] as const`, `INCIDENT_SOURCES = ["local","smoke","deployed","desk"] as const`, `INCIDENT_STATUSES = ["open","fixed"] as const`, unions derived; `PROMISE_TOKEN = (name) => new RegExp(String.raw`\bpromise:\s*${escape(name)}\b`)`
- [ ] `lib/promises/registry.ts`: `Promise`/`Incident` types; `promisesDir(planRoot)`; `readPromises(planRoot): Registry | RegistryProblem` — every `*.md` under `.indusk/promises/` and `incidents/`, gray-matter with structural malformed-YAML detection, `promiseProblem(value)` / `incidentProblem(value)` naming the first missing or invalid field (kind, state, lifetime, statement = first body paragraph, owner, domain, sources, sections), `name` must equal the file stem and pass `lib/path-segment.ts`; a problem in any file is a `RegistryProblem` naming file and field, never a skipped entry
- [ ] `lib/promises/check.ts`: `checkPromises(planRoot): CheckResult` — roots via `resolveExecutionRoots` (refusal passes through by name); no registry dir → refusal naming `<planRoot>/.indusk/promises/`; domains from `readConfig(planRoot).promises?.domains` (absent/empty → refusal on the first promise naming the config key); owner must be a folder under `.indusk/planning/` or `archive/`; per-kind link rule (D3) with `declared`/`established` archived-owner rules (D4); every `sites:`/`tests:` path exists under the code root and contains the token; reverse scan over `git ls-files --cached --others --exclude-standard` in the code root for `\bpromise:\s*[a-z0-9-]+` — every hit registered and not retired; incidents referenced exist, `known-violated` has an open one; result carries `refusals: {file, message}[]` and a `summary` (by state, by kind, incidents)
- [ ] `src/bin/commands/promises.ts`: `indusk promises check [--root <dir>]` — prints each refusal as `path: message`, exit 2; clean prints the summary, exit 0; registered in `bin/cli.ts` beside `papers`
- [ ] MCP `list_promises` beside `list_plans`: returns the parsed registry or the problem; no filtering
- [ ] `package.json` `exports["./promises/registry"]` → `dist/lib/promises/registry.js` (+ types), re-exporting the vocabulary; `src/index` untouched
- [ ] Shape (Build Phase 1): review `lib/promises/*` and the command against the enabled extensions' craft rules; record findings as items here or "nothing to change"

#### Build Phase 1 Verification
- [ ] A1–A13, A16 green: `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/promises-check.test.ts src/__tests__/promises-workbench.test.ts`; then `cd` back — grep `dist/lib/promises/check.js` for `PROMISE_TOKEN` first, because a build that returns 0 without rebuilding leaves these red against stale output
- [ ] A25 green: `pnpm exec vitest run src/__tests__/promises-single-definition.test.ts`
- [ ] The documented invocation run verbatim on a temp project from the fixture: `indusk promises check` prints a summary and exits 0; the same with a missing token exits 2 naming the file
- [ ] Full mcp suite green: `cd apps/indusk-mcp && pnpm exec vitest run`; then `cd` back
- [ ] Rows A1–A13, A16, A25 set to `passing`

#### Build Phase 1 Context
- [ ] Architecture, indusk-mcp bullet: `indusk promises check` and `lib/promises/` (registry read + check, one subpath `promises/registry` the admin reads through); the token form `promise: <name>`; the check proves a test names a promise, binding is step 6

#### Build Phase 1 Document
- [ ] `apps/docs/src/reference/cli/promises.md`: the command, the promise and incident file shapes from the ADR, every refusal with its message, exit codes; sidebar entry after `papers`
- [ ] `apps/docs/src/reference/tools/indusk-mcp.md`: `list_promises`
- [ ] `apps/docs/src/guide/promises.md`: the "how to write one" section filled

### Build Phase 2: Config, detectors, decision record

**Goal**: a project that has not adopted is untouched beyond an empty domains list; the registry directory is registered by name with every "what changed" detector; the ADR and lifecycle docs say what shipped.

- [ ] `lib/promises/config.ts`: `ensurePromisesConfig(projectRoot)` in `ensurePapersConfig`'s shape (`"added" | "already-set" | "no-config"`), wired into `update.ts` through the shared ensure helper (the one that replaced the three if/else blocks) with its two messages; `config.ts` gains `promises?: { domains: string[] }` with a doc comment
- [ ] D9 made explicit: `.indusk/promises/` named in Shape's `isNotCode`-equivalent, phantom's machine-state predicate (as NOT machine state, with a comment saying why), and the cleanup scan's `.indusk/` rule — each with a one-line comment pointing at this plan; `.gitattributes` untouched (no `merge=union`, one file per promise)
- [ ] ADR "Decision" D7: the registration rule re-applied to the brief's candidate table with the outcome recorded (five in, three out) — done now so the record exists before this repo's promises are written in Build Phase 3
- [ ] Shape (Build Phase 2): review the files this phase changed; record findings or "nothing to change"

#### Build Phase 2 Verification
- [ ] A14 green: `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/promises-cli.test.ts -t "A14"`; then `cd` back
- [ ] A26 still green with the explicit registration: `pnpm exec vitest run src/__tests__/promises-detectors.test.ts`
- [ ] `update` tests still green: `pnpm exec vitest run src/__tests__/update*.test.ts src/__tests__/hook-cwd-independence.test.ts`
- [ ] Rows A14 set to `passing`

#### Build Phase 2 Context
- [ ] Conventions: `.indusk/promises/` is a plan document — written by people, not code (Shape and cleanup skip it), not machine state (phantom counts it as work); `promises.domains` is ensured on `update`, empty, like `papers.destinations`

#### Build Phase 2 Document
- [ ] `apps/docs/src/guide/plan-lifecycle.md`: the "Expectations … sketched in the `midnight` brief" line becomes promises with a pointer to `/guide/promises`
- [ ] `apps/docs/src/decisions/day-promises.md`: the ADR published; sidebar entry under Decisions

### Build Phase 3: This repo self-hosts three

**Goal**: dusk holds one promise per kind, every link carries its token, and the check runs in `pnpm test`.

- [ ] `.indusk/config.json`: `promises.domains: ["planning", "gates", "admin"]`
- [ ] `.indusk/promises/one-definition-per-shared-rule.md` — structure, holds, domain `planning`, owner `dawn-verify`; `tests:` the six `*-single-definition.test.ts` files plus `shape/shared-definitions.test.ts`; each gains a one-line `// promise: one-definition-per-shared-rule` comment
- [ ] `.indusk/promises/phase-boundary-record-never-malformed.md` — state, holds, domain `planning`, owner `lifecycle-rebalance`; site `apps/indusk-mcp/src/lib/shape/boundary.ts` (token beside `boundaryRecordProblem`), tests `lib/shape/boundary.test.ts` and `boundary-writer.test.ts`
- [ ] `.indusk/promises/gates-ran-at-every-checkoff.md` — behaviour, holds, domain `gates`, owner `enforce-plan-gates`; site `apps/indusk-mcp/hooks/check-gates.js` (token in its header comment — then resync `.claude/hooks/check-gates.js` by hand, `skill-sync-parity` pins byte-equality), test: the existing test that runs `check-gates.js` through `helpers/hook-runner.ts` (locate it; if none runs the hook end to end, add one small case that does and name it); `incidents: [i-2026-09-15-gates-silently-off]` with `status: fixed` and the ADR's body (source `desk`)
- [ ] Root `package.json` `test` script (or the turbo `test` task) runs `indusk promises check` at the repo root after vitest — the documented command, verbatim, not a library import
- [ ] Shape (Build Phase 3): review the promise files and the token placements; record findings or "nothing to change"

#### Build Phase 3 Verification
- [ ] A15 green: `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/promises-cli.test.ts -t "A15"`; then `cd` back — summary shows 3 promises: 1 behaviour, 1 state, 1 structure, all `enforced`, 1 incident
- [ ] `pnpm test` at the root green end to end, including the check; `pnpm exec vitest run src/__tests__/skill-sync-parity.test.ts` green after the hook resync
- [ ] Row A15 set to `passing`

#### Build Phase 3 Context
- [ ] Current State (in flight) and Conventions: this repo holds three promises (`one-definition-per-shared-rule`, `phase-boundary-record-never-malformed`, `gates-ran-at-every-checkoff`); a new shared-definition pin adds itself to the first promise's `tests:`; `indusk promises check` runs in `pnpm test`

#### Build Phase 3 Document
- [ ] `apps/docs/src/guide/promises.md`: this repo's three as worked examples, one per kind, including the hollow behaviour promise and why
- [ ] `apps/docs/src/changelog.md` Unreleased: the promises entry from the ADR's Documentation Plan

### Build Phase 4: The Promises page

**Goal**: the admin lists every promise with its declared state, every `enforced` chip hollow, "holding N" on archived plans; a bad registry is an error block, none is an empty state.

- [ ] `apps/indusk-admin/src/lib/promises-reader.ts`: reads through `@infinitedusky/indusk-mcp/promises/registry` (`readPromises(projectRoot)`), returns the registry or the problem; `holdingCount(registry, plan)` = owner match and state ≠ `retired`; one home, pinned by `cleanup-pins.test.ts`'s convention
- [ ] `app/p/[project]/promises/page.tsx` in `scorecards/page.tsx`'s shape (stale-project handling identical); nav entry "Promises" beside Scorecards in `app/p/[project]/layout.tsx`
- [ ] `components/Promises.tsx`: `PromisesTable` with the columns (chip, name, statement, kind, domain, owner, sites, tests, incidents), `groupBy` over owner/domain/state/kind, a "show retired" toggle, `PromiseChip` with `data-state`; `known-violated` rows render their incident ids; **no health prop, no health rendering** — the type has no such field
- [ ] `components/bars/labels.ts`: `promiseStateChip` (`enforced` → hollow, aria-label "declared, not yet observed"; `known-violated` → amber; `retired` → grey; `declared` → outlined) `satisfies Record<PromiseState, …>`; `promiseKindLabel` `satisfies Record<PromiseKind, string>`; `lifecycle-render-parity.test.ts` extended (A21's body)
- [ ] "Holding N": `ArchivedSegment` (or the archived segment's renderer in `bars/ProgressLines`) takes `holding` and renders "holding N" when > 0; `PlanList` and the plan page pass `holdingCount` from the reader
- [ ] Error and empty states: a `RegistryProblem` renders the existing error-block component naming file and field; no directory renders an empty state naming `.indusk/promises/` and pointing at `/reference/cli/promises`
- [ ] `components/Promises.test.tsx` authored from the deferred bodies (A18, A19, A20, A22); `typecheck.test.ts` green
- [ ] Shape (Build Phase 4): review the components and reader; record findings or "nothing to change"

#### Build Phase 4 Verification
- [ ] A18–A22 green: `cd apps/indusk-admin && pnpm exec vitest run src/components/Promises.test.tsx src/lib/lifecycle-render-parity.test.ts`; then `cd` back
- [ ] A17, A23, A24 green: `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-project-promises.test.ts --project node` (no other dev server on the app dir); then `cd` back
- [ ] Admin suite green including `typecheck.test.ts`, `cleanup-pins.test.ts`, `component-reuse-audit.test.ts`: `cd apps/indusk-admin && pnpm exec vitest run`; then `cd` back
- [ ] Manual smoke: `indusk ui restart`, open this project's Promises page, three rows, three hollow chips, "holding 1" on `dawn-verify`, `lifecycle-rebalance`, `enforce-plan-gates` in the sidebar; screenshot in the retrospective
- [ ] Rows A17–A24 set to `passing`

#### Build Phase 4 Context
- [ ] Known Gotchas, the admin entry: the Promises page reads through the `promises/registry` subpath and never parses the directory; chip maps in `bars/labels.ts` are `satisfies Record<PromiseState|PromiseKind,…>` and the parity test names a missing one; "holding N" is derived in `lib/promises-reader.ts`, no lifecycle position

#### Build Phase 4 Document
- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the Promises page (columns, groupings, chips, why every enforced chip is hollow, the error and empty states) and "holding N"
- [ ] `apps/docs/src/changelog.md` Unreleased: the admin half of the entry

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/{vocabulary,registry,check,config}.ts` | new |
| `apps/indusk-mcp/src/bin/commands/promises.ts`, `src/bin/cli.ts` | new command |
| `apps/indusk-mcp/src/server/*` (tools) | `list_promises` |
| `apps/indusk-mcp/package.json` | `exports["./promises/registry"]` |
| `apps/indusk-mcp/src/lib/config.ts`, `src/bin/commands/update.ts` | `promises.domains` ensured |
| `apps/indusk-mcp/src/lib/verify/phantom.ts`, `lib/shape/changed.ts`, `lib/cleanup/oversized.ts` | `.indusk/promises/` named |
| `apps/indusk-mcp/hooks/check-gates.js`, `.claude/hooks/check-gates.js` | token comment, resynced |
| `apps/indusk-mcp/src/lib/shape/boundary.ts`, six `*-single-definition.test.ts`, `shape/shared-definitions.test.ts`, boundary tests | token comments |
| `apps/indusk-mcp/src/__tests__/promises-*.test.ts`, `helpers/promises-fixture.ts` | new |
| `.indusk/config.json`, `.indusk/promises/*.md`, `.indusk/promises/incidents/*.md` | this repo's three |
| `package.json` (root) or `turbo.json` | the check in `test` |
| `apps/indusk-admin/src/app/p/[project]/promises/page.tsx`, `layout.tsx` | new route, nav |
| `apps/indusk-admin/src/components/Promises.tsx`, `Promises.test.tsx`, `bars/labels.ts`, `bars/ProgressLines.tsx`, `PlanList.tsx` | page, chips, holding N |
| `apps/indusk-admin/src/lib/promises-reader.ts`, `lib/lifecycle-render-parity.test.ts`, `__tests__/http-project-promises.test.ts` | reader, pin, smoke |
| `apps/docs/src/{guide/promises,reference/cli/promises,decisions/day-promises}.md`, `guide/plan-lifecycle.md`, `reference/admin-ui/overview.md`, `reference/tools/indusk-mcp.md`, `changelog.md`, `.vitepress/config.ts` | docs |
| `CLAUDE.md` | Context items above |

## Dependencies

- admin-ui-phase-progress (closed): `bars/labels.ts`, the parity test, `LiveRefresh`
- `resolveExecutionRoots`, `helpers/versioned-workbench.ts`, `helpers/cli.ts`
- A built `dist/` in the worktree for every CLI-boundary row; the admin bundle for the daemon tests

## Notes

- The check's reverse scan uses `git ls-files --cached --others --exclude-standard` so an untracked, un-ignored file with a token is seen and an ignored one is not; a non-git code root is a refusal, not an empty scan.
- Message text in refusals is asserted, not just exit codes: a correct decision to refuse can still carry a wrong path.
- If Build Phase 1's Shape review or the fixture work surfaces that `Promise` as a type name collides with the global `Promise`, the type is `PromiseEntry` from the start; the file and CLI vocabulary stay "promise".
- No OTel gates: this project is `otel.role: library`.
