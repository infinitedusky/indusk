---
title: "Dawn Workbench Execution — two roots, one resolver"
date: 2026-09-15
status: accepted
---

# Dawn Workbench Execution — two roots, one resolver

## Goal

**`indusk run` and `indusk verify` work at the root of a workbench that declares one repo, reading the plan from the workbench and executing, committing and judging in the code repo.**

Today both refuse there, on purpose, because each takes one root as its whole world and a workbench splits that world in two: `impl.md` and the ledger sit in the workbench repository, the code sits across a trunk link in a repository with its own history. Every real project on this machine is that shape, so the floor Dawn component 6 proved (five planted violation classes caught, no false positive) exists only where nobody works. After this ADR a phase run under `atdawn` in a workbench lands its code commits in the code repo and its checkoff in the workbench repo, `verify` judges the code repo's diff against a code-repo baseline, and the queued eval names the repo it should score. Two repos still refuse, by name.

## Y-Statement

**In the context of:**
The thin lane (`indusk run`) and the universal floor (`indusk verify`) executing and judging plan phases in a versioned workbench, where the plan's documents and the code they describe are different git repositories and the code's location is declared in `worktree.repos[]`.

**Facing:**
Both commands, the cleanup scan and the eval drain each carry the assumption that one directory holds everything: the run loop confines its tools, resolves its gates, commits and queues evals against `options.worktree`; verify reads the ledger, diffs for phantom work and runs tests against `options.root`; the queued eval record has no field naming which repository its sha belongs to. Since workbench-trust-fixes each surface refuses rather than guessing, and the same "this is a workbench; its code lives in X" refusal is written three times.

**We decided for:**
One resolver, `resolveExecutionRoots(planRoot)`, returning `{ planRoot, codeRoot, split }` for a flat project or a one-repo workbench and a named refusal for none or several, consumed by run, verify and cleanup and pinned to a single definition. The run loop carries both roots: tools and bash run in the code root and may write only inside it or inside the plan's own folder under the plan root; gates are resolved from and evaluated against the plan root; two commit cadences, one per repository, each staging only its own tree, the plan-root commit naming the code commit it records. Verify keeps its one ledger at the plan root and each record gains `codeSha`, the code repo's HEAD at the clean verdict; red tests, phantom work and the bootstrap baseline resolve against `codeRoot` and `codeSha`, goalpost drift and the ledger against the plan root, and a record without `codeSha` is never used as a code baseline. The queued eval record gains `repo`, the absolute path the commit landed in, and the drain passes it to the evaluator as its git root.

**And against:**
Leaving the checkoff commit to `workbench sync` (the thin lane has no PostToolUse hook, so it would never happen under `atdawn run`); a second ledger inside the code repo (two chains to keep consistent, and the code repo is the shared artifact a workbench exists to keep free of InDusk state); a `--code-root` flag pushing the split onto the user (the declaration already says where the code is, and a flag can name the wrong place); lifting the multi-repo refusal by adding a plan-declares-its-repo key (a real follow-on with its own frontmatter decision, not this plan's); and running each command from inside the code repo with the plan root inferred upward (a walk-up finds the workbench, which is exactly the accidental attribution trust-fixes removed).

**To achieve:**
The floor under the shape every real project has: a phase run in a workbench is gated, committed, queued and verified the same way a flat project's is, and the dawn-verify acceptance matrix holds inside a workbench (A15).

**Accepting:**
Two commits per checklist item instead of one, and a plan-root history that interleaves checkoffs from every plan run in that workbench. A ledger record shape with one optional field, read by a rule ("no `codeSha`, no code baseline") rather than a migration. The loop's write surface is two roots rather than one, so confinement has two allow-lists to keep correct. Multi-repo workbenches stay refused.

**Because:**
Every failure this plan lifts was silent before trust-fixes made it a refusal, and the difference between a refusal and a wrong verdict is the whole value of the floor. A single resolver keeps the three surfaces from disagreeing about where the code is; a per-record `codeSha` and `repo` field make each artifact say which repository it is evidence about, so nothing downstream infers it; and committing the checkoff from the loop keeps the thin lane's record complete without a hook it does not have.

## Context

- `lib/verify/roots.ts` resolves `{ planRoot, codeRoot, split }` and refuses every workbench; `runVerify` (`verify.ts`) already branches on `split` for a second `assertGitRepo`, a branch nothing reaches. Phantom detection is already called with `codeRoot`; red tests, bootstrap and the ledger use `root`.
- `lib/run/loop.ts` binds everything to `options.worktree`: `createWorktreeTools(root)`, `gateBashTool`, `resolveGateScripts(root)` (walks up from the root to the first `.claude/hooks/` with all three scripts), `createCommitCadence({ worktreeRoot: root })` (`git add -A` + commit in that root), `appendPendingEval(root, …)` (queue under `<root>/.indusk/eval/`).
- `bin/commands/run.ts:96` refuses at `isWorkbench(projectRoot)` before the provider-key check; `lib/cleanup/oversized.ts:121` refuses the same way; both build the same message from `readWorkbenchRepos` + `repoDir`.
- `PendingEvalRecord` is `{ sha, plan, phase, source, timestamp }`. The drain (`hooks/_pending-drain.js`) spawns `eval-trigger.js --source <s> --change-id <sha>` with `cwd` = the state path, and the hook resolves its git root by walking up from `cwd` (`_hook-paths.js`), which in a workbench attributes by newer HEAD (trust-fixes F2). For a queued loop commit the loop *knows* the repo; guessing is a step down.
- `VerifyRecord` is `{ plan, phase, sha, trajectory, timestamp }`; `findBaselineRecord` picks the latest earlier phase for the plan; `resolveBootstrapBaseline(root, planDir)` falls back from the merge base to the commit before the plan folder first appeared.
- Layouts a one-repo workbench can declare: flat legacy (`wrapped_repo`, checkout at `<root>/<name>`), nested (`repos_root: .`), sibling (`repos_root` absolute), and a repo at a declared `path`. `repoDir` + `resolveReposRoot` already read all four; the test helper builds two.
- Brief: `brief.md` (accepted 2026-09-15); assertions: `test-plan.md` (A1–A15).

## Decision

1. **`resolveExecutionRoots(planRoot)` in `lib/worktree/roots.ts`.** Returns `{ planRoot, codeRoot, split: false }` when `!isWorkbench`, `{ planRoot, codeRoot: join(resolveReposRoot(planRoot), repoDir(repo)), split: true }` when exactly one repo is declared, and `{ error }` for zero or several — the three messages `verify/roots.ts` carries today, moved. `verify/roots.ts` is deleted; `run.ts`, `oversized.ts` and `verify.ts` call the shared function (A14 pins one definition and that all three reach their refusal through it). Cleanup keeps refusing on `split` — its scan is out of scope — but through this function, so the message cannot drift.

2. **Verify judges the code repo.** `runVerify` asserts git-ness of both roots when split; `detectRedTests`, `detectPhantomWork` and `resolveBootstrapBaseline` receive `codeRoot`; `detectGoalpostDrift`, `detectPrematureCheckoff` and the ledger stay on `planRoot`. The bootstrap baseline in a split project is the code repo's merge base (the same candidate fallbacks), and since the plan folder is not in the code repo, the "commit before the plan folder appeared" fallback does not apply there — merge base, else root commit. `VerifyRecord` gains optional `codeSha`; a clean verdict writes `sha: HEAD(planRoot)` and, when split, `codeSha: HEAD(codeRoot)`. `findBaselineRecord` is unchanged; the caller uses `record.codeSha` as the code baseline and, when split and absent, bootstraps and reports `source: "merge-base"` (A4). In a flat project `codeSha` is never written and never needed. `Test` column paths are code-repo-relative by definition when split.

3. **Run carries two roots.** `RunLoopOptions` gains `planRoot?: string` (default: `worktree`); `bin/commands/run.ts` fills it from the resolver. Tools and the bash gate take `{ codeRoot, planRoot, planDir }` and resolve a path as: inside `codeRoot` → allowed; inside `<planRoot>/.indusk/planning/<plan>/` → allowed; anything else → refused with both allowed roots named (A10). `resolveGateScripts(planRoot)` and the gate envelope's `cwd` are the plan root, so the hooks' state-path walk finds the workbench's `.indusk/`. The impl path is under the plan root; every gate read is unchanged.

4. **Two commit cadences.** `createCommitCadence` is created once per root. After each checklist item: the code cadence stages and commits the code repo (unchanged behaviour); the plan cadence then stages only `.indusk/planning/<plan>/` in the plan root and commits with the same intent-derived message plus a trailer `Code-Commit: <sha>` when the code cadence landed one (A8). A code cadence on a non-git code root disables loudly as today; a plan cadence never disables silently either. The workbench-sync hook is not involved: the thin lane has no hooks.

5. **Evals name their repo.** `PendingEvalRecord` gains `repo` (absolute, realpath-normalized); the loop writes the code repo for code commits. The queue stays at `<planRoot>/.indusk/eval/`. `_pending-drain.js` passes `--git-root <repo>` when the record has one, and `eval-trigger.js` honours it in drain mode in place of the walk-up (A12); a record without `repo` resolves as today. The plan-root checkoff commits are **not** queued — a diff of checkboxes is not work to score.

6. **Four layouts in the fixture.** `helpers/versioned-workbench.ts` gains `flatLegacy()` (a `wrapped_repo` config with no `repos_root`, checkout at `<root>/<name>`) and `oneRepoAtPath` already covers a declared `path`; A13 runs A1, A7 and A8 over all four.

7. **Acceptance.** A15 re-runs `archive/dawn-verify/matrix.md`'s six cells inside a workbench built from the fixture, driven by a headless `claude -p` with the hook files installed and unregistered (the Cursor shape), recorded as `matrix.md` in this plan folder with the same cell table. The Dawn master's "universal floor" line is rewritten to match the record.

## Alternatives Considered

### Leave the checkoff commit to `workbench sync`
The debounced PostToolUse hook that triggers sync exists only in Claude Code sessions. Under `atdawn run` nothing would ever commit the checkoff, so the plan-root history would lag the code by an entire run and `verify`'s goalpost comparison against `git show <baseline>:impl.md` would read stale documents. Rejected.

### A second ledger in the code repo
Keeps `VerifyRecord` unchanged but creates two chains that must agree, and puts InDusk machine state into the repository a workbench exists to keep clean of it (the `MACHINE_LOCAL_RULES` lesson). One record naming both shas is one fact in one place. Rejected.

### A `--code-root` flag
Works, and would make the two-root loop testable without a declaration. But the declaration already answers the question, and a flag can name a directory that is not the declared repo — a wrong verdict indistinguishable from a right one. The resolver reads the declaration; a flag would be a second source of truth. Rejected.

### Lift the multi-repo refusal now
Needs the plan to declare which repo holds its code (frontmatter, with its own validation and its own sidebar/admin questions). A named follow-on; this plan keeps the refusal and routes it through the shared resolver so lifting it later is one place.

### Run from inside the code repo, infer the plan root upward
The walk-up from a code repo finds the workbench root, which is a git repo with its own history — the exact accidental attribution trust-fixes F2 removed. The plan root is where the user runs the command, and the declaration points down to the code. Rejected.

## Consequences

### Positive
- Every real project on this machine gets the floor and the loop.
- Three refusal sites, one definition; the next surface that needs the roots imports rather than copies.
- Each artifact (ledger record, queued eval) says which repository it is about; nothing downstream infers it.

### Negative
- Two commits per item in a workbench. The plan-root history interleaves every plan's checkoffs; `Code-Commit:` trailers are the join.
- `VerifyRecord` and `PendingEvalRecord` each grow an optional field whose absence carries meaning; the rule is written next to each reader.

### Risks
- The bash gate is best-effort escape-scanning, not a sandbox; with two roots the scan has two allow-lists. Mitigation: A10 asserts a write outside both is refused, and the ADR keeps the plan-root allowance to the plan's own folder.
- A stale `codeSha` (code repo rewritten, sha gone) degrades to bootstrap. Mitigation: verify reports `source: "merge-base"` and names the missing sha, never silently.
- `eval-trigger.js --git-root` is a new argument on a hook with hard-won invariants. Mitigation: drain-mode only, pinned by the drain test; hook mode untouched.

## Documentation Plan

### Pages
- Update: `reference/cli/run.md` — workbench execution: two roots, two cadences, the `Code-Commit:` trailer, the multi-repo refusal
- Update: `reference/cli/verify.md` — cross-repo baseline, `codeSha`, the "no codeSha, no code baseline" rule, `Test` paths code-repo-relative when split
- Update: `guide/rail-check.md` — queued evals name their repo; the drain honours it
- New: `decisions/dawn-workbench-execution.md` (this ADR); `decisions/dawn-verify.md` gains a superseded-note on the refusal paragraph
- Update: `.indusk/planning/indusk-v2-dawn/master.md` component 6.5 status and the "universal floor" line; the root master's Stream 3 row

### Diagrams
- Mermaid in `reference/cli/run.md`: the two roots and what flows to each (edits/commits → code repo; impl/gates/ledger/queue → plan repo)

### Changelog
- Added: `indusk run` and `indusk verify` execute in a single-repo workbench across the plan-root/code-root split; evals name their repo; one shared root resolver

### ADR in Docs
- Yes: `decisions/dawn-workbench-execution.md`

## References
- `brief.md`, `test-plan.md` (this folder)
- `.indusk/planning/archive/workbench-trust-fixes/research.md` F1, F2
- `.indusk/planning/archive/dawn-verify/adr.md`, `matrix.md`
- `/decisions/versioned-workbench`, `/lessons/worktree-config-schema-pointer` (machine-local rules)
