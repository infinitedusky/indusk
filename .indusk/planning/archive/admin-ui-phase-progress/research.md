---
title: "Admin UI Phase Progress — Research"
date: 2026-09-16
status: complete
---

# Admin UI Phase Progress — Research

## Question

The brief (2026-09-03, revised 2026-09-14/15/16) claims the admin UI cannot
show which phase is active or how far it is, that its phase parser has
drifted from the package's, and that nothing on the page is live. It proposes
three progress bars (phase, plan, master) derived from the lifecycle
definition rather than from which documents exist. What does the code
actually do today, what shared machinery already exists to derive those bars
from, and what has to be added?

Survey date 2026-09-16, `main` at `4558947a`. Line numbers are as of that
commit.

## Findings

### 1. The admin's phase parser is a private copy, and it is blind to the current impl shape

`apps/indusk-admin/src/lib/phases.ts` (157 lines) carries its own heading
regex:

```ts
const PHASE_HEADING_RE = /^###\s+Phase\s+(\d+)(?::\s*(.*))?$/m;   // line 29
```

Consequences, each confirmed by reading `extractPhases` (lines 39–75):

- `### Test Phase N` and `### Build Phase N` do not match. Neither matches
  the level-2 stop condition either, so **both are absorbed into the previous
  phase's `content`**. Every impl authored since test-phase-structure
  (2026-08-12) renders with its Test Phase 1 folded into the preamble and
  every Build Phase folded into Phase 1. This is the brief's "test phases are
  invisible or bleed into neighbors", confirmed and worse than stated: the
  Build phases bleed too.
- Gate headings (`#### Phase N Verification|Context|Document|OTel`) are not
  parsed at all; they fall through into the raw markdown (the file's own doc
  comment, lines 10–14, says so).
- Trajectory rows are matched to phases by `row.passesAt === raw.number`
  (line 82) — bare number, ignoring `passesAtKind`, so a row passing at Test
  Phase 1 is attributed to Build Phase 1.
- The checkbox regex (line 142) is column-0, lowercase `x`, no nesting.

Importers: 5 files (`PlanDetail.tsx`, `FalsificationSection.tsx`,
`lib/markdown-export.ts`, and the two tests). `PhasesSection` is a local
function inside `PlanDetail.tsx` (lines 245–310), rendering each phase as a
`CollapsibleSection` with a trajectory table and `<Markdown>{phase.content}</Markdown>`.

The package's canonical vocabulary lives in `apps/indusk-mcp/src/lib/impl-headings.ts`:
`PHASE_HEADING` (`### [Build ]Phase N`), `TEST_PHASE_HEADING`, `ANY_PHASE_HEADING`,
`parsePhaseHeading`, `PhaseRef {kind, number}`, `fencedLineMask`, `phaseSequence`,
`phaseOrdinal`. `impl-parser.ts` builds on it: `ImplPhase {number, kind, ordinal,
name, gates, blocker, forwardIntelligence}` (lines 24–42) with
`gates: {type, items: {text, checked}[]}`. That is already the richest phase
model in the repository, and it is the one the hooks, the run loop, verify and
Shape all read.

### 2. Neither canonical parser is reachable from the admin today

`apps/indusk-mcp/package.json` `exports` (lines 22–65) lists 11 subpaths:
`.`, `trajectory/parser`, `falsification/log`, `cleanup/oversized`,
`cleanup/gate`, `worktree/validate-config`, `planning/plan-parser`,
`shape/shape`, `shape/boundary`, `shape/findings`, `shape/rules`.

**Not exported:** `impl-headings`, `impl-parser`, `trajectory/audit`,
`shape/changed`, `shape/impl-blocks`. So the brief's direction 1 ("replace the
regex with the package's exports") needs at least one new subpath export
first. `shape/boundary` *is* exported and the admin does not use it.

The admin imports 3 distinct subpaths today (`trajectory/parser`,
`falsification/log`, `planning/plan-parser`) across 12 import sites.

### 3. There is already a "phase progress" computation, keyed by the wrong thing

`impl-parser.ts:195–238`: `PhaseCompletion {phase, name, complete, totalItems,
checkedItems, uncheckedByGate}`, `getPhaseCompletion(phase)`,
`getAllPhaseCompletions(parsed)`. It gives n/m items and the unchecked count
per gate — the phase bar's data. But it is keyed by the bare `number`, losing
`kind` and `ordinal`, so in a two-sequence impl "Phase 1" is ambiguous.
Callers: `tools/plan-tools.ts:63,120`, `bin/commands/check-gates.ts:53`.

The run loop has its own private `isPhaseDone(phase, policy)`
(`run/loop.ts:170`) that additionally honours `auto`-policy opt-out markers,
and iterates **by ordinal** (line 265) precisely because number is ambiguous.
No `currentPhase` or `phaseProgress` is exported anywhere.

Gate kinds have two definitions that disagree: `impl-headings.ts:82`
`GateKind = "Verification" | "OTel" | "Context" | "Document"`, and
`impl-parser.ts:12` `GateType = "implementation" | "verification" | "context" |
"document"` with no OTel — an `#### Phase N OTel` block's items fall into
whichever gate preceded it. dusk is `otel.role: library` so this never shows
here; a consumer project with OTel gates would render them wrong.

### 4. The lifecycle is defined in three places, none of them a single exported sequence

- **Document stages:** `plan-parser.ts:54–60` `STAGE_ORDER = ["research",
  "brief", "adr", "impl", "retrospective"]`, **module-private**. Note it omits
  `test-plan` (every new plan has one) and `falsification.md` is legacy.
  `determineStage` walks it in reverse, first `{stage}.md` present wins, and
  `determineNextStep` produces strings like `Create adr`, `Continue impl`,
  `Review brief (status: draft)`. `parsePlan` never opens `impl.md`'s body, so
  it has no phase awareness.
- **Rituals:** no symbol names the order falsify → cleanup → retrospective. The
  nearest is `cleanup/gate.ts:123` `checkRetrospectiveReadiness(planRoot,
  implContent)` → `{falsificationOk, cleanupOk, rowsOk, nonTerminalRows,
  passes, missing}` (exported via `cleanup/gate`), and the private
  `isRitualPhaseTerminal(implContent, word)` keyed on the phase **title
  prefix**. The order is written only in prose (`skills/retrospective.md:35,52`,
  `skills/work.md:292`, `skills/cleanup.md:3`).
- **Gates within a phase:** the two definitions in finding 3.

So the brief's plan-level state line — "brief drafted (awaiting acceptance) →
… → executing → awaiting /falsify → awaiting /cleanup → awaiting
/retrospective → archived" — is derivable today from frontmatter statuses +
`checkRetrospectiveReadiness` + the impl body, but nothing composes it, and
the composition would be a **third** private lifecycle if written in the admin.
The brief's own rule (2026-09-16 note) is that bars derive from the lifecycle
definition, never from which documents exist. That definition does not exist
as one thing yet.

### 5. Nothing is live, and there is no data path but the server render

- `dynamic = "force-dynamic"` once, at `app/layout.tsx:33` — every request
  re-reads disk.
- **5 `"use client"` files**, all leaf widgets (`ProjectSwitcher`, `Mermaid`,
  `CollapsibleSection`, `CopyButton`, `FullscreenDiagram`). Every page and
  section is a server component.
- No polling, SWR, `router.refresh`, `revalidate`, `EventSource`, or
  WebSocket anywhere in non-test source. **No API routes** (`app/api` absent,
  no `route.ts`).
- Project root resolves through `lib/registry-client.ts` — a deliberate
  read-only duplicate of `lib/admin/registry.ts` (doc comment lines 5–13,
  reason: no workspace runtime dep) — from `${INDUSK_HOME ?? ~/.indusk}/projects.json`.

Next.js 16.2.4 / React 19.2.4 (`apps/indusk-admin/package.json:18,20`). In
the App Router the idiomatic no-API refresh is a client component calling
`useRouter().refresh()` on an interval: it re-runs the server components for
the current route and streams the new tree in, preserving client state
(collapsible open/closed, scroll). That fits "read-only, no write surface, no
websockets" with zero new routes. The alternative — a route handler returning
JSON plus client fetch — adds a second data path and a second place the
reader's shape is defined. Both are documented for the ADR; the tradeoff is
"one render path, whole-page re-render" vs "targeted fetch, second contract".

### 6. The phase-boundary record is exported, generic, and unread by the admin

`shape/boundary.ts`: `PhaseBoundaryRecord {plan, phase, sha, timestamp}`,
`readBoundaries(root)` (ENOENT → `[]`, malformed line **throws**, by design),
`recordPhaseStart`, `findPhaseStart`. Consumer: `shape/changed.ts` only. The
admin never reads `.indusk/phase-boundary.jsonl` despite the subpath export.
**`phase` is a bare number** — the same ambiguity as finding 3; a Test Phase 1
and a Build Phase 1 boundary would collide.

### 7. Shape cannot address a Test Phase — the whole `shape/` surface takes `phase: number`

Twelve functions across `shape/shape.ts`, `shape/findings.ts`,
`shape/changed.ts`, `shape/impl-blocks.ts`, `shape/boundary.ts` take a bare
number and resolve through `buildPhaseHeadingFor` / `gateHeadingFor`, which
match `### [Build ]Phase N` and, per the comment at `impl-blocks.ts:37–39`,
"deliberately do not match `### Test Phase N`". The existence guard at
`shape.ts:57` (`parsed.phases.some(p => p.number === phase)`) *does* match a
Test Phase's number, so a test-phase-only plan passes the guard and then fails
the gate lookup. The lesson `.claude/lessons/shape-cannot-see-test-phases.md`
already prescribes `{kind, number}` threaded through `verificationIsGreen`,
`verificationGateLines` and `gateHeading`. This is the brief's carried item
and it is the same change as finding 3's key problem.

### 8. Sidebar: no root node, `roadmap:` is only a sort key

`PlanList.tsx:55–103` `buildGroups(active, archived, grouping)`: groups by each
parent's `subplans:`, orders groups by the root master's `roadmap:` index,
puts unclaimed active plans in `rest`. The render emits parent groups, then
"Active plans", "Unordered", "Archived (n)". Declarations come from
`readPlanDeclarations` (`plan-parser.ts:277–308`) via `readPlanHierarchy`
(`planning-reader.ts:350`), which already returns the root declaration —
so the brief's "the reader already returns the root declaration" holds; the
missing piece is purely `buildGroups` plus a header row.

### 9. Scorecards: the "only loads after a prompt" issue is on the write side

Reader: `planning-reader.ts:386–411` `readEvalScorecards` — `existsSync` on
`.indusk/eval/results.log`, `[]` if absent, plain `readFile` per request, no
cache, malformed lines skipped silently. Nothing on the admin side defers.

The lazy part is the writer: `eval/log-writer.ts:14–29` creates `.indusk/eval/`
on **first append**, and appends happen only when the PostToolUse
`eval-trigger.js` hook fires on a `git commit` and the spawned evaluator
finishes — or when someone runs `--drain-pending` by hand. So a fresh project
shows no scorecards until the first evaluated commit, which is the observed
"after a prompt". The admin cannot fix that; it can only say "no evaluations
recorded yet" instead of an empty list, and it already has an empty-state
branch (`scorecards/page.tsx:56–69`). The brief lists this both as carried in
(Context) and as out of scope; the code says it is not an admin defect.

### 10. Registry: no prune exists; two test files write the developer's real registry

`lib/admin/registry.ts` exports `readRegistry`, `addProject` (dedupes on
`path`, suffixes name collisions `-2`, `-3`), `validateProject`,
`touchProject`; quarantines a corrupt file. **No remove or prune**; line 137
says so in a comment. Writers: `init.ts:1291` and `update.ts:875`.

Tests that run `init` with no `INDUSK_HOME` and therefore register temp dirs
in `~/.indusk/projects.json`: `init-workbench.test.ts` and
`multi-agent-init.test.ts` (high confidence); ~25 more CLI-spawning tests lack
the variable but may not reach `addProject`. The folded
`project-list-workbenches-only` archive counted 1,588 entries, 1,577 dead. A
prune needs: the path-exists check that already exists (`validateProject`),
a dry run, and the same backup-before-write the quarantine path uses.

Note: `lib/telemetry/registry.ts` is a second, unrelated registry with
similar names.

### 11. Test conventions and a pre-existing type debt in the admin

`vitest.config.ts` runs two projects: `node` (lib + `__tests__`, serialized
because HTTP smokes spawn `next dev`) and `browser` (Playwright chromium,
`vitest-browser-react`). 18 component test files, 10 lib tests, screenshot
baselines for 6 components. Convention (stated at `app/p/[project]/page.test.tsx:31–34,54–57`):
`vi.mock` every module the subject imports from its actual specifier, hoisted
above a deferred import of the subject; `node:fs` is externalized in the
browser runtime. `component-reuse-audit.test.ts` fails any inline `<button`/`<table`
where a `ui/` primitive exists.

`tsc --noEmit` in the admin reports **10 errors**, all `TS2739` on hand-written
`TrajectoryRow` fixtures missing `writableAtKind` / `passesAtKind`
(`FalsificationSection.test.tsx` ×2, `PlanDetail.test.tsx` ×5,
`markdown-export.test.ts` ×3). The parser made those fields required; the
admin has **zero** references to either field, in fixtures or rendering
(`PlanDetail.tsx:290–291` prints `Phase {row.writableAt}` with no kind). The
admin's type-check has been red since test-phase-structure landed and nothing
gates on it.

### 12. Structural counts

| Surface | Count |
|---|---|
| Files importing `lib/phases.ts` | 5 (3 source, 2 test) |
| Admin import sites of indusk-mcp subpaths | 12, across 3 subpaths |
| Package subpath exports | 11; `impl-headings`, `impl-parser`, `trajectory/audit` absent |
| Shape functions taking bare `phase: number` | 12 |
| `"use client"` components | 5 (all leaf widgets) |
| Admin `tsc` errors today | 10 (all `TrajectoryRow` kind fields) |
| Registry writers / pruners | 2 / 0 |
| Lifecycle definitions | 3 partial (`STAGE_ORDER`, ritual prose, two gate-kind types), 0 composed |

## Open Questions

- **Where does the composed lifecycle live?** The bars need one exported
  definition: document stages (including `test-plan`), then execution, then
  the ritual order, then archived. `plan-parser.ts` owns `STAGE_ORDER`;
  `cleanup/gate.ts` owns ritual readiness; nothing owns the join. The admin
  cannot own it (a third copy). Candidate: a `lib/lifecycle.ts` in indusk-mcp
  that `parsePlan`, `checkRetrospectiveReadiness` and the admin all read,
  pinned single-definition like its siblings.
- **Phase identity.** Bare `number` is ambiguous in every reader that matters
  (`getPhaseCompletion`, `PhaseBoundaryRecord`, all of `shape/`, the admin's
  row matching). `ImplPhase` already carries `kind` and `ordinal`. Which one
  keys the UI — `{kind, number}` (human-readable) or `ordinal` (unique,
  what the loop iterates)? Changing `PhaseBoundaryRecord` changes a tracked
  machine-state file's shape.
- **Refresh mechanism.** `router.refresh()` on an interval versus a route
  handler + fetch. The first keeps one data path; the second allows a cheaper
  poll and a "changed since" check. Interval length and a visible "last
  updated" are the brief's only stated requirements.
- **Registry prune scope.** Fix the two leaking tests and add `ui prune
  [--dry-run]`, or also filter the project list to workbenches as the folded
  plan wanted? The folded brief's third item changes what the landing page
  shows; it is a product decision, not a cleanup.
- **The scorecard note.** The brief contradicts itself (carried in vs out of
  scope). Finding 9 says the behaviour is the writer's, not the reader's; the
  admin-side change is an honest empty state. Resolve at brief acceptance.

## Sources

- `apps/indusk-admin/src/lib/phases.ts`, `components/PlanDetail.tsx`,
  `components/PlanList.tsx`, `lib/planning-reader.ts`, `lib/registry-client.ts`,
  `vitest.config.ts`
- `apps/indusk-mcp/src/lib/impl-headings.ts`, `impl-parser.ts`,
  `plan-parser.ts`, `cleanup/gate.ts`, `shape/{shape,findings,changed,impl-blocks,boundary}.ts`,
  `lib/admin/registry.ts`, `eval/log-writer.ts`, `run/loop.ts`; `package.json` exports
- `.claude/lessons/shape-cannot-see-test-phases.md`
- `.indusk/planning/archive/project-list-workbenches-only/` (folded 2026-09-14)
- `.indusk/planning/archive/dawn-ui-plan-grouping/` (the sidebar's `buildGroups`)
- `.indusk/research/indusk-interface.md`, `visual-planning.md` (April 2026
  notes; the Kanban idea is the ancestor of the phase-as-column view)
- Next.js App Router: `router.refresh()` re-fetches server components for the
  current route without a full reload, preserving client state
