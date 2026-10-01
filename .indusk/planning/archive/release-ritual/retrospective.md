---
title: "The release ritual finishes itself"
date: 2026-10-01
---

# The release ritual finishes itself — Retrospective

## What We Set Out to Do

Publishing 1.54.0 took five attempts, and none failed for the reason its error
gave. The brief named three fixes: the bump becomes the retrospective's Step 11
instead of three manual acts; trunk-guard reads a `chore(release):` message
however it is supplied, and says so when it cannot; the release guard proves
the install before npm is touched.

## What Actually Happened

All three shipped, plus five things the brief did not name. 34 commits over
2026-09-21/22 and 2026-10-01; 25 files, +1311/−138, of which `apps/indusk-mcp`
is 12 files, +872/−87. Seven phases: Test Phase 1, three build phases, a falsification phase, a
cleanup phase, and Build Phase 6 for a defect found at the retrospective.

Added after approval: T10 (a `\`-continued commit was refused with one empty
bullet per line — found by hitting it while landing this plan's own sequence
note), T11 (`record-release.js` recorded HEAD as the release commit, so the
1.54.0 note named a plan commit), and the trunk-guard allowance for
`.claude/skills/` and `.claude/hooks/`, which `indusk update` writes on trunk.

Falsification confirmed all three of its hypotheses, every one red on its own
assertion before the fix:

- **T12** — the exemption matched `chore(release):` anywhere in the command
  text, so a body `-m` paragraph or a preceding `echo` let a code commit onto
  `main`. It now reads only the commit's own first message.
- **T13** — Step 11 asked what `HEAD~1..HEAD` changed. Step 10 ends by
  committing the landing note, so that is always the note, and every plan
  would have read "nothing to release". The step as first shipped could not
  have worked once.
- **T14** — the install check asked only whether `indusk-mcp`'s
  `dependencies` existed. A devDependency, an `indusk-admin` dependency or a
  version bump — the same merged-not-installed failure — passed it. It now
  compares `pnpm-lock.yaml` with pnpm's install record.

The retrospective itself found one more. Root `master.md` item (d) had been
re-routed to this plan on 2026-09-25 — `record-release.js` writes "published"
because `pnpm publish` exited 0, which is how 1.51.0's note claimed a publish
the registry never received — and it was never added to the impl, while the
2026-09-17 note in `current.md` claimed it already fixed. Build Phase 6 took it
(T15): the note now says "published" only when `npm view` confirms the version.

Cleanup removed a third private copy of the trunk-guard test harness (Test
Phase 1's own item had said to reuse the existing one, and was checked off
anyway) and a third, unpinned copy of the packaged-paths list in Step 11's
prose.

## Getting to Done

The plan stalled for nine days with Build Phase 3's code committed and its
checkboxes empty. The session that wrote Step 11 committed it, with T8/T9
passing, and stopped before ticking the impl. A second session on another
laptop then read trunk's copy of `impl.md` — 27 unchecked items — and spent
most of its time believing nothing had been executed; `indusk worktree create`
had cut a fresh branch from `main` there instead of the existing remote one,
which hid the work rather than surfacing it. It also diagnosed a test-first
violation (T8/T9 "unwritten") that was only the `State` column never updated:
both tests existed and T8 was red before Step 11, verified by checking the
pre-Step-11 skill out and running it.

Two other wrong facts were in circulation and corrected: the 1.54.0 note in
`current.md` (T11's subject), and this plan's own master entry, which still
said "nothing executed".

`pnpm test` on the plan worktree failed nine tests, all the known
fresh-worktree admin-bundle group; they pass 12/12 once the bundle is built.
The `daemon-identity` failures the impl anticipated did not occur.

## What We Learned

- **Check whether the test exists before calling a row unwritten.** A
  trajectory `State` column is bookkeeping; the file on disk and a run against
  the pre-fix source are the evidence. Two sessions inherited a false
  "violation" because nobody looked.
- **Every check here answered a narrower question than the one it stood for**
  — a regex over the command for "this commit's message", the last commit for
  "since the release", one package's `dependencies` for "the install". All
  three looked right and passed their own tests; falsification found them by
  asking what each check is *for* and comparing.
- **A ritual step must be run against the steps around it.** Step 11's
  `HEAD~1` was correct in isolation and wrong in sequence, because Step 10
  commits last. No test of Step 11 alone could see that.

## What We'd Do Differently

- Tick the impl in the same commit as the code. A commit message saying "T8,
  T9 pass" with the table still saying `planned` cost a session.
- Read the master's owner lines when opening a plan. Item (d) named this plan
  as its owner for six days and nothing pulled it in; only the retrospective's
  sequence check read it.
- Write the test plan. The workflow requires one for any plan that ships an
  impl; this plan went brief → impl, and the admin shows the gap. It is the
  case `admin-plan-type` was opened for.

## Insights Worth Carrying Forward

A guard that reads text should read the parsed structure it already has
(`commitArgs`'s tokens) rather than re-scanning the raw string with a second
regex — the second reading is where the two disagree.

## Quality Ratchet

No recurring lint or type errors. One pre-existing `noConsole` warning in
`check-install.js` was fixed in passing (`console.info`). No new Biome rule
fits the defects found — they were semantic, not syntactic.

Shape findings: 0 raised, 0 judged wrong. Shape ran informally at each build
phase in this session (no boundary records written), and found nothing within
a unit; the cross-file findings were Cleanup's.

## Metrics

- Sessions: 3 (2026-09-21/22 authoring and Build Phases 1–3; 2026-09-25
  salvage of T10/T11; 2026-10-01 bookkeeping, T10/T11, falsification, cleanup)
- Files touched: 25 (+1311 / −138)
- Trajectory: 15 rows, all passing; 6 of them (T10–T15) added after approval
- Deferred Verification U1 (a real publish) — this close is its first run

Landed on main at 283f6723, 2026-10-01.
