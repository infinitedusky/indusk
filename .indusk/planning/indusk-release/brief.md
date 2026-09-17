---
title: "indusk release — a release names the plans it carries"
date: 2026-09-17
status: draft
workflow: feature
---

# indusk release — Brief

Sized like a bugfix: this brief carries its own landscape and its two
decisions, so the planner can go brief → test-plan → impl without a research
document or an ADR. The command is small; what it replaces is a procedure
nobody should have to remember.

## The story

On 2026-09-17, releasing 1.50.0 took four attempts. The release guard refused
on two planning folders that belonged to a different live session; a second
`pnpm release` collided with the first one's `next build`; the version was
typed into `package.json` by hand and the release message written from memory;
and the one-time password stopped the publish that finally passed. Only the
last of those is npm's. The rest is a procedure with no owner: bump, retitle
the changelog, write a `chore(release)` commit, run the guard, publish, and
then nothing records which plans that version carried.

Sandy's framing (2026-09-17): *"a release is of a plan, a plan knows its
changes, if the plan is committed then a release is possible."* Half of that
is already true — a landed plan is one merge commit with a known diff, and
"release possible" is exactly what the guard checks: every plan touching
packaged paths has landed, and the tarball equals HEAD on those paths. The
other half is the gap: **nothing computes which plans a version shipped**, so
the release commit says whatever the operator typed, the changelog heading is
retitled by hand, and an archived retrospective ends at "Landed" with no
"Released in".

A release is of the *package*, not of a plan — 1.50.0 carried three plans —
so the unit that gets a number is trunk at a commit. But the plans are the
vocabulary the system already speaks, and every fact the release needs is
already on disk: the last `chore(release)` commit, the `Merge plan/*` commits
after it, the packaged-path diff since it, and each plan's Unreleased changelog
entries written by its Document gates.

## Proposed direction

**`indusk release <major|minor|patch>` — one command, everything derived.**

1. **Unreleased is computed.** Last release = the last commit matching
   `^chore(release): <version>`. Plans landed since = the `Merge plan/<name>`
   commits after it (the shape Step 10 of the retrospective now guarantees).
   Packaged changes since = `git diff --name-only <release>..HEAD --
   <PACKAGED_PATHS>`, the same list the guard uses. Zero plans and zero
   packaged changes ⇒ "nothing to release", exit 0, no commit.
2. **The release names its plans.** The command bumps `package.json`,
   retitles the changelog's `## [Unreleased]` to `## [<version>] — <date>`,
   and writes the release commit as
   `chore(release): <version> — <plan-a>, <plan-b>, <plan-c>` — the plan names
   in landing order. Nothing typed.
3. **The guard runs, then the publish.** `scripts/release-guard.sh` is called
   unchanged (it refuses packaged dirt, a HEAD that is not the release commit,
   unmerged packaged branches, an already-published version); then
   `pnpm publish --no-git-checks`. The one-time password remains the
   operator's step — the command prints npm's URL and waits, as today.
4. **The link flows back.** On a successful publish, each named plan's archived
   `retrospective.md` gains `Released in <version>, <date>.` under its
   `## Landed` line, in one commit. A plan's record then reads landed →
   released, sha and version.
5. **`check_health` reports the three-way state** — installed, published
   (`lib/version-check.ts` already fetches and caches it), and "N plans landed
   and unreleased; packaged paths changed: yes/no" — so every catchup says
   what is waiting, without anyone asking. This absorbs the root master's
   "Small, not a step" note of 2026-09-15.
6. **Step 10 of the retrospective ends with a sentence**: "landed;
   `indusk release` when you want it out." The procedure it currently
   describes for release becomes a pointer.

**Two things this does not do.** It does not tie a release to one plan (a
version describes trunk at a commit, and trunk can carry several). And it does
not make the guard ask questions — a prompt is a rule with a bypass button
(Sandy, 2026-09-17: "no no").

## What "done" looks like

- `indusk release minor` on a trunk with three landed plans produces one
  commit whose subject names all three, a changelog heading with the version
  and date, and a green guard — with no file edited by hand.
- `indusk release patch` on a trunk with no landed plans and no packaged
  changes since the last release says so and writes nothing.
- After a publish, each named plan's retrospective carries "Released in".
- `check_health` names the landed-and-unreleased plans, or says none.
- A second `indusk release` while one is running is refused by a lock, not by
  two `next build`s fighting over `.next/`.

## Depends on

- Step 10 of the retrospective skill (landed 2026-09-17): the `Merge plan/*`
  commit is what makes "plans since the last release" computable.
- `scripts/release-guard.sh` as of 2026-09-17 (packaged-path dirty check).

## Out of scope

- Changing the version scheme (still semver, still `chore(release)` commits —
  the guard matches on the message and every release to date has that shape).
- Removing the one-time password, or any npm auth change (trusted publishing
  is a separate, dated item — see the npm token memory).
- Pre-release channels, tags, GitHub releases.

## Carried from

- Root master, "Small, not a step" (2026-09-15): the three-way version state
  in `check_health` — folded into item 5 above.
- The `next build` collision of 2026-09-17: a release lock (item under "done").
