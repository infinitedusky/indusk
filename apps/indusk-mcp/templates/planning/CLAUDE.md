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
- **A brief holds expectations, promises and looks, and everything else is
  research.** Its shape is read by `indusk promises contract`, so keep the
  headings and each label on its own line; a draft is not held to the
  registry, an accepted brief is, by every `pnpm test`. The problem, the
  context and the decisions made on the way go in `research.md`. A draft brief
  is accepted by `indusk plans accept-brief <plan>`, which runs the contract
  check first — never by editing its status. — see `/guide/briefs`
- **A brief may state its promises as clauses** (`clauses: required` in its
  frontmatter): each promise it makes lists its splits, limits and the promises
  it rests on beneath it, declared with `--clause`; the contract check holds
  brief and registry equal. — see `/decisions/plans-are-promises`
- **A plan that changes an app's interface lists its looks, or says why it
  has none.** Once the draft brief exists, ask "does this change how anything
  looks?"; a yes lists each look under `## Looks` as a drawn mockup — a
  screen, or a new component drawn on its own; a story is never named without
  a mockup. A plan whose `Files Affected` names a path under an app's
  `sources` with none listed and no `None — {reason}` is refused at approval,
  as one whose branch changed them is at `plans accept`. Approval waits on
  every look the brief names being drawn and approved; acceptance, on each new
  component's story. — guarded by `brief-looks.test.ts` and
  `plans-approve-looks.test.ts` — see `/guide/briefs`
- **`planning.documents_off` turns a planning document off for a project**: a
  plan in it reads that document *skipped*, never *missing*, and the planner
  does not write it. The brief and the test plan cannot be turned off; a config
  naming either is refused when read. — guarded by `documents-off.test.ts` (A12)
  — see `/guide/new-project`
- **A plan document says a promise or clause is upheld or broken** (live:
  holding or broken; past: held or broke; unknown: no signal), and its
  telemetry its signal, and the old word for it is not used — failed and passed
  are for tests only, and the old word for a broken promise is not used. — guarded by
  `promise-words.test.ts` (`promise: a-promise-is-upheld-or-broken`) and, for
  the word signal, `signal-word.test.ts` — see `/decisions/one-promise-language`
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
- **`<plan>.md` in `.indusk`'s `plan-history` folder is the record of a plan's decisions**:
  each answer to what the plan waited on, dated, written by `plans/history`
  (the admin's decision card) and committed on `main`, never by hand. — see
  `/decisions/plan-cockpit`

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
  `clause: <promise>/<clause>` names one clause and counts for its promise; an
  opted-in plan names every split and limit clause in some row.
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
- **A checkbox or an opt-out is read only from a column-zero line**: anything
  indented under a task is its detail, read for row labels by the
  cross-reference rule and for nothing else — it never ticks a box, skips a
  gate or adds a task. — guarded by `detail-is-only-read.test.ts`
  (`promise: hidden-detail-is-only-read`); see `/decisions/phase-summaries`
- **A new impl opts in with `phase_summary: required` and is written for a
  reader without the plan's shorthand**: each phase opens with a paragraph
  saying what it does for the whole plan, each task is one plain
  instruction saying what to do and each verification item a plain statement of
  what must hold, for someone who has worked on the project but knows none of
  the plan's abbreviations or labels, and names, code and row labels go in the task's
  folded `<details><summary>Technical</summary>`. The save check refuses a
  missing paragraph, a row label in the paragraph, and code or a row label on a
  task line; whether a sentence is plain is a person's, at approval. The rule is
  held on every edit to an opted-in impl, refusing only what the edit adds, and
  a task's `<details>` must close before the next task. — guarded by
  `phase-summary-rule.test.ts` (`promise: an-impl-phase-explains-itself`) and
  `detail-is-only-read.test.ts` (`promise: hidden-detail-is-only-read`); the
  full shape and a before-and-after example are in `/reference/skills/plan#phase-summaries-for-a-reader-without-the-shorthand`
- `validate-impl-structure.js` re-validates the whole file when an edit's
  `new_string` contains a phase header — scope edits to checklist items.
- **A shell command that writes a plan document is refused**: change a plan
  document with the Edit tool or the `indusk` command for it (archive a plan
  with `indusk plans archive <plan>`); reading one from the shell is fine.
  — guarded by `plan-write-guard.test.ts`
- Verification items are runnable commands with expected output, never "verify
  it works". Checking off a Verification item does not update a row's `State`
  column — do both in one edit.
- A plan that adds a lifecycle position, activity or gate kind also adds its
  admin rendering, in the same plan, as a Document gate item. — see
  `/reference/admin-ui/overview`
- **Worktree-per-plan is the default**: Phase 1 opens with `indusk worktree
  create <plan>` (records the assignment; the landing releases it); opt out
  with `worktree: none` in impl frontmatter. A plan an incident reopened from
  the archive is worked the same way, `indusk worktree create <plan>`; a closed
  plan reopens only through an incident, never through `worktree create`.
  — see `/reference/cli/worktree`
- **A plan is written on its own branch, by convention**: `indusk plans start
  <type> <name>` writes its documents in its worktree only; `plans approve`
  checks the brief and merges them to the trunk; `plans land` refuses a plan
  not yet `plans accept`ed. A plan written on `main` is not refused; each such
  commit is recorded as a break of `a-plan-is-written-on-its-own-branch`.
  Approving and landing commit InDusk's own bookkeeping left on the trunk;
  any other uncommitted work there is the person's — shown at review, never
  committed by a session. In a workbench, a plan's documents live at the
  workbench root and only its code gets `plan/<name>`, in the repo its
  `code.json` names (`--repo` when there are several). — see
  `/reference/cli/plans`
- **Every phase carries `**Tier**: <tier> — <reason>`** under its heading
  (strong, med, weak or baby), written when the planner writes the phase: the
  step's default tier from `.indusk/config.json` spelled out, or a different
  tier with its reason, or the impl is refused. A phase with no line still
  takes the step's default. The config, not the plan, names the model.
  `/work` runs each phase as a subagent on `indusk plans model`'s answer, and
  each boundary ends with the command `indusk plans next-session <plan>` names,
  to run in a new session. — see `/reference/cli/plans`
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
  phase. Shape is intra-unit; decomposition across files is `/cleanup`'s, at
  close. — see `/guide/shape`, `/decisions/lifecycle-rebalance`
- **Commit cadence**: one commit per checklist item on the plan's
  `plan/{name}` branch, intent-named; in a monorepo, one commit per app or
  context; merge and delete fast. — see `/reference/skills/work`
- **A plan is read cold before it is presented, and audited before falsification;
  the agent answers every concern.** `/audit {plan} --before-approval` has a fresh
  reader write `plan-review.md`, answered before approval; the audit's `audit.md`
  is answered the same way (a fix, a signal naming a clause, or a reason). An
  answer that would change a promise, an expectation or a look is an amendment:
  the session stops for the person. Every "nothing" answer is shown to the
  person (`indusk plans audit-answers`). — see `/decisions/audit-concerns-are-answered`
- **Close-out rituals**: `/work` → `/audit` (a fresh reader writes `audit.md`,
  answered at once; advisory) → `/falsify` (authors a Falsification Phase)
  → `/work` → `/cleanup` (authors a Cleanup Phase; its threshold is
  attention-focus, not a cap) → `/work` → `/retrospective`, whose Step 0
  blocks unless both rituals are terminal or skipped with a reason and
  `audit.md` exists or the impl carries `audit: skipped` + `audit_reason` —
  the file's existence is read, never its content. Ritual phases are detected by titles that START
  with the ritual word. The retrospective
  confirms the plan's promises (`indusk promises confirm <plan>`) before it
  archives; a declared promise no passing row names blocks the close. A
  promise stated as clauses is confirmed only when each split and limit clause
  has a passing row, each such row's test file carries `clause: <promise>/<clause>`,
  and each promise it rests on is in force. A clause may
  rest on a promise the same plan makes; it counts once that promise is proved
  in the same close, and a cycle between them is refused. A plan with
  `clauses: required` closes only when each clause's tests pass when run at
  close and its signal has reported it upheld in a real run (a stopped daemon
  refuses); landing runs the same tests. — see
  `/decisions/falsification-ritual`, `/reference/skills/retrospective`,
  `/decisions/plans-are-promises`, `/decisions/mark-first`
- **The retrospective's compaction step**: plan close demotes the plan's
  narrative to one line + archive link, compresses any context entries it
  authored to rule + pointer, and collapses one old root entry per close. — see
  `/guide/context-budget`
