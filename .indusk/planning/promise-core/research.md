---
title: "Promise core — what ships today, and what the core depends on"
date: 2026-10-05
status: complete
workflow: feature
---

# Promise core — Research

## Question

Sandy, 2026-10-05: InDusk is built with InDusk, so what its author wants for
his own work keeps becoming part of the product. Which parts of the published
package are the product, which are an opinion the product sells, and which are
only how this repository is run? And can the part the aim calls the point,
promises checked against the running software, be used on its own?

Everything below was measured on `main` on 2026-10-05 against the package in
`apps/indusk-mcp/`. Nothing here is a recommendation; the direction is in
[master.md](master.md).

## Findings

### 1. What the package ships

| Shipped | Count | Size |
|---|---|---|
| Skills | 19 | 3,861 lines |
| Hook files | 14 | 3,623 lines |
| Templates | 17 files | |
| "Community" lessons | 19 | |
| Extensions | 21 | |
| Library source, tests excluded | | about 27,000 lines |

The library source, grouped by what it serves:

| Group | Lines | Share |
|---|---|---|
| Promises, telemetry, the always-on server | 5,295 | about 20% |
| Plans, gates, trajectory, verify, run, shape, rituals, the evaluator | 11,816 | about 44% |
| Worktrees, workbenches, papers | 2,704 | about 10% |
| Config, extension loading, versions, the admin's server code | about 7,270 | about 27% |

The third row mixes two things that this research did not separate: the
plan-worktree record, which serves plans, and the workbench layout, which is
one developer's way of arranging client repositories.

### 2. Lines in the package that are true only in this repository

Counted by scanning every shipped skill, template and hook for this
repository's own paths, its plan names and version numbers, its release
process and its toolchain.

| What | Where | Count |
|---|---|---|
| This repository's paths (`apps/indusk-mcp`, `apps/docs`, `apps/indusk-docs`) | 13 of 19 skills | 41 lines |
| Its toolchain assumed (pnpm, Biome, Vitest, Turborepo) | 7 skills | 51 lines |
| Its history told as narrative (versions, plan names, incidents) | skills; hook comments | 19; 35 |
| Its own release process | the retrospective skill | 6 lines, inside a step of about 90 |

About a dozen of the 41 path lines are instructions an agent would act on. The
rest are asides of the form "in the monorepo, use this path".

<details>
<summary>The lines an agent would act on</summary>

- `skills/retrospective.md:264`, `:270`, `:276` create decision and lesson
  pages under `apps/indusk-docs/src/`, a folder that no longer exists in this
  repository either (renamed to `apps/docs`).
- `skills/retrospective.md:329` to `:387` are Step 11: bump
  `apps/indusk-mcp/package.json`, roll `apps/docs/src/changelog.md`, commit as
  `chore(release):`, run `apps/indusk-mcp/scripts/release-guard.sh`.
- `skills/document.md:54` to `:171` state that documentation lives at
  `apps/indusk-docs/`.
- `skills/planner.md:529` and `skills/work.md:282` give the same folder as
  the target of a phase's Document gate.
- `skills/git.md:71`, `:74` use this repository's app folders as the example
  of committing per context.

In a project other than this one, an agent closing a plan is told to bump
InDusk's own package and run InDusk's release guard. We have not seen an agent
act on it.

</details>

### 3. Preferences that ship as defaults

Each of these reaches every project that runs `indusk init` or `update`.

- **Conduct rules.** `templates/AGENTS.md` is written into the project: lead
  with the strongest counterargument, never validate a premise, state
  confidence levels. Two further sections are appended on every update.
- **Two writing skills and a command.** `write` and `brainstorm-fiction`
  install with the other seventeen skills, and `indusk papers` publishes to a
  blog.
- **A linter.** `init` adds `@biomejs/biome` to the project's dependencies.
- **A background evaluator, on.** It runs a headless `claude` on every commit
  unless switched off, which spends the project owner's tokens.
- **A branch rule, on.** The trunk guard refuses code on `main` unless
  switched off.
- **Lessons about one machine.** At least three of the 19 shipped lessons
  concern a retired graph database or a particular container runtime.
- **Three command names.** `indusk`, `dev-system` and `atdawn` all point at
  the same program.

<details>
<summary>Where each is set</summary>

- Conduct rules: `src/bin/commands/init.ts` copies `templates/AGENTS.md`;
  `src/lib/agents-md-sections.ts:33` lists the two ensured headings.
- Skills: `init` copies every file in `skills/`.
- Biome: `src/bin/commands/init.ts:315`.
- Evaluator default: `hooks/eval-trigger.js:166` (`enabled !== false`).
- Trunk guard default: `hooks/trunk-guard.js:251`.
- Lessons: `lessons/community/`, two naming Graphiti and one OrbStack.
- Command names: the `bin` field of `package.json`.

</details>

All 13 projects registered on this machine belong to the author. No outside
project has received the package.

### 4. The promise code depends on plans

The watching half does not: reading marks, per-source health, the probe and
the always-on pass never mention a plan. Declaring a promise and responding to
a break both do.

1. **A promise must name an owner, and the owner must be a plan folder.** A
   promise file with no `owner` is refused as malformed. The check then fails
   unless the owner is a directory under `.indusk/planning/`.
2. **A break is answered in the plan's own format.** The response appends a
   `Build Phase N: Maintenance` section, with gates, to the owner's `impl.md`.
   With no owner the function returns `no-owner` and nothing is reopened.
3. **A promise's state rules refer to plan archival.** "Declared, but its
   owner is archived" is a check error.

So in a repository with no plan folders, or one whose work is tracked
elsewhere, a promise cannot be declared.

<details>
<summary>Where</summary>

- `src/lib/promises/registry.ts:193` and `:194`: `owner` required, and it
  must be usable as a folder name.
- `src/lib/promises/check.ts:106` to `:190`: the owner must exist as a plan
  folder, active or archived.
- `src/lib/promises/reopen.ts:104` to `:146`: `reopenOwner` writes the
  Maintenance phase into `impl.md`; `:115` is the `no-owner` return.
- `src/lib/promises/check.ts:209`, `:239`: rules keyed on the owner being
  archived.
- Seven promise modules name plans: `config`, `after-close`, `check`,
  `incidents`, `reopen`, `watch`, `vocabulary`.

</details>

### 5. The promise vocabulary that already exists

- **Kind**, defined as "what can break a promise after it was proved, and
  therefore what checks it". `behaviour` breaks on inputs nobody chose and is
  checked by a run. `state` breaks on a later change to the code that produces
  it and is checked by a test. `structure` breaks on a change that removes or
  duplicates something and is checked at build time.
- **Lifetime.** `holds` is in force for as long as the system runs.
  `established` is "a transition that cannot be undone once done", and retires
  when proved.
- **State.** `declared`, `enforced`, `known-violated`, `retired`.
- **The link rule.** An enforced promise must be named by a test. A behaviour
  or state promise must also be named by a code site.

One combination is not refused and has no meaning: a `behaviour` promise with
an `established` lifetime. It would be proved once, retire, and never be
watched.

### 6. Promises and tests in this repository

| | Count |
|---|---|
| Promises in the registry | 4 |
| Tests per promise | 1, 1, 2 and 8 |
| Test files that name more than one promise | 0 |
| Test files in the repository | 367 |
| Test files carrying a promise's name | 23 |

One promise is held by one or more tests. Most tests serve no promise.

The plan closed on 2026-10-01, `admin-plan-type`, had 26 test rows. One was
tied to a promise. What a plan builds is described today by its own rows, not
by promises.

### 7. What nothing checks

- **Whether a test still proves its promise.** The check confirms a test
  carries the promise's name. Nothing asks whether the test would fail if the
  sentence were false. The 2026-10-01 plan had this case: a test passed using
  a status word that no real document used.
- **Whether a promise's mark has ever fired.** A promise that declares
  `expect_every` is reported when overdue. One that does not can have a mark
  on dead code indefinitely.
- **Whether a test was ever seen failing.** The "written, red" state of a
  test row is a word the author types.

### 8. What is already designed for those gaps

The pull-request shape, [pr-shape.md](../indusk-v4-day/pr-shape.md) in the Day
master plan, lists ten artefacts a change must carry. Three are specified and
unbuilt, and each answers a gap above:

- **Row 4, red observed**: "the test failed against code without the change",
  recorded by the system. Today the cell is prose the author writes.
- **Row 6, binding**: "the test dies when the claimed behaviour is broken",
  by breaking the claimed code on purpose. Done by hand once, on eight rows;
  all eight tests died.
- **Row 7, uncovered surface**: "changed code no claim exercises", measured by
  coverage. A person acknowledges each file or demands a claim, and the
  acknowledgement is recorded.

Those rows speak of "claims", meaning a plan's test rows. They mean promises
only once every test row names one, which is `day-contract`, component 4c in
the Day master plan.

## Open Questions

- Does a promise about an amount, such as a response time over many runs, fit
  the `behaviour` kind, whose mark is upheld or violated on one run?
- What does a plan that builds nothing, a spike, promise?
- Is a release procedure part of the method any project would want, or only
  this repository's?

## Sources

- `apps/indusk-mcp/` at `main`, 2026-10-05: `package.json`, `skills/`,
  `hooks/`, `templates/`, `lessons/`, `src/lib/promises/`.
- `.indusk/promises/` in this repository.
- [indusk-v4-day/pr-shape.md](../indusk-v4-day/pr-shape.md) and
  [indusk-v4-day/master.md](../indusk-v4-day/master.md).
- The conversation of 2026-10-05 in which these were measured.
