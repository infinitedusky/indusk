---
name: retrospective
description: Structured audit and knowledge handoff after impl completion. Reviews docs, tests, quality, and context accuracy. Distills planning artifacts into the docs site and archives the plan.
argument-hint: "[plan name]"
---

You know how to close out plans in this project.

## What Retrospective Does

The retrospective skill replaces the freeform "write a retrospective" step with a structured audit and knowledge handoff. It runs after all impl phases are complete and produces:

1. A retrospective document (the written reflection)
2. Verified documentation accuracy
3. Test coverage assessment
4. Quality ratchet updates
5. Context accuracy confirmation
6. Published knowledge in the docs site
7. Archived planning artifacts

## When to Use

- After `/work` completes all impl phases and the status is `completed`
- When `/planner {name}` detects the impl is completed and the next step is retrospective
- Directly via `/retrospective {plan-name}`

## The Audit Checklist

Work through these steps in order. Each step is blocking — do not skip ahead.

### Step 0: Ritual Gate — Falsification + Cleanup + Audit

**This gate blocks everything below. Do not proceed to Step 1 until it passes.**

Before writing a single word of the retrospective, confirm that the plan has completed the closing rituals — falsification, cleanup **and** the audit. Each is satisfied either via its phase-authoring flow (a Falsification Phase / a `### Phase N: Cleanup` phase, both terminal in impl.md), via a legacy sidecar log (falsification only), or via an explicit skip-reason frontmatter pair. **Both must pass.** The composed check is `checkRetrospectiveReadiness(planRoot, implContent)` from `@infinitedusky/indusk-mcp/cleanup/gate` (monorepo: `apps/indusk-mcp/src/lib/cleanup/gate.ts`) — it returns `{ passes, missing, nonTerminalRows }`, where `missing` names any unsatisfied ritual and, since dawn-workbench-execution, `rows` when a trajectory row whose `Passes at` phase exists in the document is not terminal (`passing`, `skipped` or `blocked`); `nonTerminalRows` names them. That row check is the condition the text below always described and the code did not perform until workbench-trust-fixes closed with two rows still `written`.

The same check names `promises` when the plan declared a promise its test rows do not yet prove: no row's `For` cell names it, a row that names it is not `passing`, or the rows name no test file. `unprovenPromises` lists them. A plan does not close holding a promise nothing proves; Step 8a is where each becomes `enforced`.

**Falsification** is satisfied by any of the three conditions below.

Check the gate by reading three sources in this order:

1. **All impl phases terminal (new flow default):** Parse the impl's `## Test Trajectory` table. The gate passes if every phase is terminal — every `Passes at: Phase N` trajectory row is in a terminal state (`passing`, `skipped`, or `blocked`), AND the last phase is not a marker of open falsification work. In practice: if the `/falsify` ritual authored a Falsification Phase and `/work` subsequently closed it (and any fix-in-scope phases it spawned), this condition is automatically true. The phase sequence itself is the proof that the ritual ran.
2. **Legacy completion (pre-1.27.4 flow):** Does `.indusk/planning/{plan-name}/falsification.md` exist with a terminator entry? Use `isFalsificationComplete(planRoot)` from `apps/indusk-mcp/src/lib/falsification/log.js` (invoke via `tsx` or an MCP tool wrapper). Plans authored under the old flow still pass this way; the library is kept unchanged for backwards compatibility.
3. **Skip:** Does the impl's frontmatter contain BOTH `falsification: skipped` AND `falsification_reason: "{non-empty text}"`? Use `isFalsificationSkipped(implContent)`.

The **falsification** requirement passes if ANY of the three conditions above holds.

**Cleanup** must ALSO pass, by either of:

- **Complete:** the plan's impl.md has a terminal `### Phase N: Cleanup` phase — `isCleanupComplete(planRoot)` from `@infinitedusky/indusk-mcp/cleanup/gate` (monorepo: `apps/indusk-mcp/src/lib/cleanup/gate.ts`).
- **Skip:** the impl's frontmatter contains BOTH `cleanup: skipped` AND `cleanup_reason: "{non-empty text}"` — `isCleanupSkipped(implContent)`.

**Audit** must ALSO pass, by either of:

- **Complete:** `audit.md` exists in the plan folder — `isAuditComplete(planRoot)`. The gate reads that the file exists, never what it says: an audit's findings are advisory.
- **Skip:** the impl's frontmatter contains BOTH `audit: skipped` AND `audit_reason: "{non-empty text}"` — `isAuditSkipped(implContent)`.

Cleanup runs AFTER falsification and the audit after cleanup: `/work` → `/falsify` → `/work` → `/cleanup` → `/work` → `/audit` → `/retrospective`. Evaluate the rituals at once with `checkRetrospectiveReadiness(planRoot, implContent)`. The gate passes only when ALL requirements are satisfied. If either fails, refuse to run the retrospective and surface this message to the user:

> **Retrospective blocked: ritual gate not satisfied for `{plan-name}` (missing: `{the `missing` list — falsification, cleanup, audit, rows and/or promises}`).**
>
> Before closing out a plan, run `/falsify {plan-name}` to exercise the bounty-hunting ritual — investigate the code, form specific hypotheses about what should be broken, and author a Falsification Phase in the plan's impl.md capturing the hypothesis tests + fix items. `/work` then picks up the phase and closes it normally; once all impl phases are terminal, this gate passes automatically.
>
> To skip the ritual intentionally, add these two fields to the impl's frontmatter:
>
> ```yaml
> falsification: skipped
> falsification_reason: "why skipping is acceptable for this specific plan"
> ```
>
> If cleanup is the missing ritual, run `/cleanup {plan-name}` to author a Cleanup Phase (decomposition recommendations `/work` then executes), or skip it intentionally:
>
> ```yaml
> cleanup: skipped
> cleanup_reason: "why skipping is acceptable for this specific plan"
> ```
>
> If the audit is the missing ritual, run `/audit {plan-name}` — a reader that did not build the plan writes `audit.md` (advisory; nothing reads what it says), or skip it intentionally:
>
> ```yaml
> audit: skipped
> audit_reason: "why skipping is acceptable for this specific plan"
> ```
>
> The skip-reasons are recorded in the archive and surfaced in retrospectives. Use sparingly — typically only for trivial typo-fix plans where the ritual cost exceeds the discipline value.
>
> If `promises` is missing, the plan declared a promise (`{the `unprovenPromises` list}`) that no passing test row names. Give the row that tests it a `For` cell naming the promise and a `Test` cell naming its file, and make the row pass. `indusk promises confirm {plan-name}` says exactly what is still unproven, and writes nothing while anything is.

Do not proceed to Step 1 until the gate passes. This is structural enforcement of the discipline documented in the [Falsification Ritual guide](apps/indusk-docs/src/guide/falsification-ritual.md) — happy-path authoring produces happy-path tests, and the ritual is the mechanism for surfacing the gaps the author couldn't think of.

### Step 1: Write the Retrospective Document

Create `.indusk/planning/{plan-name}/retrospective.md` using the template from the plan skill. This is the reflective writing — what we set out to do, what actually happened, what we learned.

Key sections to fill in honestly:
- **What We Set Out to Do** — recap from the brief
- **What Actually Happened** — how did reality differ from the plan?
- **Getting to Done** — the unplanned work, debugging, surprises
- **What We Learned** — technical, process, or domain insights
- **What We'd Do Differently** — hindsight decisions
- **Insights Worth Carrying Forward** — takeaways for future plans

### Step 2: Structural Audit (Code Graph)

**Run `git diff --stat` against the plan's base** to understand what actually changed. Include structural findings in "What Actually Happened" — e.g., "Plan touched 8 files, +900/−250 lines."

### Step 3: Docs Audit

Review every documentation page that was written or updated during this plan's impl phases.

For each page:
- Does it describe what was **actually built**, not what was **planned**?
- Are code examples accurate and runnable?
- Are diagrams up to date with the final architecture?
- Are links valid?

Fix any discrepancies found. Plans often diverge from their impl during execution — the docs must reflect reality.

### Step 4: Test Audit

Review the test files created or modified during this plan.

- Are there obvious coverage gaps? (untested error paths, edge cases, integration points)
- Were any test files planned but not created?
- Do all tests pass? Run `pnpm test` to confirm.

Flag gaps but don't necessarily fix them all now — add them as items to a follow-up plan if they're significant.

#### Step 4a: Test Trajectory Audit

If the impl used a `## Test Trajectory` (frontmatter `trajectory: required`), run the trajectory audit:

```ts
// From apps/indusk-mcp/src/lib/trajectory/audit.ts
import { auditPlanAtClose } from "./audit.js";
const result = auditPlanAtClose(implBody);
// result.deferred: MitigationClassification[] — one per Deferred Verification row
// result.blocked: BlockedRowFinding[] — rows ending in `blocked` state
// result.nonTerminal: NonTerminalRowFinding[] — rows still planned/written although their phase exists
```

For each finding, act on it:

- **Non-terminal rows** — a row still `planned` or `written` in a phase that exists means a phase closed over an open row (the gate that should have refused was off, or the row was never authored). Step 0 already refuses on these; if one reaches this audit, close it honestly: run its test and set `passing`, or `skipped` with the reason, or `blocked` and resolve as below. Never edit the state to make the audit quiet.

- **Blocked rows** — these ended the plan unresolved. For each: either (a) fix the test and update State to `passing` as a retroactive phase-close, (b) move the row's `Passes at` to a later plan with a link, or (c) promote to Deferred Verification with a real mitigation. Do not leave blocked rows unresolved — they're a debt flag.
- **Deferred rows with vague mitigations** (`warning` non-null) — the mitigation text was too short or unclassifiable. Propose a more concrete commitment: a specific OTel metric name, a named review owner with cadence, a linked plan ID, a documented canary procedure. Update the impl.md's Deferred Verification row before archiving.
- **Deferred rows classified as `downstream-plan`** — verify the referenced plan exists and is either `accepted` or `in-progress`. If it's `draft` or missing, either accept the referenced plan now or pick a different mitigation.
- **Deferred rows classified as `telemetry-alert`** — verify the named metric actually exists in the codebase (grep for it). If the metric hasn't been wired up, the mitigation is aspirational — either wire it up now or change the mitigation.

Flag findings as a highlight — the eval agent reads it, materializes a lesson when a durable rule emerged, and marks it processed:

```
mcp__indusk__highlight({
  tag: "retro-audit",
  note: "{plan-name}: {finding classification}; {what was done}; {warning if any}",
  level: "important"
})
```

Include the classification, the warning (if any), and what was done. This is the signal the eval agent uses to detect mitigation drift over time.

### Step 5: Quality Audit

Review mistakes made during this plan's implementation.

- Were there recurring lint errors or type errors during `/work`?
- Did any mistakes suggest a missing Biome rule?
- If yes: add the rule to `biome.json` and document the rationale in `biome-rationale.md`

The quality ratchet only gets tighter. Every retrospective is an opportunity to prevent the same class of mistake from happening again.

**Also record this plan's Shape numbers** — how many findings the Shape step raised across all phases, and how many of those a human judged wrong. Shape's judgment quality has no test and can only be calibrated by observation, so these two counts are the entire evidence base. Write them even when both are zero: "Shape raised nothing" is a data point about whether the check is too quiet, and an absent number is indistinguishable from a plan that never ran it.

**If this is the second consecutive plan reporting findings a human judged wrong, say so explicitly** — that is the trigger to reopen Shape's calibration as a falsification hypothesis against `lifecycle-rebalance`. Nobody else is watching for the streak; it is only visible from here.

### Step 6: Lesson Capture

Review the plan's journey — research, implementation, debugging, surprises — and ask:

**"Did we learn anything non-obvious that applies beyond this specific plan?"**

Examples of good lessons:
- "Never use fallback values where a required config value is expected — it hides missing env vars"
- "Always check if the library has an official plugin before building custom"
- "Run the full test suite after changing shared types, not just the tests in the changed package"

If yes, call `add_lesson` for each one. These become personal lessons in `.claude/lessons/` — available to the agent in every future session across all projects.

If no lessons emerged, that's fine — not every plan produces new knowledge. Move on.

**Also flag each retrospective insight as a highlight** so the eval agent can materialize durable ones into lessons that surface in every future catchup.

For each item in the retrospective's **What We Learned** section:
```
mcp__indusk__highlight({
  tag: "retro-lesson",
  note: "{plan-name}: {the insight, with enough context for the eval agent to write a full episode}",
  level: "important"
})
```

For each item in the retrospective's **What We'd Do Differently** section:
```
mcp__indusk__highlight({
  tag: "retro-hindsight",
  note: "{plan-name}: {the hindsight item, with reasoning}",
  level: "important"
})
```

The eval agent reads each highlight, writes a lesson when it carries a durable rule (`community-` prefix if clearly cross-project), and marks it processed. The working agent does not write the lesson directly.

**Contradictions:** If the retrospective surfaces a moment where "we thought X but found Y", flag it as a highlight naming BOTH the old assumption and the overturning fact — the resulting lesson records the reversal explicitly so a future session doesn't re-introduce the overturned assumption.

Skip silently if `mcp__indusk__highlight` is unavailable — highlights are best-effort, and lesson recording via `add_lesson` remains the canonical local path.

### Step 7: Context Audit

Re-read CLAUDE.md in full. After the entire impl is done, verify:

- **Architecture** — does it reflect the current state of the repo?
- **Conventions** — are all conventions that emerged during this plan captured?
- **Key Decisions** — was the ADR decision added (post-ADR trigger)?
- **Known Gotchas** — were all surprises and corrections captured?
- **`.indusk/current.md`'s Project (shared) region** — does it reflect what's actually in progress? Operational state lives there; the root has no Current State section.
- **Sequence** — does every active plan folder have exactly one fate: a step declared in the root `master.md` sequence, archived with a `closed_reason`, or standalone with a reason written in the master? A folder with none is how a close-out goes unwritten for weeks (indusk-makeover sat `completed` for 53 days in a queue labelled "any time"). Fix it here — declare it, archive it, or write the reason — and write any follow-on this plan surfaced into the brief of the step that owns it, not into this retrospective alone.

Fix any inaccuracies. The impl may have changed things that weren't anticipated in the per-phase context updates.

#### Current State entries are ONE LINE + link to archive (1.31.11)

When you add a Current State entry for a newly-completed plan, write it as **one line + a link to the archive**, not as a multi-paragraph prose entry. Every retrospective accretes Current State; over 20-30 plans, paragraph entries push CLAUDE.md past 30KB of always-loaded prose. The detail lives in the archived plan + the docs site decisions/lessons pages — the Current State entry is a pointer, not a duplicate.

**Use this shape:**

```markdown
- **{plan-name} ({version})** — one-sentence summary of what shipped. See [archive](.indusk/planning/archive/{plan-name}/) for full detail.
```

Example:

```markdown
- **workbench-mode-rail-integrity (1.31.10)** — eval→Graphiti pipeline works on workbench-shaped projects; 4 hooks refactored, stray-state audit added, falsification surfaced 2 more bugs both fixed. See [archive](.indusk/planning/archive/workbench-mode-rail-integrity/) for full detail.
```

**Counter-example — do NOT write this shape going forward**:

```markdown
- **plan-name shipped in 1.X.Y (2026-XX-XX)** — three paragraphs of detail
  about what the plan did, what shipped in each phase, what bugs were
  found in falsification, what lessons were captured, what's deferred to
  follow-up work, with embedded code references and file paths and...
  [continues for ~500 chars]
```

The counter-example is **token bloat on every catchup**, paid by every Claude Code session forever. The one-line shape preserves discoverability (the plan name + version + link is enough for the agent to know what to query) at a fraction of the cost.

Existing multi-paragraph entries (pre-1.31.11) can be collapsed via `indusk prune --dry-run` (which surfaces them) plus manual operator cleanup — they are not auto-migrated.

#### Classification at close (context-tiers — where every rule this plan wrote belongs)

Adding one-line entries stops NEW growth; this step decides where each rule lives. As part of every plan close:

1. **Classify every context entry this plan authored** by the tier table in `/claude-md`: an enforcer that names its lesson, the area's `CLAUDE.md`, `.indusk/current.md`, or the root with the reason it must be always-on. Move each to its tier and compress it to rule + pointer; the plan's operational narrative goes to `current.md` as the one closed line above. **The rule stays; the narrative moves behind the pointer.**
2. **The periodic pass — move one root entry down a tier.** Pick one root entry that an enforcer now catches or that applies to one area, and move it: to a `lesson:` token in its enforcer, or into the area's file. Shortening it in place does not count. One per retrospective keeps the root shrinking without a dedicated session.
3. **Verify pointers**: run `indusk context check-pointers` — it walks every context file, and every pointer and lesson token you just wrote must resolve. A dead pointer under this regime is a lost rule body.
4. **If the plan touched any `CLAUDE.md`**, run the nested-context probe: `pnpm e2e -- context-tiers`. The loading it guards is observed behaviour, not documented; a red probe blocks the release.

The `claude-md-budget.js` hook enforces the 60 KB ceiling at write time (`context.claude_md_budget_bytes`); if your retrospective edit trips it, do more of step 1/2 rather than fighting the hook. If the file is *already* multiples over budget (the hook was installed after it grew, or incremental compaction never ran), this per-close step can't catch up on its own — run `/compact-context` (the bulk-remediation companion) for a full editorial pass. See [the context-budget guide](../../docs/src/guide/context-budget.md).

Why this matters: CLAUDE.md is auto-loaded into every Claude Code session. Every byte you add accrues to every prompt indefinitely. The discipline is "thinner navigation layer, queryable detail" — see [context-budget brief](../../.indusk/planning/context-budget/brief.md) for the full rationale.

### Step 8: Knowledge Handoff

Distill planning artifacts into the docs site so the knowledge survives archival.

**ADR → Decisions page:**
Create `apps/indusk-docs/src/decisions/{plan-name}.md` with:
- A concise summary of what was decided and why
- Link to the full ADR in the archive: `.indusk/planning/archive/{plan-name}/adr.md`
- Key tradeoffs accepted

**Retrospective insights → Lessons page:**
If the retrospective produced broadly useful insights, create `apps/indusk-docs/src/lessons/{plan-name}.md` with:
- What we learned that applies beyond this specific plan
- What we'd do differently and why

Not every plan produces a lessons page — only create one if the insights are genuinely reusable.

**Update sidebar:** Add new decision/lesson pages to the VitePress sidebar config in `apps/indusk-docs/src/.vitepress/config.ts`.

### Step 8a: Confirm — the plan's promises become enforced

A plan closes with its promises proven. Before the folder is archived, run:

```bash
indusk promises confirm {plan-name}
```

(or the `confirm_promises` tool). For each promise the plan declared, it sets `tests:` to the test files the plan's rows name, `sites:` to the other files that carry the promise's token, and `state: enforced`; a promise the plan replaces is retired; then the registry check runs. It writes plan documents and commits nothing — commit the registry with the archive.

It refuses, naming each promise, and writes nothing when:

- no row names the promise, or a row that names it is not `passing`;
- a test file a row names is missing, or does not carry `promise: <name>`;
- no code carries the token, for a `behaviour` or `state` promise;
- code still names a promise this plan replaces;
- the brief lists a change or a replacement the plan never made (`indusk promises change` / `replace`).

Fix what it names and run it again. **Do not archive past a refusal**: a `declared` promise whose plan is archived fails `indusk promises check`, and with it the next `pnpm test`.

**In a workbench**, the plan's tests exist only in its own code worktree until Step 10 lands them, so name it: `indusk promises confirm {plan-name} --code-root <the plan's code worktree>`.

A plan that declared no promise has nothing to confirm, and the command says so.

### Step 9: Archival

Move the planning artifacts to the archive:

```bash
mkdir -p .indusk/planning/archive
mv .indusk/planning/{plan-name} .indusk/planning/archive/{plan-name}
```

The docs site now holds the published knowledge. The archive holds the process history. Both are preserved, but the docs are the primary reference going forward.

Update `.indusk/current.md`'s Project (shared) region: the plan leaves the in-flight list and gets its one closed line there.

### Step 10: Land — the branch reaches main, and is gone

Archival is the branch's last write. Worktree-per-plan opened a branch at Phase 1, and **a plan is not closed until that branch is on `main` and deleted**. Nothing before this step puts the archive, the docs pages or the code on trunk; the retrospective's own commits sit on the branch until someone merges. The cost of leaving this to memory is on the record: plans have shipped on branches nobody merged, had their code dropped as superseded, and once a publish went out a minute before a plan branch merged.

**What this project runs is its own.** Before anything below, run `indusk checks show`: it names the project's slow tests, its release command, its version file and its changelog, from `workflow.steps` in `.indusk/config.json`, or says plainly that one is not declared and what that means. Use only what it names. A project that declares no slow tests runs none at landing; one that declares no release command has nothing to publish, and the plan closes at this step.

Do it in this order, all from the plan's worktree until the merge itself:

1. **Confirm the branch is clean and closed** — `git status --short` empty; Steps 0–9 done (the archive folder is committed on the branch).
2. **Integrate trunk into the branch** — `git fetch origin && git merge main` (or `origin/main`) *in the worktree*, and resolve what conflicts once. Do not rebase a plan branch: a rebase replays every commit and re-asks the same append-only-ledger conflict on each of them. Then run the project's everyday tests and, if it declares slow tests, `indusk checks slow` — landing is when the slow tier runs, since phases run only what they touched; a green branch before the merge says nothing about the branch after it. `indusk checks slow` records a fully green run on a clean tree, so the release on the same code does not run it again. A ledger that conflicts here is missing its `merge=union` line in `.gitattributes` — add it in the same commit that resolves the conflict.
3. **Check trunk's working tree on every path the branch touches** — `git -C <trunk> status --short`. A merge is refused when trunk has uncommitted changes on a file the branch also changed (`.indusk/planning/master.md` and `.indusk/current.md` are the usual ones — every plan writes both). Those changes belong to whoever made them: if `indusk agent list` shows another live session on trunk, **ask** — never commit, stash or discard another session's work to clear your own path. A bare `git stash` on a shared stack is off the table regardless (see the git skill).
4. **Land** — `indusk plans land {plan-name}`. It refuses a plan that has not been accepted (`indusk plans accept {plan-name}`, Accept in the admin, or a project set to `release.auto_accept`), naming it: a plan's build reaches `main` only once someone, or its workflow, has accepted it. It then merges `main` into the branch, runs `plans.land_checks` from `.indusk/config.json`, merges the branch into `main` with `--no-ff`, releases the assignment, removes the worktree and deletes the branch — and refuses, with nothing done, when the trunk has uncommitted changes on a path the branch touches (step 3), or when the `indusk` running it is installed from the plan's worktree, which it would delete mid-run (an install run on the branch links it there): install from the trunk first, then land. With reviewers instead: push and open the PR, merge it, pull trunk, then `indusk worktree release {plan-name}`, `git worktree remove <worktree-path>` and `git branch -d plan/{plan-name}`.
5. **Delete the remote branch** if it was pushed — `git push origin --delete plan/{plan-name}`. A worktree left behind is a stale build lock, a stale build output, and a `⚠ collision` in the next `indusk agent list`.
6. **Verify on trunk** — `git for-each-ref refs/heads/plan/* --no-merged HEAD` no longer lists the plan; `.indusk/planning/archive/{plan-name}/` exists on trunk; `indusk context check-pointers` passes there too (CLAUDE.md pointers were written on the branch and are only now on trunk).
7. **Install the landed build**, if the project declares how — `indusk checks show` names it under "install" (`workflow.steps.land.install`; dusk's is `pnpm install:local`, which builds what a publish builds and links the checkout into the global `indusk`). Run it on trunk, then confirm from another directory that `indusk --version` reports the landed version; if the admin daemon was started from the removed worktree, `indusk ui restart`. A project that declares none installs nothing here: its build reaches machines by a publish.
8. **Record the landing** — append one line to the archived `retrospective.md` on trunk: `Landed on main at <sha>, <date>.` Commit it on trunk. That line is what distinguishes a closed plan from a merged one when the two are read months later.

**The bump is Step 11, not a thing to remember.** It happens on trunk, immediately after this step, in a project that publishes per plan. Publishing itself stays the operator's call.

### Step 11: Bump — the version that describes this tree

A project that declares no release command (`indusk checks show` says "nothing to publish") has nothing to bump: **say so, record it in the retrospective, and stop.** Skipping is a finding, not an absence.

A project that installs its own build (step 7 above ran a `land.install`) publishes deliberately, not per plan: when a deployed server, another project or another machine needs the new version. Unless the person has said this close is one of those, **say that the build is installed and nothing is published, record it in the retrospective, and stop.** When it is, carry on below; the project's release command runs its slow tier itself, before it publishes, since nothing at landing did.

Otherwise: bump on main, after the branch is merged. Step 10 just merged and is standing on main. This is that moment, and it is the only one that knows what shipped.

**First, is there anything to release?** The question is what the release covers that changed **since the last release commit** (the last commit whose message begins `chore(release):`) — not what the last commit changed. Step 10 ends by committing the landing note on trunk, so the last commit is always that note. Ask git: `git -C <trunk> diff --name-only <release-commit>..HEAD -- <covered paths>`, the covered paths being what `indusk checks show` lists under "slow tests cover". This counts every plan that landed since the last release, not only this one — which is right: the bump describes the tree. The same reads answer whether a publish is current, any time it is asked: `git rev-list <release-commit>..HEAD` and `git for-each-ref refs/heads/plan/* --no-merged HEAD`, never a version number — `pnpm publish` packs the working tree, so a publish from clean main is blind to every `plan/*` worktree.

If it names nothing, **say so and stop**: *"Nothing the release covers changed — the version stays at X.Y.Z."* Record that in the retrospective.

**If it did, choose the increment.** You have just written the retrospective, so you know which this is:

- **minor** — the plan added a capability someone can now use: a command, a tool, a config key, a behaviour that did not exist.
- **patch** — the plan fixed, hardened or refactored something already shipped.

When a plan genuinely did both, it is a minor. When you cannot tell, it is a minor — under-describing a release is the cheaper error.

**Then, the writes and one commit**, using the files `indusk checks show` names:

1. **The changelog**, if one is declared. It opens with `## [Unreleased]` holding the entries this plan (and any plan that landed since the last release) already wrote. Roll it: leave `## [Unreleased]` empty at the top and insert `## [X.Y.Z] — <today>` beneath it.
2. **The version**, in the declared version file, and nothing else.
3. **The commit**, on trunk, whose *first line* begins exactly `chore(release): X.Y.Z` — release checks find the release commit by it, and `trunk-guard.js` exempts it from the no-code-on-trunk rule by reading it. Pass the message as a **literal `-m`**, or with `-F <file>`; a message built by a heredoc or `$(…)` is *not* read.

If trunk-guard refuses editing the version file or the changelog on trunk, make the two edits on a short release branch, commit `chore(release): X.Y.Z` there, and fast-forward trunk to it, so trunk's HEAD is the release commit. Never route around the refusal with a shell write.

**Then stop.** Running the release command is the operator's decision, and a publish usually needs a credential an agent cannot enter. Say that the bump is committed and the tree is ready. Before handing over: if the project declares slow tests at landing, run `indusk checks slow --unless-covered` — it should say they are covered by landing's green run, and if it runs them instead, something the release covers changed since landing, so say so before the operator finds out the slow way. If the project's release command begins with its own guard script, run that guard alone too, so its refusals are not the first thing the operator sees. If the release also publishes an image (dusk's builds and pushes the recording server's before `pnpm publish`), say that the release machine needs Docker running and a one-time `docker login` to its registry — a refused push stops the release with nothing published.

## Important

- Work through the steps in order. Each builds on the previous.
- The retrospective document is reflective writing, not a status report. Be honest about what went wrong.
- The docs audit checks reality against documentation, not documentation against the plan.
- The quality ratchet only gets tighter — never remove Biome rules during a retrospective.
- Archival is a knowledge handoff, not just filing. The docs site must capture what matters before the plan moves to archive.
- If you discover significant issues during any audit step, flag them to the user before continuing.
