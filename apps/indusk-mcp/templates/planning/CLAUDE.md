# Planning rules

Loaded by Claude Code whenever a file under `.indusk/planning/` is read: the
rules of plan documents, delivered where a plan is written and nowhere else.
Package-owned — `indusk init` writes this file and `indusk update` overwrites
it from the package's `templates/planning/CLAUDE.md`; edit the template, never
this copy. Each entry is a rule and a pointer; the pointer holds the story.

## Documents

- A plan is `.indusk/planning/{kebab-case}/`: research → brief → test-plan →
  adr → impl → retrospective. Which documents a plan needs is its `workflow:`
  (`feature`, `bugfix`, `refactor`, `spike`), declared in the brief's
  frontmatter — never inferred from which files exist. — see
  `/reference/skills/planner`
- **A brief holds expectations and promises, and everything else is
  research.** Its shape is read by `indusk promises contract`, so keep the
  headings and each label on its own line; a draft is not held to the
  registry, an accepted brief is, by every `pnpm test`. The problem, the
  context and the decisions made on the way go in `research.md`. — see
  `/guide/briefs`
- **Cross-reference related plans by path, and update both** when work in one
  changes something the other names — a plan never cites stale information.
- **Plan hierarchy is declared top-down, in frontmatter**: the root `master.md`
  names `parents:` + the `roadmap:` order; each parent's own `master.md` names
  its ordered `subplans:`. Children declare nothing — one source of truth per
  link. The inventory always comes from disk; declarations add structure and
  can never subtract a plan. — see `/reference/cli/plans`
- **Papers are plan documents**: `kind: paper` is declared in frontmatter,
  never inferred from filenames; status is `draft | accepted | published`,
  anything else reads `malformed`. A folder of papers with no lifecycle
  document is a `paper`-stage plan. — see `/reference/cli/plans`
- **`.indusk/promises/` is a plan document**: one markdown file per promise at
  the plan root, not code and not machine state. Every kind has a promise;
  `pnpm test` ends with `pnpm promises:check`. Only a promise about something
  known to happen regularly declares `expect_every`; silence without it is the
  good outcome. A promise is written by `indusk promises declare | change |
  replace`, and one never in force taken back by `withdraw` (the planner's
  tools of the same names), never by hand. A plan confirms its promises
  (`indusk promises confirm`) before it archives, retrospective or not; an
  archived plan's declared promise is confirmed or withdrawn by the same
  commands, never edited by hand. An incident
  is closed with `indusk promises fix <id>`, which records when; `check`
  refuses a fixed incident that does not say. — see `/decisions/day-promises`

## The impl

- **Every impl phase has gates** — implementation, verification, context,
  document; OTel only when `otel.role` is unset or `service`. Hooks enforce
  them: `validate-impl-structure.js` at write time, `check-gates.js` at phase
  transitions. `gate_policy` (`strict` / `ask` / `auto`, default `ask`) governs
  skips; `ask` needs conversation proof. — see `/guide/#3-hooks-enforce-what-discipline-won-t`
- **Impl phases are two sequences ordered by document position** — `### Test
  Phase N` and `### Build Phase N` (`### Phase N` still means build phase N).
  **Test Phase 1 is the register**: `#### Deferred to Test Phase N` /
  `#### Deferred to Build Phase N` / `#### Regression Guards`; it absorbs
  `### Trajectory Rationale`, carries its own Verification gate, and new impls
  opt in with `test_phases: required`. A row left unwritten blocks every later
  close. — see `/decisions/test-phase-structure`
- **Test Trajectory** is mandatory in new impls (`trajectory: required`): a
  table `ID | Asserts | Writable at | Passes at | State`, IDs `T`- or
  `A`-prefixed; each phase's Verification references IDs. Writable-at is the
  earliest authorable phase, never the fix phase; `Writable ≤ Passes` is
  enforced at write time. Deferred Verification rows need `reason:` /
  `would require:` / `mitigation:`. — see `/guide/test-trajectory`
- **A test row has a `Level` and a `For`.** The level is one of five — `unit` /
  `contract` / `live check` / `smoke` / `promise` — the smallest that proves
  the assertion, and it says when the test runs (a phase runs only its rows
  and related tests; both tiers run at landing). `For` says what the test is
  for: `promise: <name>`, `lesson: <name>`, or the reason it needs neither.
  `test_levels: required` and `test_purpose: required` make the hook refuse a
  row without them. — see `/guide/test-levels`
- Vitest is the committed test runner (adaptive first-connect setup); moved
  here from the root at test-kinds' close. — see
  `.indusk/planning/archive/verify-skill/adr.md`
- A row's optional `Test` column names test **files**, repo-root-relative;
  `verify` runs them through the project's own command and reads the exit
  code. A row with none, an unresolvable path, or a `manual:` command reports
  **unverified** — never passed, never red. — see `/reference/cli/verify`
- **Fences are structure** (`fencedLineMask`): a deferral carries the deferred
  test's body, so impls hold arbitrary text. A fence closes only on the same
  character at ≥ the same length with nothing after it; nest by lengthening. An
  unterminated fence is refused by the validator, naming the line. — see
  `/guide/test-trajectory`
- `validate-impl-structure.js` re-validates the whole file when an edit's
  `new_string` contains a phase header — scope edits to checklist items.
- Verification items are runnable commands with expected output, never "verify
  it works". Checking off a Verification item does not update a row's `State`
  column — do both in one edit.
- A plan that adds a lifecycle position, activity or gate kind also adds its
  admin rendering, in the same plan, as a Document gate item. — see
  `/reference/admin-ui/overview`
- **Worktree-per-plan is the default**: Phase 1 opens with `indusk worktree
  create <plan>` (records the assignment; the landing releases it); opt out
  with `worktree: none` in impl frontmatter. — see `/reference/cli/worktree`
- **A plan is written on its own branch, by convention**: `indusk plans start
  <type> <name>` writes its documents in its worktree only; `plans approve`
  checks the brief and merges them to the trunk; `plans land` refuses a plan
  not yet `plans accept`ed. A plan written on `main` is not refused; each such
  commit is marked a violation of `a-plan-is-written-on-its-own-branch`. — see
  `/reference/cli/plans`
- **A Context gate item names its tier and destination** — `guard: <test>
  carries lesson: <name>`, `planning: …` (this file, via its template), an
  area's own `CLAUDE.md`, `current.md: …`, or `root (<section>): … —
  always-on because …`. An item aimed at the root says why it must be
  always-on; one that cannot belongs at a lower tier. — see
  `/guide/context-tiers`

## Executing

- `/work`'s per-phase order is implementation → OTel → verification →
  **Shape** → context → document. Shape is a step, not a gate type: the
  executing agent reviews the code the phase wrote against the enabled
  extensions' prose rules, and findings land as unchecked items in the current
  phase. — see `/guide/shape`
- **Commit cadence**: one commit per checklist item on the plan's
  `plan/{name}` branch, intent-named; in a monorepo, one commit per app or
  context; merge and delete fast. — see `/reference/skills/work`
- **Close-out rituals**: `/work` → `/falsify` (authors a Falsification Phase)
  → `/work` → `/cleanup` (authors a Cleanup Phase; its threshold is
  attention-focus, not a cap) → `/work` → `/retrospective`, whose Step 0 blocks
  unless both rituals are terminal or skipped with a reason. Ritual phases are
  detected by titles that START with the ritual word. The retrospective
  confirms the plan's promises (`indusk promises confirm <plan>`) before it
  archives; a declared promise no passing row names blocks the close. — see
  `/decisions/falsification-ritual`, `/reference/skills/retrospective`
- **The retrospective's compaction step**: plan close demotes the plan's
  narrative to one line + archive link, compresses any context entries it
  authored to rule + pointer, and collapses one old root entry per close. — see
  `/guide/context-budget`
