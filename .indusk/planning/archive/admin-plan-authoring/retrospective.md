---
title: "Plan authoring from the admin — Retrospective"
date: 2026-10-06
---

# Plan authoring from the admin — Retrospective

## What We Set Out to Do

Make the admin a place plans are made and built, not only read. A person
starts a plan there and plans it in a conversation with their own Claude
Code. Once the plan is approved, a build runs unattended to review and stops
only for what the plan declared. The person reads the evidence and accepts,
and the plan is released. The admin, the skills and the terminal all go
through the same commands (`indusk plans start | approve | accept | land |
next | review`), and nothing lands on `main` before it is accepted. The brief
expects three things: the admin is used for at least one step in each of
the next five plans; those builds stop only for declared judgements; and the
demo writes and builds its first plan on camera without a terminal.

## What Actually Happened

The plan went from brief to impl approval in one conversation. It then ran
twelve build phases where nine were planned:

- **Build Phases 1–9 were the plan as written.** The plan commands, the next
  step as a pure function, the review, the session protocol, the daemon's
  sessions and routes, the panel, the build runner with acceptance and
  release, the skills and the trunk-commit mark, and the live checks.
- **Build Phase 10 was added after the live check.** The unattended release
  found InDusk's own notes uncommitted on `main` and had to decide whose they
  were.
- **Build Phase 11 was the falsification phase.** It fixed three defects;
  one hypothesis was dropped.
- **Build Phase 12 was the cleanup phase.** It removed four rules spelled in
  more than one place.

The build, measured from the approval commit, is 134 commits across 149
files, +8,524/−278. Of that, 106 code files changed (+7,626/−104), 48 of them
new, plus 33 test files. Forty trajectory rows: 39 passing and one skipped
(A36, dropped by decision, below). Six promises are enforced; the plan made
them and its rows prove them.

The live check (A27, in a scratch project) took a plan, `shout-flag`, from
New plan to release entirely in the admin. A second plan was started in a
terminal and released from the admin. A third was started in the admin and
continued in a terminal. The full `pnpm test` was green at Build Phase 9:
2,293 tests, and the everyday suite was marked upheld at 63 s.

## Getting to Done

- **The live check found what no unit test could.** It found:
  - the admin's reader 404ing on a plan that existed only on its branch;
  - two panels claiming the same session;
  - the review showing nothing for falsification and cleanup when the plan
    skipped them;
  - the panel log growing without a scroll;
  - the unattended release meeting uncommitted files on `main`.

  Each was fixed in the phase that found it, and the last became Build
  Phase 10.
- **Bookkeeping on `main` exposed a conflict between two rules.** "A session
  never commits work that is not its own" and "a plan does not land onto a
  dirty trunk" met at InDusk's own files, which InDusk writes to `main` and
  never commits. Build Phase 10 makes approve and land commit them and show
  anything else at review. The cause, writing them there at all, became the
  draft brief `bookkeeping-lives-where-it-is-read`.
- **Falsification found a real security hole.** The admin compared `Origin`
  with `Host`. Under DNS rebinding a page on another site sends both naming
  itself, so it could have started sessions, read their events, answered its
  own permission requests and accepted plans. Every route now checks the host
  first. Writing the test found two more unguarded reads than the hypothesis
  named, so the test now calls every handler each route module exports.
- **One fix exposed a second failure behind it.** Reading `git status` with
  `-z` turned a staged rename into two paths. Then `git add` refused the old
  path, which is gone from both the index and the disk. The commit now takes
  it by name.
- **The full suite caught three of this plan's own duplications.** They were
  a hand-spelled `rev-parse HEAD`, a hand-spelled `--git-common-dir` and the
  root `CLAUDE.md` over its margin. The single-definition guards did their job.

## What We Learned

- **Checking `Origin` against `Host` is not a same-origin check.** It only
  proves the two headers agree. A server bound to loopback must also check
  the `Host` against its own names, on every route, reads included.
- **The best test of "every route is guarded" walks the route modules
  themselves.** A list of routes in a test drifts the moment someone adds a
  handler. The hand list missed two `GET`s that hand out what an attacker
  needs next.
- **A falsification hypothesis about a tool we don't own must be checked
  against that tool before it is fixed.** A36 assumed a project's allow rule
  would let a planning session write unasked. Against the real CLI, an
  untrusted folder's allow rule was not honoured. Proving the trusted case
  would have meant writing `~/.claude.json` while Claude Code writes it, and
  the premise itself was in doubt: an allow rule is the developer's explicit
  choice. Dropped by decision, with the reason in the row.
- **Two rules that are each right can contradict each other at a seam no
  plan owns.** InDusk writing uncommitted files to `main` is the seam. The
  fix for the symptom belongs in the plan that hit it; the fix for the cause
  needs a plan of its own.

## What We'd Do Differently

- **Run the falsification hunt on the security boundary before the live
  check, not after.** The rebinding hole sat open through the whole live
  check, because the origin check had no row of its own; it was written in
  Build Phase 5 to the shape its author thought of.
- **Never edit plan documents with a script.** It happened three times in
  this plan, twice in Build Phase 11. The lesson exists
  (`edit-plan-documents-only-through-the-edit-tool-not-sed-or-heredoc`), but
  it is advisory: nothing refused the Bash command, and the gate hooks never
  saw those edits. It needs an enforcer.
- **Measure the plan's diff from where its code began.** The merge base moves
  at approval, which merges the branch into `main`. That happens to be the
  right base for the code, but only by accident of the approval carrying
  documents alone.

## Insights Worth Carrying Forward

- A `CLAUDE.md` that sits within bytes of its budget turns every context item
  into an editing job. This plan's last context line cost two cuts elsewhere
  in `apps/indusk-mcp/CLAUDE.md`, which is now at 16,382 of 16,384 bytes. The
  next plan to touch it should move an entry down a tier first.
- U3, the smoke check of the published package, is the first real test of
  `indusk update` installing these skills and the bundled admin. Its result
  belongs in `current.md` the day of the release.

## Quality

- **Biome:** no recurring lint or type error suggested a new rule. The one
  lint slip (a `--write` over a whole folder) was reverted at once.
- **Shape:** 4 findings raised across 13 phase reviews, 0 judged wrong by a
  human. The four were:
  - Build Phase 5: the manager could not decline a question;
  - Build Phase 9: two controls deciding which one owned a session;
  - Build Phase 10: two hand-written porcelain parses;
  - Build Phase 11: three callers spelling the status command.
  
  The previous plan also reported 0 judged wrong, so there is no streak.
