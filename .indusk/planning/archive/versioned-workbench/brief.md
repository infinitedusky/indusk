---
title: "Versioned Workbench"
date: 2026-07-23
status: accepted
---

# Versioned Workbench — Brief

## Problem

Workbench context is per-developer by design: `.indusk/planning/`, `.indusk/current.md`, and the semantic graph log live at a workbench root that isn't a git repo, so planning history, operational state, and graph events never reach a teammate. That was a deliberate v1 decision in `indusk-worktree-extension` ("planning history does NOT sync between developers by design"), with shared state parked as a follow-up. This is that follow-up: a team should be able to share the whole workbench context by cloning and pulling a repo — no shared database, no new infrastructure.

## Proposed Direction

Make the workbench root its own git repo with a shared remote, and keep it synced with a dumb, rapid loop:

1. **Watch-and-commit.** Poll `git status` (or trigger on the existing mutation chokepoints); whenever anything changed, commit immediately. Commit messages are throwaway — a timestamp is enough. The history is a sync log, not a narrative.
2. **Pull before everything.** Any read/mutation path (session start via `/catchup`, agent CLI mutations, the sync loop itself) pulls first.
3. **Push immediately after every commit.** On a rejected push: pull, re-resolve, push again.
4. **Blind conflict resolution.** `merge=union` on the append-shaped files (`current.md`, `semantic-graph.log`, `highlights.jsonl`), `-X theirs`-style take-changes-blindly everywhere else. Conflicts are explicitly not mission-critical: both sides are always committed before any merge, so a bad resolution loses nothing that `git log` can't recover. Most of the time there is exactly one person working; the loop just has to not fall over when there are two.
5. **Offline degrades gracefully.** Commit always succeeds locally; push/pull are best-effort with retry. The guarantee is eventual consistency (usually within seconds), never a blocked agent.

The wrapped repo is untouched — the context stream gets its own remote, so rapid timestamp commits never interleave with product-code history (commit siloing preserved). Machine-specific residue is gitignored: the trunk symlink, sibling worktree dirs, `.indusk/extensions/doppler/.env`, and per-app `.env.<profile>` pulls.

The semantic graph needs no special handling: the committed event log is already the canonical state, and each developer's FalkorDB is a disposable projection — `indusk graph rebuild` replays the pulled log locally. Graphiti stays per-developer (episodes live only in the local DB); sharing it would require a remote database, which is explicitly out of scope.

## Context

Emerged from a 2026-07-23 design conversation. A live POC exists as of 2026-07-24 (a client-engagement workbench, kept unnamed here): it is git-initialized with the root-directory-whitelist .gitignore, merge=union attributes, manifest + bootstrap.sh — its friction log is research input for this plan's impl. First logged frictions (2026-07-24): (1) `indusk update` mutates TRACKED workbench files (settings.json, config.json, .gitignore) — on the second machine these sat uncommitted and blocked `git pull`; the sync loop must treat update as a mutation chokepoint (commit after update) and the pull path must handle regenerable-file conflicts by discard-and-rerun. (2) SSH host aliases + secrets are the irreducible out-of-band set. (3) The POC already carried a real bug fix laptop→desktop→laptop within hours — the model works. Earlier alternatives considered and dropped: remote shared FalkorDB/Graphiti (real infrastructure, auth burden — deferred until file-backed sharing proves insufficient), a two-tier cadence where planning docs only sync at `/work` commit points (superseded by the simpler "any change commits" model — per-item `/work` commits still happen; the watcher just also catches everything else), and CRDTs (acknowledged at acceptance as the theoretically correct tool for multi-writer merge, rejected as machinery we don't want to take on — the append-only logs + `merge=union` + replay-time content-keyed dedup already behave like a grow-only set, which is the CRDT we'd actually want, implemented with git primitives we already run).

Known accepted risk: a blind merge on a checklist file can silently revert a checkbox, and an agent might trust a stale "done" mark. Low probability (worktree-per-plan keeps two devs off the same impl.md; gate hooks re-validate structure at the next edit), recoverable from history — worth a falsification hypothesis, not worth designing around.

Note the existing `current.md` file lock (`lib/agents/lock.ts`) serializes writers on one machine only; cross-machine serialization is git push contention + blind merge. That is the intended model, not a gap.

## Scope

### In Scope
- **Workbench manifest + bootstrap** (added 2026-07-24 from the POC): `.indusk/workbench.json` declares the wrapped repo(s) + tool repos (remote URLs) and an advisory worktree list; a bootstrap step (`scripts/bootstrap.sh` in the POC; productize as `indusk workbench restore` or fold into `indusk update`) clones missing repos as siblings, recreates symlinks, and recreates listed worktrees via `indusk worktree create`. Caveats discovered in the POC: branches must be pushed to be recreatable, uncommitted worktree work never travels, and SSH host aliases (e.g. `github-<org>`) are machine config that travels out-of-band with the secrets.
- Workbench root as a git repo with shared remote (setup path: `git init` + `.gitignore` + `.gitattributes` scaffolding, likely via `indusk setup` / `indusk update`)
- The sync loop: pull-first, auto-commit on change with timestamp message, push-immediately, retry on reject, blind resolution
- Integration points: `/catchup` pulls at session start; agent CLI / `update_current_section` mutations sync; a watcher or hook covers everything else
- `merge=union` gitattributes for append-shaped files
- New-developer onboarding path: clone workbench repo + clone wrapped repo + trunk symlink

### Out of Scope
- Remote/shared FalkorDB or Graphiti (no shared database of any kind)
- Cross-machine locking, real-time guarantees, conflict UI
- Normal-mode projects like dusk itself (`.indusk/` already in the product repo — already shared by pulling)
- Multi-repo workbenches (same deferral as the worktree extension)

## Success Criteria
- A second developer clones the workbench repo (plus the wrapped repo) and sees the full planning history, lessons, and other agents' `current.md` sections
- An edit on machine A is visible on machine B within seconds of B's next pull point, with no manual git commands by either party
- Two machines mutating concurrently never block and never require manual conflict resolution; worst case is a blindly-merged file recoverable from history
- Working offline never blocks an agent; changes flow out on reconnect
- `indusk graph rebuild` on a fresh clone reconstructs the semantic graph from the pulled log

## Depends On
- `indusk-worktree-extension` (shipped) — the workbench shape being versioned
- `handoff-multi-agent-section-shape` (shipped) — per-agent `current.md` sections + `merge=union` design this extends cross-machine
- `indusk-makeover` (sequenced first — Sandy 2026-07-23): revisit this brief + test plan after its ADR lands. If the makeover removes CGC/indusk-infra as scoped, the semantic-graph-log sharing piece (and test-plan A7) drops out; the sync loop's pull cadence should also compose with the makeover's hub push/pull flow rather than duplicate it.

## Blocks
- (none yet — a future shared-Graphiti plan would build on this)

## Field Note — the POC grows internal docs (2026-07-27)

The POC workbench POC (workbench root as a git repo with a private remote + root-level directory whitelist) gained a `docs/` directory: a self-contained VitePress **internal engagement docs** site (runbooks / notes / decisions), whitelisted into the context repo alongside `.indusk/`, `.claude/`, `env/`, `scripts/`. Rationale: third-party engagements can't take docs PRs into the client repo, so the internal-vs-published docs split lands as *internal → workbench context repo (shared via its remote), published → client repo (when accepted)*. This plan should adopt the internal-docs directory as part of the canonical versioned-workbench shape.

Tooling gap surfaced: `indusk init-docs` hardcodes `apps/${projectName}-docs` (monorepo-shaped) and can't scaffold a workbench-root `docs/` — wants a `--dir` (or workbench-aware default) when this plan lands.
