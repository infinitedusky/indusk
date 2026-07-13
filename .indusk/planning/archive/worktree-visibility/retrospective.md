---
title: "Worktree Visibility"
date: 2026-07-13
---

# Worktree Visibility — Retrospective

## What We Set Out to Do

Make agent worktree isolation the default for every plan and observable in the presence bulletin.
Two coupled halves: (1) **visibility** — `indusk agent list` shows each session's worktree/branch and
flags a same-tree collision; (2) **automatic isolation** — every plan gets a worktree at impl kickoff
(`worktree: none` opt-out), so concurrent sessions stop colliding on the shared trunk by
construction. The bet: worktrees are cheap, and the real prize is the clean one-plan-one-branch PR
flow, with collision-avoidance as a side effect.

## What Actually Happened

The plan came out of a proposal critique conversation, not a formal research pass — the discovery
(what's a stub vs. new work, where the worktree step belongs, the hard-gate-vs-nudge fork) happened
in dialogue, and `research.md` was written to record it retroactively. Two decisions shifted during
authoring:

- **hotfix worktree policy flipped mid-ADR.** The first ADR draft kept hotfix's shipped "no worktree"
  behavior via a template `worktree: none`. The user overrode: worktrees are cheap enough that even a
  hotfix should get one. The opt-out survived as a per-plan escape hatch that *no* workflow ships by
  default — a cleaner, more uniform rule.
- **The write-gate idea was scoped out.** An early direction was "no writes without a plan, gated."
  That collapsed to "worktree-per-plan at impl kickoff, nudge not gate" once we saw the only writes
  needing isolation are impl code writes (which already live behind impl phases), dodging a
  giant exemption taxonomy.

Structurally the change was small and concentrated: `AgentSection` gained two fields + markers;
`agent.ts` gained the columns, recompute heartbeat, and collision detector; `lib/worktree/decision.ts`
is new (two pure helpers); three skills (`work`/`planner`/`catchup`) gained prose; docs. Phase 1 was
mostly *finishing a stub* — `agentRegister` already computed the branch and threw it away.

## Getting to Done

The falsification round is where the real learning was. After the impl was marked `completed` (T1–T6
green), `/falsify` found **two concrete, realistic bugs** — both the "the code works for the inputs
the author imagined, and breaks on an obvious one they didn't" pattern:

- **The recompute heartbeat wiped worktree/branch to empty from a non-git cwd** — and the single most
  normal place to run `indusk agent list` is the **workbench root, which is intentionally not a git
  repo** (it's where `.indusk/` lives). So the exact command the feature exists to serve, run from
  the exact directory it's most naturally run in, silently dropped the caller off the board *and out
  of collision detection* — the false-negative the whole feature was meant to prevent. Fixed by
  preserving last-known when the recompute is empty.
- **`worktree: false` silently failed to opt out.** gray-matter/js-yaml parses `false` to a boolean;
  the string-only `=== "none"` check returned `create`, so a user opting out the natural way got the
  opposite of their intent. Fixed by broadening the opt-out to boolean `false` + a falsy-string set.

One hypothesis (symlink path divergence, `/var` vs `/private/var`) I *investigated and rejected*
before authoring — `git rev-parse --show-toplevel` returns the physical path, so stored values are
already normalized. Killing my own weak lead instead of padding the phase was the ritual working.

The load-bearing half — the skill actually creating the worktree at `/work` — was never live-verified.
T7/T8/T9 are the manual two-session smoke, still `skipped` at archive.

## What We Learned

- **"Recomputed live" was only true for the caller.** The collision detector compares the caller's
  fresh tree against every *other* session's last-known tree — it's eventually consistent, not
  real-time, and can't be otherwise (you can't run git in another session's cwd). The attestation
  said "live"; the reality is "live for you, last-known for them." Naming that honestly (in docs + a
  code comment) mattered more than any code change.
- **YAML coercion silently inverts boolean-ish flag values.** `worktree: false` → boolean, not the
  string "false". Any frontmatter flag whose opt-out is a string comparison is a footgun: the most
  natural way to express the flag (`false`/`no`/`off`) bypasses it. Check the type, or coerce.
- **The environment's load-bearing facts belong in the test matrix.** The workbench root being
  non-git is documented elsewhere in this very repo, yet the visibility recompute forgot it. The
  Phase 1 tests only exercised git cwds. The failure was one `cd` away.
- **The least-testable half is where the risk concentrates.** The deterministic core (helpers,
  parsing, columns) was trivial to prove; the skill-prose half (does `/work` actually create the
  worktree?) is the part that carries the feature's value and the part that's still unverified.

## What We'd Do Differently

- **Run the manual smoke before declaring the impl complete.** T7–T9 should have been exercised
  before the first `completed`, not deferred past falsification and retrospective. The plan archives
  honestly recording the kickoff behavior as authored-and-reasoned-about but not live-run.
- **Author the non-git-cwd case in Phase 1, not Phase 4.** It was foreseeable — the workbench root's
  non-git nature is a known repo fact. Falsification caught it, but Phase 1's test matrix should have.
- **Branch topology.** The whole plan lives on `plan/cleanup-ritual-phase-0` (plan docs co-located
  with unrelated cleanup work) rather than its own branch — a pragmatic call to avoid orphaning the
  committed plan docs, but it muddies the history. Sort at merge time.

## Insights Worth Carrying Forward

- **Falsify-after-completed earns its keep on "realistic input" gaps.** Both bugs were single-`cd` /
  single-frontmatter-value away and would have shipped. The ritual's value here wasn't exotic edge
  cases — it was the *obvious* input the author didn't test because they were thinking about the
  happy path.
- **For flag frontmatter, treat the opt-out as a type-aware predicate, not a string equality.** Save
  to `.indusk/research/` if a second plan hits YAML-coercion on a flag.

## Quality Ratchet

No new Biome rule. The two falsification bugs aren't lint-catchable classes: one is a runtime
git-context assumption (non-git cwd), the other a YAML-parse-coercion semantic (`false` → boolean).
Both are now guarded by tests (T10/T11) and documented as gotchas — the right layer for
runtime-semantic bugs, not the linter.

## Metrics

- Sessions spent: 1 (continuous)
- Phases: 3 impl + 1 falsification
- Trajectory rows: 11 (T1–T6 + T10/T11 passing; T7–T9 skipped pending manual smoke) + 1 deferred (U1)
- New files: `lib/worktree/decision.ts`, `worktree-visibility.test.ts`, `worktree-visibility-cli.test.ts`, `decision.test.ts`, smoke procedure, decision page
- Tests: 73 agents+worktree-domain tests green
- Falsification: 2 confirmed bugs fixed, 1 doc gap closed, 1 hypothesis investigated + rejected
