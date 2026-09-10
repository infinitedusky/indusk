---
title: "Workbench Trust Fixes"
date: 2026-09-03
amended: 2026-09-10
status: accepted
---

# Workbench Trust Fixes — Brief

## The story

Five weeks ago we made the workbench a real git repository so that a team
could share one. That was the right change. It also quietly broke four
safety mechanisms, and none of them told us.

A workbench keeps the plan in one folder and the code in a separate
repository next to it. Every one of the four tools was built when plan and
code always lived in the same repository, so each takes one folder and
treats it as the whole world: read the plan here, look at the code here,
commit here. Nobody taught them the code might be somewhere else.

For as long as the workbench folder was not itself a repository, that gap
never showed, because each tool tripped over "this is not a repository" and
stopped. That was a coincidence, not a guard. The moment the workbench
became a repository, nothing tripped, and each tool started doing its job
on a folder that holds the plan and none of the code. Because each one
reports the reassuring case on that path, the result was not an error. It
was a run loop that ticks the checkboxes and commits them as if they were
code, a cleanup check that reports "nothing to clean" without seeing any
code, an evaluator that scores a diff with no code in it, and a restore
command that makes a second copy of a repo you already have.

While auditing those we found a fifth thing, older and unrelated to
workbenches: the reminder that is supposed to tell an agent which tests to
write when it opens a phase has never been delivered, on any project, since
the day it was written.

The principle for every fix is the same one `verify` already follows: a
tool that cannot answer correctly refuses loudly and says why. It never
guesses, and it never reports the happy case. The full evidence, with
file-and-line references, is in [research.md](research.md).

## Proposed Direction

Two halves, and only the first blocks anything. The findings are real but
not equally urgent, and a prerequisite that grows without limit is how the
next plan gets delayed. Phase A is short and finite. Phase B is hygiene
that trails alongside Midnight and Dawn.

### Phase A — blocking

#### 0. The reminder that never spoke

When an agent opens a new phase of work, InDusk is supposed to remind it
which tests it promised to write before touching code. We built that
reminder. It has never once been heard. It writes its message to a channel
the model cannot see, and the one line that would have delivered it was
deleted by an automated lint cleanup. Since August the rule itself is
enforced, so agents are now refused at the gate for tests nobody told them
to write. Two plans are parked today for exactly that reason.

We will make the reminder reach the agent, and we do it first, on purpose:
it is the one item here that makes every later plan in this sequence
cheaper to execute correctly.

<details>
<summary>Technical</summary>

`gate-reminder.js` is registered as a `PostToolUse` hook on Edit and Write.
Every message goes to `console.error` and every exit path is
`process.exit(0)`; for a PostToolUse hook, stderr at exit 0 reaches the
debug log only. Reaching the model needs a JSON envelope on stdout carrying
`hookSpecificOutput.additionalContext`. The original commit emitted an
envelope with only `hookEventName`; a later Biome sweep deleted the
`console.log` under `noConsole` and renamed the variable `_result` to
silence the unused-variable warning. Fix: emit the envelope via
`console.info` (stdout, on the linter's allowlist, so it is not swept
again). The nudge helper exists twice, `writableAtNudge` in the hook and
`getPhaseStartNudge` in `state-ops.ts` with zero callers; collapse to one.
Enforcement of the underlying rule went on 2026-08-12 when Gate A moved from
`===` to `<=`.

</details>

#### 1. `indusk run` commits the plan and calls it code

`indusk run` is the unattended loop that executes a plan's phases through
a model with nobody watching ([reference](../../../apps/docs/src/reference/cli/run.md)).
It takes one folder as its whole world: it reads the plan there, edits code
there, and after each checklist item commits there. In a workbench the plan
is in that folder and the code is not. So the loop reads the plan fine,
cannot touch the code (it is outside the folder it is allowed to edit, or
inside one the workbench's git ignores), ticks the checkboxes anyway,
commits those to the workbench, queues the commit for evaluation, and prints
every item green. Commits that contain plan documents and no code, reported
as success.

The only thing that used to stop this was the auto-commit feature's own
check, "do not commit if this folder is not a repository." Workbench folders
were not repositories, so the loop happened to stop there. Now they are.

We will make the loop refuse at the door when its folder is a workbench,
naming the declared repos and where to run instead. Teaching it to work
across the two locations is the next plan.

<details>
<summary>Technical</summary>

Commit-cadence's guard (`lib/run/commit-cadence.ts`) disables on a non-git
root, which is now unreachable. There is one `root` in `loop.ts`; every
tool path is confined to it by `worktree-paths.ts` and `bash-gate.ts`, so
on a sibling `repos_root` every code edit is a path escape, and on a nested
`repos_root: "."` edits land in a directory the workbench gitignores.
Nothing under `src/lib/run/` imports the workbench readers. The refusal
goes at the entry in `bin/commands/run.ts`, modeled on
`resolveVerifyRoots` (`lib/verify/roots.ts`), which is the maintained
refusal `run` lacks. No commit, no pending-eval record, before the refusal.

</details>

#### 2. The cleanup ritual reports "nothing to clean" without seeing any code

The cleanup ritual asks git which files a plan changed and flags any that
grew too large. At a workbench folder, git's answer is the plan documents,
because the code is in another repository. So cleanup inspects the plan,
finds nothing oversized, and reports the ritual complete and clean. It used
to stop here because the folder was not a repository; `verify` had the
identical bug and was fixed to refuse on purpose; cleanup was not.

We will give cleanup the same deliberate refusal.

<details>
<summary>Technical</summary>

`listOversizedChangedFiles` (`lib/cleanup/oversized.ts`) throws only when
the root is not a git repo; its docblock still asserts the root is
"deliberately NOT a git repo." The diff it then examines covers `.claude/`
and root files, never code. Returns `[]` as checked-and-clean. Refuse when
`isWorkbench(root)`, naming the declared repos, the same way
`verify/git.ts` does.

</details>

#### 3. The evaluator grades the wrong repository

Every commit is scored by a background evaluator that reads the commit's
diff. To find which repository to read, it walks up from the session's
folder to the nearest one. In a workbench the nearest repository is now the
workbench itself, whose history is plan documents, so a commit made from
there is scored against a diff with no code in it. The refusal written for
this situation, "I found more than one repository and will not pick," is
now unreachable, and the helper that would list the candidates has never
been called.

We will make the evaluator find the declared code repository at its declared
location when there is exactly one, and refuse by name when there are
several or when the only repository it can find is the workbench. The
refusal will be visible in the session, not only in a log file.

<details>
<summary>Technical</summary>

`hooks/_hook-paths.js`: `findGitPathFromCwd` now succeeds at a versioned
root, so the `declared.length !== 1` refusal is unreachable in the shape it
was written for. The single-repo fallback resolves `join(statePath,
declared[0])` by name, so a declared `path` makes it null, fail-closed but
dark (system.log only). `declaredReposAt` has zero consumers. Fix: when the
found git root equals the workbench root, do not attribute; resolve the one
declared repo via `repoDir(repo)`; on several, refuse with
`declaredReposAt` in the message. `hook-paths.test.ts` has no fixture with
a git-initialized workbench root, which is why the net could not see this.

</details>

#### 4. `workbench restore` makes a second copy

`restore` is the command that turns a freshly cloned workbench into a
working one by fetching each declared repo. When a repo is declared at a
custom path, every other command looks for it there, but restore clones it
at the default location instead. The result on a machine that already has
the repo: `update` reports it missing, tells you to run restore, and
restore silently clones a second copy beside the first and links to the
wrong one.

We will make restore clone where everything else looks, and print the path
it actually used.

<details>
<summary>Technical</summary>

`bin/commands/workbench.ts` `restoreOne`: `target = join(siblingParent,
repo.name)` while health, status, doppler and the update nudge all read
`repoDir(repo)`. The `path` half was fixed in the two `linkTrunk` calls but
not the clone target, and the status line prints a path it did not use.
Idempotent on a declared-`path` repo already present.

</details>

### Phase B — trailing

#### 5. Three scripts still look for repos by name

The worktree helper scripts were fixed in 1.42.0 to find a repo by its
declared path. Three sibling scripts that do the same job were not, so
creating or refreshing a worktree fails outright on a workbench with a
custom path, and refresh and preflight cannot see worktrees that live where
the config says they live.

<details>
<summary>Technical</summary>

`setup-worktree.sh` and `refresh-worktree.sh` build `CLIENT_ROOT` by name
and never call `_wt_resolve_trunk_dir` (`workbench-helpers.sh`, canonical
since 1.42.0). `refresh --all`, single refresh and `preflight.sh` scan the
workbench root only, so declared `worktrees/` dirs are invisible;
preflight's private reserved list drifted (missing `docs`) and excludes the
trunk by name. Port the shared resolver; first tests for
`resolveVerifyRoots`.

</details>

#### 6. Small silent degradations

A handful of places make the same name-for-path mistake with lower stakes:
the audit that looks for stray state checks a directory that does not
exist and reports clean; `verify`'s refusal tells you to run it at a path
that does not exist; a config that declares repos but forgets the shape
flag slips past `verify` entirely; multi-repo worktree creation applies the
first repo's settings to every repo.

<details>
<summary>Technical</summary>

`stray-state-audit.ts` joins `repo.name`; `verify/roots.ts` refusal
message uses `join(planRoot, declared)`; `isWorkbench` gates on `shape ===
"workbench"` only, and the refusal has zero test coverage; `worktree.ts`
post_create reads repo-0's config for every repo. `indusk init` cannot
author the declared shape at all, which stays an open question.

</details>

#### 7. The record says the opposite of the truth

Our own documentation asserts, in seven places, that the workbench root is
not a git repository. It has been one since 1.37.0. The project context file
says both things in different sections. The Dawn master counts five hooks
where there are six and claims `verify` runs everywhere when it refuses in
every workbench. And one plan is still open with an acceptance criterion
that depends on a tool that was deleted in July.

<details>
<summary>Technical</summary>

CLAUDE.md contradiction (versioned-workbench entry vs multi-agent, agent
list, cleanup gotchas); docs carrying the dead invariant:
`guide/multi-agent.md`, `guide/worktree-setup.md`, `reference/cli/setup.md`,
`reference/cli/agent.md`, `reference/cli/verify.md`, `guide/rail-check.md`,
`skills/cleanup.md`; code comments in `_hook-paths.js`, `eval-trigger.js`,
`oversized.ts`. Dawn master: `workbench-sync.js` (1.37.0) missing from the
keep/shed record; `guide/index.md` header says four hooks, its table lists
five. `workbench-mode-rail-integrity`: close or re-scope; its U1 blocker
is gated on `mcp__graphiti__get_episodes`.

</details>

Cross-repo *capability*, making run and verify actually work across the
plan/code split, is deliberately not here. That is
`dawn-workbench-execution`. This plan makes every surface honest; that plan
makes them able.

## Scope

### In Scope
- **Phase A**: the reminder (0), the four refusals (1 through 4)
- **Phase B**: script parity (5), silent degradations (6), the record (7)

### Out of Scope
- Making run, verify and eval actually work cross-repo (→ `dawn-workbench-execution`)
- Where code lives *inside* a repo (→ `workbench-code-roots`)
- `indusk init` authoring the declared shape (open question; feature-sized)
- Multi-repo verify (stays refusing by design)

## Success Criteria

- In every real workbench shape (flat legacy, sibling `repos_root`, nested,
  declared `path`, declared `worktrees`): `indusk run`, `/cleanup`, and the
  eval hook either work correctly or refuse with a message naming the reason.
  Zero silent wrong answers, proven by tests per surface.
- Opening a phase with unauthored tests puts a reminder naming them in front
  of the agent.
- `workbench restore` on a declared-`path` workbench is idempotent. Never a
  second clone.
- `worktree create/refresh/preflight` behave identically to `wt` on every
  declared layout.
- A search for "not a git repo" across CLAUDE.md and the docs returns only
  historical records.
- `workbench-mode-rail-integrity` is archived or re-scoped with a runnable
  acceptance criterion.

## Depends On
- Nothing. (1.42.0's shared bash resolver is the pattern item 5 ports.)

## Blocks
- `.indusk/planning/dawn-workbench-execution/`: refusals must exist before
  they are selectively lifted
- `.indusk/planning/midnight/` (soft): Midnight's loop trusts the eval and
  cleanup signals this plan makes honest
