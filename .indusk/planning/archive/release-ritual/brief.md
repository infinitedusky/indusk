---
title: "The release ritual finishes itself"
status: accepted
date: 2026-09-21
---

# Brief

## The problem

Publishing 1.54.0 took five attempts, and none of them failed for the reason
the error messages gave.

1. `pnpm release` refused: HEAD was 84 commits past the release commit. That
   was **correct** — the guard is right and it said exactly what to do. But
   "bump" means three manual steps (edit `package.json`, roll the changelog's
   `[Unreleased]` heading, write a commit message in the format the guard
   greps for), each silently wrong-able, with no command behind them.
2. `git commit -F <file>` was refused by **trunk-guard** even though the
   message began `chore(release):`. The exemption only reads `-m`.
3. `git commit -m "$(cat <<EOF …)"` was refused the same way.
4. `pnpm release` refused on a staged `package.json` — a timing artifact of
   fighting 2 and 3, but a real window.
5. `pnpm release` passed the guard, authenticated to npm, and then **failed
   in the build**: `@opentelemetry/context-async-hooks` was declared in
   `package.json` but not linked into `apps/indusk-mcp/node_modules`. The
   dependency arrived on a plan branch; merging brings the manifest, not the
   install. Trunk had never run `pnpm install` since the merge.

Failures 2 and 3 fail toward refusal, which is the safe direction — but both
report *"refusing to commit code on `main`"* while naming an allowlisted path
set, so a parser limitation reads as a policy decision.

Failure 5 is the dangerous one: it happens **after** npm authentication,
halfway through `prepublishOnly`. The guard checks git state thoroughly and
checks nothing about whether the tree can build.

## The shape of it

Each failure is the same thing: **the ritual verifies what it can grep and
nothing about whether the result would work.** The guard's refusals are
well-reasoned and each one is a wall with no door on the other side.

## Proposed direction

**1. The bump belongs to the retrospective.** Not a new command shape — a new
step. `/retrospective` is the only moment that knows what shipped, whether it
was a feature or a fix, and it is already on trunk after Step 10's merge,
which is exactly where the guard's own rule ("bump on main, after the branch
is merged") points. Step 11 derives whether packaged paths changed, takes the
increment and summary from the plan it just closed, rolls the changelog, and
writes the release commit. A plan that changed no packaged paths says so and
skips.

**2. trunk-guard reads the message it is given.** The `chore(release):`
exemption must recognise `-F <file>`, `--file=<file>`, and a `-m` whose value
came from a heredoc or command substitution — or, where the message genuinely
cannot be read, say *that* rather than claiming code is being committed on
trunk. A refusal whose stated reason is wrong teaches people to override it.

**3. The release guard proves the tree builds before npm sees it.**
`pnpm install --frozen-lockfile` ahead of the build, so a stale install is
caught in a second rather than after login. A merged branch that added a
dependency is the ordinary case, not an exotic one.

## What this is not

Not an npm extension. The publish mechanics (`npm whoami`, `pnpm publish`,
2FA, the trusted-publishing migration) genuinely are tool knowledge and
genuinely belong in an extension by this project's own rule — but today they
are two words in a shell line, and an extension buys nothing until there is a
second registry. Revisit when there is one.

Not a change to what the guard refuses. Every refusal it makes is correct and
stays. This adds the door, it does not move the wall.

## Success criteria

- Closing a plan that touched packaged paths produces the release commit as
  part of the retrospective, with no hand-edited version or changelog.
- `chore(release):` commits are accepted on trunk however the message is
  supplied, and a message the guard cannot read is refused *by that name*.
- A stale install fails the release before npm authentication, naming the fix.
