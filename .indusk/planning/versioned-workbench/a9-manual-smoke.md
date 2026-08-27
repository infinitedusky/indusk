---
title: "A9 — Onboarding Manual Smoke"
date: 2026-08-17
status: procedure
---

# A9 — Onboarding Manual Smoke

**Row**: A9 — *"A second developer following the onboarding steps ends up with a working workbench."*
**Runs at**: Build Phase 7.
**Why manual**: the thing under test is whether the *written guide* is followable by a person who was not in this conversation. An automated test executes commands the author already knows are the right ones, which is precisely the knowledge the smoke exists to check for absence of.

## Rule of the smoke

**Follow `apps/docs/src/guide/workbench-sharing.md` literally. Type only what it says.**

If you need a command, flag, or piece of knowledge the guide does not contain, that is a **finding, not an obstacle**. Write it down, then use your own knowledge to continue — the goal is a complete list of gaps, not a green run.

An undocumented step discovered here is a documentation bug. It is recorded against Build Phase 7's Document gate, not filed as a smoke failure.

## Setup

Run as a *second checkout location* — a directory that has never held this workbench. A second machine is better; a second path on one machine is acceptable and was the POC's own proving ground.

Do **not** pre-copy anything. Arriving without secrets is the realistic case and A15's list is what should tell you what is missing.

## Steps

1. **Clone the context repo only.**
   `git clone <workbench-remote> <name>-workbench && cd <name>-workbench`
   - Expect: `.indusk/planning/` and `.claude/` present; no sibling repos; trunk symlinks dangling or absent.

2. **Materialize.**
   `indusk workbench restore`
   - Expect: each declared repo cloned as a sibling; each trunk symlink created; the out-of-band list printed at the end.
   - Record: total wall-clock, and whether the printed list is complete enough to act on without asking anyone.

3. **Supply the out-of-band set**, using only the printed list as your checklist.
   - Record: anything you needed that the list did not name. **This is the highest-value output of the whole smoke** — it is the failure mode A15 can assert the shape of but not the completeness of.

4. **Sync the machine's own tooling.**
   `indusk update`
   - Expect: skills/hooks/registry aligned; no tracked-file conflict on the next pull (POC friction #1).

5. **Confirm it is a working workbench.**
   - `indusk worktree list` → every declared repo appears as a trunk.
   - `indusk agent list` → this session registers, worktree/branch resolve.
   - Open a plan under `.indusk/planning/` → the first developer's history is there.

6. **Round-trip a real edit.**
   - Edit any plan document here. Confirm it reaches the origin machine with no git typed by either side.
   - Then edit on the origin machine and confirm it arrives here.
   - Record: observed latency, qualitatively. A2 asserts zero manual steps; the number is context, not a threshold.

7. **Round-trip a worktree.**
   `indusk worktree create <repo> <slug>` → confirm it lands in the named repo and is runnable.

## Recording the result

Append to this file under `## Runs`, one block per run:

```
### <date> — <machine / checkout path>
- Completed: yes / no
- Undocumented steps needed: <list, or "none">
- Out-of-band items missing from the printed list: <list, or "none">
- Round-trip latency (qualitative): <observation>
- Findings filed: <impl item refs>
```

Known-irreducible and **not** findings: SSH host aliases and secret material (U1). Everything else that required knowledge outside the guide is a finding.

## Runs

_(none yet — this row passes at Build Phase 7)_
