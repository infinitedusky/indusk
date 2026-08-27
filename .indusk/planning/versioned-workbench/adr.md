---
title: "Versioned Workbench"
date: 2026-08-16
accepted: 2026-08-17
status: accepted
---

# Versioned Workbench

## Goal

**A developer clones one repo, runs one command, and has the whole workbench — every wrapped repo cloned and linked, all planning history and lessons present — and from then on their edits and their teammate's edits reach each other with no git commands typed by either of them.**

Today neither half works. Workbench context is per-developer by construction: `.indusk/planning/`, `.indusk/current.md`, and the lessons registry live at a workbench root that is not a git repo, so none of it reaches a teammate or a second machine. And the materialization step is manual: `indusk setup` and `indusk init --workbench` both *validate* that the clone already exists and exit 1 if it doesn't ([init.ts:479-485](../../../apps/indusk-mcp/src/bin/commands/init.ts#L479-L485), [setup.ts:28-32](../../../apps/indusk-mcp/src/bin/commands/setup.ts#L28-L32)) — there is no `git clone` anywhere in the package. A developer handed a workbench remote today gets a directory of planning documents pointing at repos they must find and clone themselves, and a trunk symlink they must recreate by hand.

## Y-Statement

**In the context of:**
teams and single developers working across machines on an InDusk workbench — a root directory that wraps one or more cloned repos, holds the shared `.indusk/` context (plans, lessons, current.md, eval state), and hosts sibling worktrees. The concrete instance driving this is a client engagement, whose workbench at `the POC workbench` already wraps two repos (`service-api`, `local-db`) and has already carried a real bug fix laptop→desktop→laptop.

**Facing:**
the workbench root is not a git repo, so context never travels; and even once it is one, cloning it yields a shell — the repos it wraps are absent, the trunk symlinks are dangling, and nothing in the product knows how to reconstruct them. Meanwhile the product's model of a workbench is singular: `worktree.wrapped_repo` is one string, read in 10 non-test files across 80 occurrences, 35 of them in shell scripts with no type checker. The only real versioned workbench that exists declares two repos, so shipping the singular means shipping a restore command that cannot restore the workbench it was built for.

**We decided for:**
making the workbench root a git repo with a shared remote and a dumb pull-first/auto-commit/push-immediately/blind-resolve sync loop, and widening the workbench to N repos by promoting `.indusk/config.json`'s `worktree.wrapped_repo` to `worktree.repos[]` — one declaration, in the file every existing consumer already reads, with the singular reducing to a one-element list. Materialization becomes its own command, `indusk workbench restore`: it clones each declared repo as a sibling, recreates each trunk symlink, optionally recreates declared worktrees, and prints the out-of-band files it deliberately did not supply.

**And against:**
a separate `.indusk/workbench.json` manifest holding the repo list (the POC's shape) — a second home for a fact `config.json` already holds; keeping the workbench single-repo and restoring only the wrapped repo, which would silently under-restore the one workbench that motivated the work; folding restore into `indusk init` or `indusk update`, which puts network-dependent cloning inside commands that run constantly and whose existing guards actively refuse an initialized workbench; and CRDTs for multi-writer merge, which is the theoretically correct tool and machinery we are not taking on.

**To achieve:**
a workbench that is reconstructible from its remote by anyone who can read it, with the reconstruction step honest about what it could not do; context that flows between machines within seconds with zero manual git; and one source of truth for "which repos is this workbench made of," so the singular cannot survive in one lane while the plural ships in another.

**Accepting:**
that blind conflict resolution can silently revert a checkbox and an agent might trust a stale "done" mark; that widening `wrapped_repo` touches 10 files including four shell scripts where a missed site fails at runtime rather than at compile time; that restore can never supply secrets or SSH host aliases, so onboarding keeps an irreducible manual step; that branches must be pushed to be recreatable and uncommitted worktree work never travels; that `indusk workbench restore` is a second command a developer must know about rather than an automatic effect of `update`; and that making the workbench root a git repo removes a refusal that several detectors currently rely on, so this plan has to re-establish that refusal deliberately instead of inheriting it.

**Because:**
the alternative to a shared remote is a shared database, which is real infrastructure and an auth burden for a benefit files already deliver; the alternative to widening the config is two disagreeing definitions of the workbench's repo set, which this codebase has three lessons about and has already paid for twice; and the alternative to a loud partial restore is a restore that exits 0 having done half the job, which is the exact failure mode — a checker that cannot distinguish "could not do it" from "did it" — that `verify`, phantom detection, and the pending-eval queue were each separately built to avoid.

## Context

Two threads converge here.

**Thread 1 — sharing.** The brief (accepted 2026-07-23) proposed the workbench root as a git repo with a rapid, dumb sync loop: pull before everything, commit on any change with a throwaway timestamp message, push immediately, retry on reject, resolve blindly (`merge=union` on append-shaped files, take-changes elsewhere). Conflicts are explicitly not mission-critical because both sides are always committed before any merge, so a bad resolution loses nothing `git log` can't recover. A live POC has run since 2026-07-24.

**Thread 2 — materialization.** Added to the brief's In Scope on 2026-07-24 from POC friction: a manifest declaring the repos plus a bootstrap step that clones and links them. The POC implements this as `scripts/bootstrap.sh` reading `.indusk/workbench.json` — it clones missing repos as siblings, `ln -sfn`s the symlinks, optionally runs `indusk worktree create` per declared worktree, and prints the remaining manual steps. It is idempotent and it works. It is also 40 lines of bash living in one engagement's workbench, invisible to every other project.

The brief contradicts itself on the axis that matters. In Scope says the manifest declares "the wrapped repo(s) + tool repos"; Out of Scope says "Multi-repo workbenches (same deferral as the worktree extension)". The referenced deferral is real and deliberate — `indusk-worktree-extension`'s ADR records Sandy's mid-Phase-2 direction: *"Single-repo-only narrowed for v1; multi-repo workbenches (dawn-fde-toolkit-style, one workbench wrapping N repos) deferred to a future 'FDE agency' plan."* The worktree skill still carries the consequence: *"The `<repo>` argument from the multi-repo design is dropped."*

That deferral was correct for v1 and is now expired by facts on the ground. The POC's manifest lists two repos. Whatever ships as `restore` either handles two or does not restore that workbench.

**What the makeover changed.** The brief's `Depends On` sequenced this behind `indusk-makeover`, which has now landed (impl completed). It removed Graphiti and CodeGraphContext entirely, which withdraws the semantic-graph-log sharing piece and test-plan A7 exactly as the brief predicted. It also introduced hub push/pull (`indusk sync promote` / `indusk sync pull`), which the brief asked this plan to compose with rather than duplicate. On inspection they are orthogonal and need no composition: the hub is machine-global and lessons-only, moving knowledge between *projects on one machine*; workbench sync is workbench-scoped and moves *everything* between *machines*. Both run at catchup; neither subsumes the other.

**Structural finding that decides the manifest question.** The plural shape is already half-built. `.indusk/worktree-configs/<repo>.json` is a per-repo *directory*, keyed by repo name, read at [worktree.ts:143](../../../apps/indusk-mcp/src/bin/commands/worktree.ts#L143) and [worktree.ts:268](../../../apps/indusk-mcp/src/bin/commands/worktree.ts#L268). The singular exists in exactly one place — the `worktree.wrapped_repo` string in `config.json` — and in the code that reads it. Adding a `workbench.json` would create a *third* representation of the repo set alongside a singular config field and an already-plural config directory.

**Census (scripted, not surveyed).** `wrapped_repo` / `WRAPPED_REPO` appears 80 times across 10 non-test files, plus 7 test files:

| File | Occurrences | Language |
|---|---|---|
| `extensions/worktree/scripts/setup-worktree.sh` | 12 | bash |
| `extensions/worktree/hooks/on_enable.sh` | 10 | bash |
| `extensions/worktree/scripts/refresh-worktree.sh` | 7 | bash |
| `src/bin/commands/worktree.ts` | 6 | ts |
| `extensions/worktree/skill.md` | 6 | prose |
| `extensions/worktree/scripts/preflight.sh` | 6 | bash |
| `src/lib/stray-state-audit.ts` | 4 | ts |
| `src/bin/commands/init.ts` | 3 | ts |
| `hooks/_hook-paths.js` | 3 | js |
| `extensions/worktree/templates/worktree-config.template.json` | 1 | json |

35 of 80 are in bash. That distribution is the main risk this ADR accepts and the reason the impl sequences the shell scripts explicitly rather than trusting a type error to find them.

## Decision

### D1 — Multi-repo workbenches are in scope; this ADR supersedes the deferral

A workbench wraps N ≥ 1 repos. This overrides `brief.md`'s Out of Scope line and expires the v1 narrowing recorded in `indusk-worktree-extension`'s ADR. The `<repo>` argument dropped from `indusk worktree create` returns, optional when N = 1.

### D2 — `worktree.repos[]` in `.indusk/config.json` is the single source of truth; no `workbench.json`

```jsonc
{
  "worktree": {
    "shape": "workbench",
    "sibling_parent": "~/code/lazer/the POC",
    "repos": [
      { "name": "service-api",     "remote": "git@github:example-org/service-api.git" },
      { "name": "local-db", "remote": "git@github:example-org/local-db.git" }
    ]
  }
}
```

`remote` is new — it is what makes restore possible and is the one field the POC manifest had that config lacks. It is optional: a repo without a `remote` is declared-but-unrestorable, and restore says so by name rather than skipping it silently.

**The singular reduces to the plural.** `wrapped_repo: "numero"` reads as `repos: [{ name: "numero" }]`. This is the same backward-compatibility shape as `phaseOrdinal` reducing to the phase number when a document has no test phase — the reduction *is* the guarantee, not a claim about one. Existing workbenches keep working with no config edit and no migration step.

**One resolution function.** Every consumer goes through a single exported `readWorkbenchRepos(root): Repo[]` in `src/lib/worktree/`; the shell scripts go through one shared `_read_workbench_repos` helper. Pinned by a single-definition test, per the standing pattern for must-agree invariants. Two lanes reading the repo set independently will disagree, and the disagreement will be silent in bash.

### D3 — Materialization is `indusk workbench restore`, not `init` and not `update`

New command group `indusk workbench` with `restore` as its first verb. Behavior, mirroring the POC and hardening it:

1. Read `worktree.repos[]`. For each repo missing at `<sibling_parent>/<name>`, `git clone <remote>` it there.
2. Create or repair each trunk symlink `<workbench>/<name> → <relative path>`.
3. With `--worktrees`, recreate each declared worktree via the existing `indusk worktree create`.
4. Print the out-of-band set it did not and cannot supply: `env/*.env`, `.indusk/extensions/doppler/.env`, any repo-local config, and required SSH host aliases.

Idempotent — re-running reports each repo as already present and changes nothing.

**Failure is loud and partial progress is kept.** A repo that fails to clone names itself, names the remote, and does not abort the repos that can still be materialized; the command exits non-zero. A restore that clones 1 of 2 and exits 0 is the "could not check reported as checked" failure this codebase has built three separate mechanisms to avoid.

**Rejected placements.** `init` is wrong on its own terms: `setup`'s collision guard already treats an existing `.indusk/config.json` as "run `indusk update`", so a cloned workbench is precisely the case `init` is written to refuse. `update` is wrong because it runs constantly and must stay fast and offline-tolerant; network cloning as a side effect of a routine sync is a surprise. `update` instead **detects and nudges**: "2 declared repos are not materialized — run `indusk workbench restore`."

### D4 — Sync loop as briefed, minus the graph

Pull-first on every read/mutation path; auto-commit on any change with a timestamp message; push immediately; retry on reject; blind resolution with `merge=union` on `current.md` and `highlights.jsonl`. `semantic-graph.log` leaves the set — nothing writes it post-makeover. `indusk update` joins the mutation chokepoints, because POC friction #1 was update mutating *tracked* workbench files (`settings.json`, `config.json`, `.gitignore`) and leaving them uncommitted where they blocked the next pull; regenerable-file conflicts resolve by discard-and-regenerate.

Machine-specific residue stays out of the remote by root-directory whitelist: trunk symlinks, sibling worktree dirs, `.indusk/extensions/doppler/.env`, per-app `.env.<profile>` pulls.

### D5 — Hub sync and workbench sync stay separate

No composition. The hub is machine-global and lessons-only; workbench sync is workbench-scoped and total. `/catchup` runs both, and each stays independently disableable.

### D6 — Hook git-path resolution degrades honestly under N > 1

`hooks/_hook-paths.js` resolves a commit's git path by falling back to `wrapped_repo`. With N = 1 that behavior is unchanged. With N > 1 the fallback is ambiguous, so it derives the repo from the commit's working directory when derivable, and otherwise **skips with a message naming every declared repo** rather than guessing. The existing trade-off note in that file — that a commit in a sibling worktree resolves to the wrapped repo — is not made worse by this change and is not fixed by it either.

### D7 — Workbench-root `docs/` is part of the canonical shape

The engagement-docs split (internal → workbench context repo, published → client repo) is adopted. Two consequences: `docs` joins the reserved-directory set in `worktreeList` ([worktree.ts:196-208](../../../apps/indusk-mcp/src/bin/commands/worktree.ts#L196-L208)), where it is currently absent and would be rendered as a worktree; and `indusk init-docs` needs a `--dir` or workbench-aware default, since it hardcodes the monorepo-shaped `apps/${projectName}-docs`.

### D8 — Detectors get a plan root and a code root; where they cannot tell them apart, they refuse

Making the workbench root a git repo silently converts a loud refusal into a confident wrong answer, which is the single most dangerous change in this ADR.

Today `assertGitRepo` ([verify/git.ts:31-39](../../../apps/indusk-mcp/src/lib/verify/git.ts#L31-L39)) refuses to run verify on a workbench root, and its comment names the reason exactly: *"A workbench root is deliberately not a git repo, and the cleanup library's silent-`[]` on that shape made its ritual vacuous there. The same silence in a verifier would report 'clean' for a phase it never examined."* That refusal is load-bearing, and it is currently free — it holds because the root happens not to be a repo.

D4 makes it a repo. The refusal stops firing, verify runs, and it runs against a repo whose diff **structurally cannot contain the code it is checking**: `impl.md` lives in the workbench repo, the code lives across a symlink in the wrapped repo. The consequences are not subtle:

- **Phantom detection inverts.** It fires when nothing outside `impl.md` and machine state changed ([phantom.ts:32-35](../../../apps/indusk-mcp/src/lib/verify/phantom.ts#L32-L35)). In a workbench repo nothing outside `.indusk/` and `.claude/` *ever* changes when you write code, so `somethingRealChanged` is false essentially always and every honestly-checked item is reported phantom. That file's own comment states the cost: *"a detector that cries wolf gets disabled, which costs more than the cases it would have caught."*
- **The auto-commit loop compounds it.** D4 commits `impl.md` continuously, so the diff since any baseline fills with timestamp commits touching only plan documents — the exact shape phantom reads as "the checkbox moved and the work did not."
- **Red-test detection resolves `Test` paths repo-root-relative**, and "repo root" now has two candidate answers.

The decision: verify, Shape, and cleanup take **two roots** — a plan root (where `impl.md` lives) and a code root (where the phase's code lives). In a workbench the code root is the wrapped repo the plan targets. **Where the code root cannot be determined — the plan names no repo, or its work spans several — the detector refuses and names why, exactly as `assertGitRepo` does today.** It never falls back to the plan root, because a diff of plan documents is not evidence about code and reporting it as such is the failure mode this whole cluster of detectors exists to avoid.

**Scoping.** This plan owns *preserving the refusal* — the cheap, mandatory half: no detector may silently start answering because a precondition changed underneath it. The full two-root split across verify, Shape, and cleanup is named as a follow-on plan and does not block this one. Shipping the sync loop without the refusal is not an option; shipping it without the split is.

## Alternatives Considered

### Keep the workbench single-repo; restore clones only the wrapped repo

Rejected. The only versioned workbench that exists declares two repos, so this ships a restore command that cannot restore its own motivating case — and does so *quietly*, since a manifest listing two and a tool restoring one produces a workbench that looks materialized. Deferring here also does not avoid the cost: the second repo arrives later and the widening happens anyway, against more consumers and after `restore` has established a singular contract.

### `.indusk/workbench.json` as a separate manifest (the POC's shape)

Rejected, though it is what the brief's In Scope literally names and what runs in production today. It creates a second home for a fact `config.json` already holds, next to an already-plural `worktree-configs/` directory — three representations of one repo set. The drift is not hypothetical: `stray-state-audit`, `_hook-paths.js`, and four shell scripts all decide "is this a workbench, and what is its repo" from `config.json`; a manifest that disagreed with them would be silently wrong in the hook lane, which is the lane with no type checker and no user watching. Rejecting it costs the POC one mechanical config migration.

### Fold restore into `indusk update`

Rejected. It is the most convenient story for a developer — clone, `indusk update`, done — and the reason it loses is that `update` is a hot path. It runs on every version bump and post-install, must work offline, and must stay fast; `git clone` of N repos is none of those. The nudge in D3 recovers most of the convenience: `update` still *tells* you what to run, at exactly the moment it notices.

### Productize the POC's `bootstrap.sh` as a worktree-extension script

Rejected, narrowly. The worktree extension already owns four shell scripts that read the workbench config, so the code would sit among relatives. But cloning and linking the repos a workbench is *made of* is workbench topology, not tool knowledge, and the extension is `required: false` — restore would be unavailable exactly where a workbench had not enabled it. Extensions own tool knowledge; core owns the shape of the project.

### CRDTs for multi-writer merge

Rejected, restating the brief's acceptance-time reasoning. It is the theoretically correct tool and it is machinery we are not taking on. The append-only logs plus `merge=union` plus replay-time content-keyed dedup already behave like a grow-only set, which is the CRDT we would actually want, built from git primitives already running.

### Remote shared FalkorDB / Graphiti

Moot rather than rejected — the makeover removed both. Recorded so a future reader does not re-propose it as an unexplored option.

## Consequences

### Positive

- A workbench becomes reconstructible from its remote by anyone who can read it — one clone, one command.
- Planning history, lessons, and `current.md` sections reach teammates and second machines with no shared database.
- One definition of "which repos is this workbench made of," reachable from TypeScript, bash, and hooks through one function each.
- the POC's bash bootstrap retires into the product, and its accumulated friction log becomes impl input rather than tribal knowledge.
- `indusk worktree create <repo> <slug>` regains the repo argument, which multi-repo engagements need and single-repo workbenches never have to type.

### Negative

- A second command developers must know exists. Mitigated by `update`'s nudge, not eliminated.
- Widening the singular touches 10 files, 4 of them bash, where a missed read site fails at runtime with a confusing message rather than at compile time.
- Onboarding keeps an irreducible manual step: secrets and SSH host aliases cannot travel in the remote and never will.
- The workbench remote accumulates a high-frequency commit history that is a sync log, not a narrative. `git log` on the workbench root stops being human-readable — an accepted cost of the dumb loop.
- **A plan's documents and its code now move on two different clocks.** `impl.md` auto-pushes within seconds; the code it describes pushes when the author decides. A second developer can pull a phase marked complete before the commits behind it are reachable anywhere. Nothing corrupts — but "done" in the plan and "present" in the code become two separate questions, and the plan answers faster. This is the inverse of the brief's accepted blind-merge risk (a checkbox silently reverting); here the checkbox is correct and early.
- Detectors that were previously unable to run in a workbench can now run there, so their correctness in that shape has to be established rather than assumed (D8).

### Neutral

- `assertGitRepo`'s refusal stops being free. It currently holds because a workbench root is not a repo; after this plan it holds only because something deliberately maintains it. The guarantee is unchanged; its cost moves from zero to maintained.

### Risks

- **A missed `wrapped_repo` read site in bash ships silently.** Mitigation: one shared `_read_workbench_repos` helper, a single-definition test over the read sites, and an impl phase that walks all four scripts explicitly rather than relying on a type error.
- **Blind merge silently reverts a checkbox and an agent trusts a stale "done".** Accepted in the brief; low probability (worktree-per-plan keeps two developers off one `impl.md`, and gate hooks re-validate at the next edit), recoverable from history. Belongs to the falsification ritual — it deliberately has no success-contract assertion.
- **Partial restore reported as success.** Mitigation: A12 asserts the failure path directly — named repo, preserved progress, non-zero exit — because an acceptance-only test cannot detect a restore that has stopped checking.
- **Auto-commit captures a secret a developer dropped into the workbench root.** The whitelist-not-blacklist `.gitignore` shape from the POC is the control: the root is deny-by-default and directories are added explicitly, so a stray `.env` at the root is untracked by construction rather than by remembering to ignore it.
- **Phantom detection fires on every honestly-checked item in a workbench, gets called noise, and gets switched off — taking its real catches with it.** This is the highest-probability failure in this ADR: it needs no unusual conditions, only a workbench with the sync loop running. Mitigation: D8's refusal, asserted directly by A17, which is a *refusal* assertion rather than an acceptance — a detector that has quietly stopped checking passes every acceptance test ever written for it.
- **The two-clock skew leads an agent to build on a phase whose code it cannot see.** Lower severity than it sounds: the agent's next edit re-validates structure through the gate hooks, and the missing code surfaces as an import error rather than silent wrongness. Recorded as a consequence with A16 asserting the developer can tell, not designed around.
- **The sync loop races the `current.md` file lock.** The lock serializes writers on one machine only; cross-machine serialization is push contention plus blind merge. That is the intended model, not a gap — recorded here so it is not later mistaken for a bug.

## Documentation Plan

### Pages

- **New**: `/reference/cli/workbench.md` — the `indusk workbench` command group, `restore`, its flags, its idempotence and failure contract, and the out-of-band list it prints.
- **New**: `/guide/workbench-sharing.md` — onboarding a second developer or machine end to end: clone the workbench remote, `indusk workbench restore`, supply the out-of-band set, `indusk update`.
- **Update**: `/decisions/worktree-visibility` and the worktree extension skill — multi-repo topology, the returned `<repo>` argument, `worktree.repos[]` superseding `wrapped_repo`.
- **Update**: `/reference/cli/plans` neighbors and getting-started — the workbench section currently describes the single-repo, manually-cloned path.
- **Update**: `CLAUDE.md` Conventions — one line on `worktree.repos[]` as the single source with a pointer here.

### Diagrams

- Mermaid in `/guide/workbench-sharing.md`: workbench root, N trunk symlinks, sibling clones, sibling worktrees, and the shared remote — showing what travels and what does not.
- Mermaid sequence in `/reference/cli/workbench.md`: clone → restore → out-of-band → update, with the failure branch drawn.

### Changelog

- "Workbenches can wrap multiple repos (`worktree.repos[]`; `wrapped_repo` still read as a one-element list)."
- "`indusk workbench restore` materializes a cloned workbench — clones declared repos as siblings, recreates trunk symlinks, optionally recreates worktrees."
- "The workbench root can be a git repo with a shared remote; context syncs between machines with no manual git."

### ADR in Docs

Publish to `/decisions/versioned-workbench.md`. It supersedes the single-repo narrowing recorded in `indusk-worktree-extension`'s ADR, so that document gets a superseded-in-part pointer rather than being left to contradict this one.

## References

- `.indusk/planning/versioned-workbench/brief.md` — accepted 2026-07-23; In Scope amended 2026-07-24 (manifest + bootstrap); field note 2026-07-27 (workbench-root `docs/`)
- `.indusk/planning/versioned-workbench/test-plan.md` — revised 2026-08-16; A7 withdrawn, A10–A15 added for restore + multi-repo, U1 for SSH aliases
- `.indusk/planning/indusk-worktree-extension/adr.md` — the v1 single-repo narrowing this ADR supersedes
- `.indusk/planning/indusk-makeover/adr.md` — Graphiti/CGC removal (withdraws A7), hub push/pull (D5)
- `/decisions/multi-agent-coordination` — per-agent `current.md` sections + `merge=union`, extended cross-machine here
- `/decisions/worktree-visibility` — worktree-per-plan default, the topology being widened
- POC: `the POC workbench` — `.indusk/workbench.json`, `scripts/bootstrap.sh`, root-directory-whitelist `.gitignore`
- [init.ts:456-495](../../../apps/indusk-mcp/src/bin/commands/init.ts#L456-L495) — workbench validation + trunk symlink
- [setup.ts](../../../apps/indusk-mcp/src/bin/commands/setup.ts) — one-shot workbench creation over an already-cloned repo
- [worktree.ts:139-280](../../../apps/indusk-mcp/src/bin/commands/worktree.ts#L139-L280) — config reads, `worktree-configs/<repo>.json`, reserved dirs
- [_hook-paths.js:108-145](../../../apps/indusk-mcp/hooks/_hook-paths.js#L108-L145) — the git-path fallback D6 changes
