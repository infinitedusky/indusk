---
name: work
description: Execute an implementation plan by working through its checklist. Reads the full plan context first, then works items in order, checking each off as it's completed.
argument-hint: "[plan name or keyword]"
---

You know how to execute plans in this project.

## How Work Works Here

Implementation plans live in `.indusk/planning/{plan-name}/impl.md` as checklists. Your job is to work through them methodically — one item at a time, in order, checking each off immediately after completing it.

## What to Do When Asked to Work

1. **Find the right plan.** Look in `.indusk/planning/` for the plan matching what the user asked for. If they didn't specify, list all plans that have an impl with status `approved` or `in-progress` and ask which one.

2. **Check prerequisites.** Before starting work:
   - If the plan has an ADR, verify its status is `accepted`. If it's still `proposed`, warn the user: "The ADR hasn't been accepted yet — want to review it first, or proceed anyway?"
   - If the brief has a `## Depends On` section, check that blocking plans are completed or far enough along.

3. **Check for blockers.** Scan the current phase for `blocker:` lines. If found, stop and present the blocker to the user:
   > "Phase 3 has a blocker: *the upstream API doesn't support batch requests — Phase 3 scope needs revision*. Want to resolve this before proceeding?"
   Do not attempt to work around a blocker silently. Blockers mean the plan needs revision.

4. **Read forward intelligence.** If the previous phase has a `#### Phase N Forward Intelligence` section, read it before starting the current phase. Pay attention to:
   - **Fragile** items — be extra careful with these files/modules
   - **Watch out** items — these are known downstream risks
   - **Assumption** items — verify these are still true before relying on them

5. **Read the full plan context first.** Before touching any code, read everything in the plan folder — research, brief, ADR, impl. These contain the decisions and reasoning that should guide implementation choices. Don't just read the checklist.

6. **Update status.** If the impl status is `approved`, change it to `in-progress`.

7. **Work through the checklist in order.**
   - Start from the first unchecked item (`- [ ]`)
   - For each item:
     a. **Check blast radius** — grep for the symbol's importers/callers before touching any file.
     b. **Check for existing code** — call `find_code` before writing new functions. Reuse, don't duplicate.
     c. Read the relevant source files
     d. Implement the change
     e. Immediately edit impl.md to check the item off (`- [ ]` → `- [x]`)
     f. Move to the next item
   - Do NOT skip ahead or work out of order unless there's a dependency reason
   - Do NOT batch checklist updates — check each off as soon as it's done

8. **Handle blockers.** If you can't complete an item:
   - Add a note to impl.md under the item explaining the blocker
   - Move to the next item if possible
   - Flag the blocker to the user

9. **Add discovered work.** If you find something that needs doing that isn't in the checklist:
   - Add it as a new item in the appropriate phase
   - Then do it and check it off

10. **Per-phase completion order.** Each phase has up to five types of items. Complete them in this order:

   **Implementation items** → build the thing
   **OTel items** → instrument it (spans, categories, error recording — see OTel skill)
   **Verification items** → prove it works (tests, type checks, commands — can include trace verification)
   → **Shape** → review the code this phase wrote for craft (see "The Shape Step" below) — *not an item type; a step you perform*
   **Context items** → capture what changed (concrete CLAUDE.md edits)
   **Document items** → write or update docs pages (see document skill)

   A phase is not complete until all five are done. **Enforced by hooks:** if you try to check off a Phase N+1 implementation item while Phase N has unchecked gates, the edit will be blocked with a message listing what's missing. Complete the gates first.

   Shape sits between Verification and Context and is **executor behavior, not plan structure** — there is no `#### Phase N Shape` heading and nothing to add to any impl. It runs after Verification because restructuring code whose correctness is unproven is how a refactor hides a bug.

## Test Trajectory — Phase Responsibilities

If the impl has a `## Test Trajectory` table (frontmatter `trajectory: required`), the work skill takes on two additional responsibilities at phase boundaries.

### Executing a test phase

An impl with `test_phases: required` opens with `### Test Phase 1` before any `### Build Phase N`. Its checklist items *are* the authoring work, so executing it means:

1. **Author every row the phase names**, then run them and read each failure. A row is `written` when its test exists and fails **on its own assertion**.
2. **Reject a red that is really a load error.** A test whose file cannot resolve an import has not been authored — it is an absent test wearing a failure's clothes, and the exit code looks identical to a real failure. When that happens the honest move is to defer the row into the register, not to keep the file.
3. **Review the register before opening any build phase.** Read each `#### Deferred to …` entry's carried body against two questions: *will this compile at the phase it names*, and *does it assert the behaviour it claims?* This is the compensating control for the fact that a fake red cannot be detected mechanically — and it is a pause point under autopilot, because it is human judgement rather than a check.
4. The phase's Verification gate cannot be checked while any row it authors is still unwritten. `check-gates` enforces that; the review above is what makes closing it mean something.

**Real red vs fake red — the boundary rule.** A test that reaches its subject *over a boundary* — HTTP, a CLI, a query, the filesystem, a spawned process — gives a genuine red on day one: 404, non-zero exit, missing table, no such file. A test that `import`s its subject cannot, because module resolution precedes test collection. When authoring early, prefer the boundary.

### At phase start — author writable-at-phase tests

Before starting implementation items for Phase N:

1. Read the Test Trajectory. Collect every row with `Writable at: Phase N` whose `State` is `planned` or `writable`.
2. For each such row: create the test file (or add the test case to an existing file) implementing the `Asserts` description. Commit it as failing.
3. Update each row's `State` to `written` in the trajectory table.

**Do not use `.skip()` to defer a test whose subject does not exist.** It does not work: module resolution happens before test collection, so a file importing a symbol that isn't there fails to load *even when every test in it is skipped* — the suite goes red and the row is not authored in any meaningful sense. (Asserted against the real runner, not reasoned about: `skip-does-not-defer.test.ts`.) `.skip()` is right when the **symbol exists and the behaviour does not** — a placeholder for a code path not yet wired. When the symbol does not exist, defer the row into Test Phase 1's register with its body carried as a fenced block, which is checkable and does not pretend.

These tests are the contract for the phase. They fail when the phase begins; they pass when it ends.

### At phase close — verify passes-at-phase tests

Before advancing past Phase N (i.e., before checking the first implementation item in Phase N+1):

1. Collect every row with `Passes at: Phase N`.
2. Run the tests. For each row whose test now passes, update its `State` to `passing` in the trajectory table.
3. If a test is explicitly skipped (approval test awaiting first run, platform-specific test), update to `skipped` with an inline comment on the reason.
4. If a test regressed or its dependencies changed unexpectedly, update to `blocked` — then resolve it (fix the test, or move its `Passes at` to a later phase with a reason).
5. The `check-gates` hook rejects the phase transition if any `Passes at: Phase N` row is still in `planned`, `writable`, or `written` state. This is structural enforcement of "deferral is impossible."

### State lifecycle

```
planned → writable → written → passing
                              ↘ skipped (with reason)
                              ↘ blocked (needs investigation)
```

| State | Meaning |
|-------|---------|
| `planned` | Row exists in the trajectory, no file yet |
| `writable` | Dependencies exist; test can now be authored |
| `written` | Test file exists and runs (fails or is `.skip()`) |
| `passing` | Test runs and passes |
| `skipped` | Intentionally `.skip()` with a documented reason |
| `blocked` | Was writable/written, now regressed or changed; needs investigation |

### Library helpers

The `apps/indusk-mcp/src/lib/trajectory/state-ops.ts` module provides:

- `getRowsWritableAt(trajectory, phase)` — rows to author at phase start
- `getRowsBlockingPhaseClose(trajectory, phase)` — rows preventing phase close
- `updateRowState(body, id, newState)` — rewrite the State cell in impl.md body
- `getPhaseStartNudge(body, phase)` / `getPhaseCloseNudge(body, phase)` — human-readable reminder text

Call these via `tsx` or through the InDusk MCP (once wired) rather than re-parsing the table by hand.

### Deferred Verification audit

The retrospective skill audits Deferred Verification rows at plan close — checking that each row's `mitigation:` field was actually wired up (telemetry configured, review scheduled, downstream plan linked). Work skill just maintains the Trajectory; retrospective validates completeness at the end.

## The Shape Step

Craft feedback belongs in the phase that wrote the code, not four phases later at plan close. Shape is the check that puts it there: after a phase's Verification is green, you review the code that phase wrote against the craft rules of the project's enabled extensions, and anything you find becomes a checklist item in that same phase.

**You perform this review yourself.** There is no extra model call, no spawned checker, and no heuristic — you are already a model, the extensions' rules are prose, and prose needs a reader. `lib/shape/` supplies only facts.

### At phase start — open the boundary

Before the first implementation item of Phase N, record where the phase began. Without this Shape cannot tell your work from the previous phase's, and it refuses to guess.

**In a consumer project** — import the published subpath, from the repo root:

```bash
node -e '
  import("@infinitedusky/indusk-mcp/shape/boundary").then(({ recordPhaseStart }) =>
    recordPhaseStart(process.cwd(), {
      plan: "<plan>", phase: <N>,
      sha: process.env.SHA, at: new Date().toISOString(),
    }));
' SHA="$(git rev-parse HEAD)"
```

**In the dusk monorepo** — run through the package that owns the source:

```bash
cd apps/indusk-mcp && pnpm exec tsx -e '
  import { recordPhaseStart } from "./src/lib/shape/boundary.ts";
  import { execFileSync } from "node:child_process";
  const root = process.cwd().replace(/\/apps\/indusk-mcp$/, "");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf-8" }).trim();
  recordPhaseStart(root, { plan: "<plan>", phase: <N>, sha, at: new Date().toISOString() })
    .then(() => console.log("opened phase <N>"));
'
```

Two things that will bite you, both found by running these rather than reasoning about them: **`tsx` is not on `PATH`** (it is a dependency of `indusk-mcp`, so it needs `pnpm exec` from inside that package — `pnpm exec tsx` at the repo root fails too), and **top-level `await` does not work in `tsx -e`** — use `.then()`. An earlier version of this section documented a bare `tsx -e` with top-level `await`; it failed on both counts, and nobody noticed because no test executes a command written in a skill.

The record is generic (`{plan, phase, sha, at}`) and shared — `verify` and `Challenge` read the same artifact rather than each growing their own ledger.

### After Verification — run the review

1. **Ask for the review inputs.** `prepareShapeReview({ root, plan, phase, implBody })` returns either the files this phase changed plus the rule set, or a reason there is nothing to review.

2. **If it returns `skipped`, record the reason and move on.** Two reasons exist: verification is not green (finish it first, then come back), or the phase changed no code files. Never skip silently — a check that cannot distinguish "nothing to do" from "did not run" reports the shape of success without doing the work.

3. **Check `rules.unreadable` before you judge anything.** Any name in it is an enabled extension that declares craft prose the collector could not read — the project believes that standard is in force and it is not. Say so to the user rather than reviewing against a silently reduced standard; an empty list means every enabled extension was readable, which is a different fact from "no extensions had anything to say."

4. **If it returns `review`, read the files and judge them against the rules.** The question is *intra-unit*: is this unit well-formed as written?
   - Does it have one reason to change, or is it doing two jobs?
   - Should this inline block have been a named function or module?
   - Does the name say what it is for, rather than how it works?
   - Is there a seam a test can reach?

   **Not in scope:** cross-file duplication, the rule of three, module boundaries. Those need the finished whole and belong to `/cleanup` at close. The rule set states this explicitly — respect it, or the two rituals fight over the same territory and neither owns it.

5. **Append what you find** via `appendFindingToPhase(implBody, phase, { file, change, rule })`, naming both the change and the rule it came from — a finding without its basis is unreviewable. It lands as an *unchecked implementation item in the current phase*, so the existing gate machinery makes it non-ignorable without Shape blocking anything itself. Then work it like any other item.

   These functions return the edited body and never write. **You** make the edit, so it passes through the same PreToolUse gate chain as any other impl edit.

6. **If you find nothing, say so** — `recordReviewedNothingFound(implBody, phase)` appends an already-checked note. This should be a common answer. If Shape fires on every phase its items become noise to tick through, which is worse than not running it.

7. **If you considered a file and deliberately left it alone**, record that with its reasoning — `recordLeftAsIs(implBody, phase, file, reason)`. "Considered, and here is why it stays" is a different claim from "no finding," and only one of them is reviewable later.

### What Shape is not

- Not a gate type. No heading, no validator rule, nothing to retrofit into existing impls.
- Not blocking. A craft judgment is fuzzier than the structural gates; a false positive halting an unattended run is worse than an extraction landing one phase late.
- Not a line counter. The motivating case was fifteen lines and crossed no threshold — it was wrong because it should have had a name and a test.

## Gate Override Policy

Gates exist to prevent skipping important work. But sometimes a gate genuinely doesn't apply. The override policy controls what happens when the agent wants to skip a gate item.

Three modes, configured via `gate_policy` in the impl frontmatter or `.claude/settings.json`:

| Mode | Behavior |
|------|----------|
| **`strict`** | No overrides at any stage. Every gate must have a real item when the impl is written (`/planner`), and every item must be completed during `/work`. No `(none needed)`, no `skip-reason:`, no conversation proof. |
| **`ask`** (default) | Every gate must have a real item when the impl is written. During `/work`, the agent must ask the user before skipping, and include proof of the conversation in the skip format. Hooks enforce both stages. |
| **`auto`** | Gates can be pre-filled with `(none needed)` or `skip-reason:` at write time. During `/work`, the agent can skip without asking. Use when running autonomously. |

### How to set the mode

**Per-plan** (in impl frontmatter):
```yaml
---
title: "My Plan"
gate_policy: strict
---
```

**Per-project** (in `.claude/settings.json`):
```json
{
  "indusk": {
    "gate_policy": "ask"
  }
}
```

**Per-invocation**: `/work --strict`, `/work --ask`, `/work --auto`

Priority: per-invocation > per-plan > per-project > default (`ask`).

### What "ask" mode looks like

When the agent encounters a gate item it thinks should be skipped:

> "Phase 2 has a Document gate: 'Write reference page for the new API.' I don't think this phase needs a new docs page because we only changed internal implementation — the public API didn't change. Can I skip the document gate?"

The user can say:
- **"yes, skip it"** — agent marks it with conversation proof and continues
- **"no, do it"** — agent completes the gate item

### Conversation proof format (enforced by hooks)

In `ask` mode, skipped gates MUST include proof that the conversation happened:

```markdown
#### Phase 2 Document
- [x] (none needed — asked: "Phase 2 is internal refactoring with no public API changes. Can I skip the document gate?" — user: "yes, skip it")
```

The hook validates that both `asked:` and `user:` are present with non-empty quoted content. Bare `(none needed)` or `skip-reason:` without conversation proof will be **blocked by the hook**.

| Mode | At write time (`/planner`) | At execution time (`/work`) |
|------|------------------------|---------------------------|
| `strict` | No opt-outs — real items required | No skipping — everything completed |
| `ask` | No opt-outs — real items required | Skip only with conversation proof |
| `auto` | `(none needed)` / `skip-reason:` allowed | Skip without asking |

**The agent must NEVER skip a gate without asking in `ask` mode.** This is enforced by hooks at both stages — not just instructional.

11. **Verification items.** The Verification section requires proof, not assumption. See the verify skill for full guidance.
   - Run checks in order: type check → lint → affected tests → build. Skip checks that don't apply (see verify skill's skip logic table).
   - Run commands and capture output — verification items must be specific runnable commands, not "verify it works"
   - If a check fails: read the error, fix it, re-run only the failing check. Max 3 attempts before flagging as a blocker to the user.
   - Check items off only when actually verified, not assumed

12. **Context items.** The Context section specifies concrete CLAUDE.md edits:
    - Each item is a specific edit: "Add to Architecture: ...", "Add to Conventions: ...", etc.
    - Make the edit to CLAUDE.md, then check the item off
    - If a phase has no context items, that's fine — not every phase changes project context

13. **Document items.** The Document section specifies docs pages to write or update:
    - Each item targets a specific page in `apps/indusk-docs/src/`
    - See the document skill for guidance on what to document, where, and how to use Mermaid diagrams
    - If a phase has no document items, that's fine — not every phase produces user-facing documentation

14. **Phase transitions.** When all items in a phase (implementation + verification + context + document) are checked, note it and move to the next phase.

15. **Completion.** When all phases are checked:
    - Update impl status to `completed`
    - Summarize what was done
    - If this plan included an ADR, confirm CLAUDE.md's Key Decisions was updated
    - **Run `/falsify {plan}` next, before `/retrospective`.** The falsification ritual is the bridge between "impl done" and "plan archived." It drives the same working agent through a goal-flipped bounty hunt — investigate the code, form a specific hypothesis about what should be broken, write the test that confirms it. The ritual may surface gaps worth addressing, which can reopen the impl (status flips back to `in-progress`) for a fix-in-scope phase, or spawn a new plan, or be recorded as a finding. Only after `/falsify` terminates cleanly — or has been explicitly skipped via `falsification: skipped` + `falsification_reason: "..."` in the impl frontmatter — is the plan ready for `/retrospective`. See the [Falsification Ritual guide](apps/indusk-docs/src/guide/falsification-ritual.md) and `.indusk/planning/archive/falsification-ritual/adr.md`.
    - **Then run `/cleanup {plan}`, before `/retrospective`.** The cleanup ritual is falsification's twin: it reviews the plan's changed files for decomposition, applies the enabled domain extensions' best practices (nextjs/react/…), and authors a `### Phase N: Cleanup` phase that `/work` executes. Runs AFTER falsification — refactor under the green coverage falsification hardened. Skip via `cleanup: skipped` + `cleanup_reason` for trivial plans. `/retrospective` Step 0 blocks without a terminal Cleanup Phase or the skip. See the cleanup skill.
    - Let the user know: "Impl complete. Run `/falsify {plan}` next, then `/cleanup {plan}` (decomposition review); then `/retrospective {plan}` closes out the plan."

## Teach Mode

When invoked as `/work teach` or `/work --teach {plan}`, slow down to a mentoring pace. The goal is for the developer to understand every change, not just get the code written.

### Before each edit:

**Where we are:** State the current position in the system — which plan, which phase, which gate (implementation/verification/context/document), and why this gate exists. Example: "We're in Phase 3 of the auth-system plan, working through implementation items. After these, we'll verify with type checks and tests, then update CLAUDE.md with what changed, then document it. That's the four-gate cycle that every phase goes through."

**Why this change:** Explain what you're about to modify and why. Reference the plan, the architecture, and the reasoning. Use plain language.

Then **stop and wait** for the user to say "continue" before making the edit.

### After each edit:

**What changed:** Explain what was modified — the specific lines, the pattern used, why this approach over alternatives.

**What to notice:** Point out the interesting parts — the design pattern, the gotcha you avoided, the convention being followed.

Then **stop and wait** for the user to say "continue" before moving to the next item.

### At gate transitions:

When moving between gates (implement → otel → verify → context → document → next phase), explain the transition: what gate you're entering, why it exists, and what it catches. Example: "Code is written. Now OTel — instrument the new code paths. Then verify — type check, lint, tests, trace verification. Then context and docs."

### Between checklist items:

Summarize what was accomplished and preview the next item. Explain how they connect — both in terms of the feature being built and the InDusk system driving the process.

### Document gate in teach mode:

In teach mode, every Document gate produces two things:
1. **Standard docs** — the same reference/guide updates you'd write in normal mode
2. **Learning entry** — what the developer should take away from this phase: what surprised us, what we chose and why, what conceptual connections to notice

See the document skill's "Two Documentation Layers" section for details. The learning journal is what makes teach mode a teaching tool, not just a slow mode.

### Important for teach mode:

- Never batch multiple edits between pauses
- Use clear headings to separate teaching from doing
- If the user asks a question, answer it fully before continuing
- Always give both layers: the **what** (the feature/code) and the **why** (the InDusk system's reasoning)
- Normal `/work` (without teach) remains unchanged — fast execution, no pauses

## Autopilot Mode

When invoked as `/work --autopilot {plan}`, execute the plan's remaining phases **hands-off, each phase in a fresh subagent context**, advancing only when a phase's gates pass, and pausing at human-judgment gates. This is interactive `/work` looped through fresh contexts — same gate rigor, no per-phase manual handoff.

**Why fresh-context-per-phase, and why it's safe.** Each phase executes best in a clean context window (accumulated context degrades careful/fund-critical work), and a subagent spawn gives that for free — its heavy working context is discarded; only a compact result returns. The safety is not "trust the subagent" — it's structural: **subagent tool calls fire this project's PreToolUse gate hooks, and a gate hook's block (exit 2) denies the subagent's edit exactly as it denies the main session's** (verified empirically — the `work-autopilot` spike). So an autopilot subagent physically cannot check off a phase whose trajectory `Passes at` rows aren't green, cannot skip test-first-RED, cannot advance a red gate. Autopilot inherits the rails; it does not re-implement them.

### The loop

**Before launching:** confirm the plan has an `approved`/`in-progress` impl with remaining phases and a worktree (create it if the frontmatter doesn't say `worktree: none`). **State the cost and get a go** — N fresh subagents each do a catchup + a full phase; this spends real tokens. Autopilot is opt-in per run.

**For each remaining phase, in order:**

1. **Is this phase a human gate? Derive it — don't require a new marker.** A phase is a pause point when its Verification references a **Deferred Verification** row, or a manual/smoke/visual-judgment item ("manual smoke", "browser smoke", "does it look right", a `U`-prefixed deferred row). Those are the plan's already-declared "cannot be structurally verified — a human must look" points. If the phase is a human gate: **PAUSE**, tell the user exactly what to check and why, and resume only on their approval. Do not spawn a subagent to self-approve visual/UX/fund-boundary judgment.
2. **Otherwise, spawn a fresh subagent** (Task/Agent tool) with a tight contract:
   > "Execute **only Phase N** of `{plan}` in worktree `{path}`. Catch up from the plan docs + `.indusk/current.md` cursor, then work the Phase N checklist under the gate hooks: test-first (author the writable-at-phase tests RED), implement, verify, commit per item. **You MUST NOT edit the `## Test Trajectory` table or any test's assertion text — you may only check off items and write implementation code.** When done, report a COMPACT result: what shipped, which tests are green (by name), and any blocker. Do not touch other phases."
3. **Keep only the compact result** — not the phase's working context. That is the fresh-context-per-phase property, and it's what lets the orchestrator run a long plan without exhausting its own window.
4. **Confirm green independently before advancing** (defense in depth on top of the subagent's inherited hooks): run `check-gates` for the phase (the same hook, invoked deliberately) and confirm every `Passes at: Phase N` trajectory row is terminal. Trust the structure, not the subagent's self-report.
5. **Goalpost guard (R4).** Before the phase, snapshot the Test Trajectory table (each row's `Asserts` text + `Passes at`). After the phase, verify **no `Asserts` text changed and no `Passes at` moved to a later phase** — a subagent that couldn't reach green must not have weakened a test or deferred a row to fake completion. If the trajectory drifted, **STOP LOUD** and surface it; that's a gamed gate, not a passed one.
6. **Red or blocker → STOP LOUD.** A failing verification, a blocked edit the subagent couldn't resolve, or a drifted trajectory halts the loop and surfaces the blocker to the human. Never advance on red. Do **not** auto-retry-and-mutate — one honest attempt per phase; a phase that can't reach green is a human decision, not a machine loop. (Per-phase iteration inside the subagent is fine; cross-phase barreling-on is not.)
7. **Per-phase commit + eval.** Each phase's subagent commits per item, so a bad phase is an isolated, revertable unit and the eval trigger fires at its natural granularity.

**Hard stop at impl-complete.** When the last phase closes, **stop and hand back to the human for `/falsify`.** Autopilot loops *impl phases only* — it never auto-runs the close-out rituals (`/falsify`, `/cleanup`, `/retrospective`). Those are human-gated by design: falsification is adversarial self-examination the author is worst-placed to automate, and cleanup + retrospective need judgment. Autopilot gets the plan to "impl complete, all phases green"; the human drives it home.

### What autopilot does NOT do

- It does not replace interactive `/work` — `/work` stays the default; autopilot is additive.
- It does not run phases in parallel (they're a dependency chain).
- It does not auto-fix a red gate beyond the subagent's own in-phase attempt — it STOPS.
- It does not edit trajectories or test assertions (the goalpost guard forbids it).
- It does not run the close-out rituals.

### Deterministic engine (optional)

Where the harness `Workflow` tool is available, the loop can run as a Workflow (sequential, one phase per stage, budget-bounded) instead of a hand-driven subagent loop — this adds a hard token budget and deterministic control flow. The contract above is identical either way; Workflow is the more rigorous executor, the sequential Agent-tool loop is the always-available fallback.

## Corrections and Context Learning

When you are corrected mid-work — the user says "no, not that way" or "don't do X, do Y" — suggest capturing it with `context learn`:

> "Should I capture this? `/context learn 'use pnpm ce, not npx — the skill doc specifies pnpm'`"

Don't wait to be told. Corrections are the most valuable source of project knowledge.

**When the user confirms `context learn`, ALSO write a highlight so the eval agent can materialize it as a lesson:**
```
mcp__indusk__highlight({
  tag: "correction",
  note: "{short slug + lesson text}",
  level: "important"
})
```

The working agent does not write the lesson directly. The eval agent reads the highlight, decides whether it's a cross-project convention (→ `community-` prefixed lesson) or a project-specific fact, phrases the lesson, and writes it. The working agent just flags the moment and keeps working.

**What to include in the `note`:** enough for the eval agent to reconstruct the lesson and classify its scope. Example: `pnpm-ce: always use pnpm ce, not npx — skill doc specifies pnpm and mixing causes cache drift`. The eval agent has the full transcript, so concision over completeness is fine.

Skip silently if `mcp__indusk__highlight` is unavailable — highlights are best-effort and must not fail the work item or the `context learn` recording (which is the canonical, local copy of the lesson).

## Worktree Kickoff

Before writing any code for a plan (i.e. at the start of Phase 1, at the research→impl boundary), decide whether this plan runs in its own git worktree. **Worktree-per-plan is the default** — one plan → one branch → one worktree → PR → merge-and-delete (see the `worktree-visibility` ADR). It gives no-overlap-by-construction for concurrent sessions.

1. **Read the impl frontmatter.** If it contains `worktree: none`, skip this section — the author has explicitly opted this plan into running in the current tree.
2. **Otherwise, check where you are.** Compare `git rev-parse --show-toplevel` against `git worktree list` — are you in the shared trunk or already in a dedicated worktree? If you're already in a worktree for this plan, you're set.
3. **If you're in the trunk, nudge before editing code:**
   > "This plan defaults to running in its own worktree, and you're in the shared trunk. Want me to `indusk worktree create {plan-slug}` first? (Or set `worktree: none` in the impl frontmatter to run here deliberately.)"
4. **This is a nudge, not a gate.** If the user proceeds in the trunk anyway, continue — but note that `indusk agent list` / `/catchup` will flag a same-trunk collision if another session is also there.

The deterministic logic behind this — `resolveWorktreeDecision(implContent)` (frontmatter → `create`/`skip`) and `detectTreeContext(cwd)` (trunk vs worktree) — lives in `apps/indusk-mcp/src/lib/worktree/decision.ts`. The worktree, once created, is bound to the plan for the life of its impl; `indusk worktree create` also auto-provisions the worktree's env.

## Commits

Default: **one commit per checklist item.** Trunk-based development on a feature branch: short-lived branches, frequent commits + pulls, merge + delete fast. See `git.md` for the full convention.

### Workflow

**Once at phase start:**

```bash
git checkout main
git pull --rebase
git checkout -b plan/{plan-name}-phase-{n}
```

**For every checklist item, in this exact order:**

1. **Do the work** — edit files, run tools.
2. **Check the item off** in the impl.md.
3. **`git add -p`** — stage hunks selectively (NOT `git add -A`).
4. **`git commit -m "context: what + why"`** — short, intent-named. Eval hook fires here.
5. **Repeat** for the next item.

**Periodically (at least once per session, before merging):**

```bash
git fetch origin
git rebase origin/main          # stay current with trunk
git push --force-with-lease     # safe force-push after rebase
```

**At phase or plan completion:** push + open PR (or merge directly if solo), then delete the branch on both sides:

```bash
git push -u origin plan/{plan-name}-phase-{n}
# → merge via GitHub button or `git merge --no-ff` locally
git branch -d plan/{plan-name}-phase-{n}
git push origin --delete plan/{plan-name}-phase-{n}
```

**Commit message discipline:** the eval hook fires on commit and scores the diff + transcript. Write descriptive commit messages that name the *why*, not just the *what* — the agent has the diff regardless; the message provides intent.

If a change spans multiple apps, stage hunks per app with `git add -p apps/{name}/...` and commit each context separately. Don't lump multi-context changes into one commit.

### Granularity and batching

**Default: one commit per checklist item.** Each impl checklist item is a logical unit of work — give it its own commit. This keeps history granular, makes blame and bisect useful, and lets the eval agent score each unit while context is fresh.

Phase-close commits (one big commit for everything in a phase) are an exception, not the default. Use them ONLY when items are trivially related — e.g., a phase that's "rename X → Y in 5 files" where every commit would be the same one-line change. If items represent meaningfully different work, each item deserves its own commit.

Cost is not a reason to batch. The eval agent uses session-resume after the first commit, so subsequent commits within a session amortize the catchup cost — per-item commits are cheap.

## Cross-Plan Impact

If your work changes something referenced by another plan (e.g., a schema field, a function signature, a contract interface), update that plan's impl or notes to reflect the change. Plans should never reference stale information.

## Important

- The impl doc is the source of truth for progress. Anyone should be able to read it and know exactly what's done and what's left.
- Always read the research, brief, and ADR before starting. They contain context that matters.
- Check items off one at a time, immediately. The checklist should always reflect reality.
- Explain what you're doing and why as you work through items.
- **Before touching shared code, grep to understand blast radius.** Search for importers/callers of a file before modifying it.
- The user's input is: $ARGUMENTS
