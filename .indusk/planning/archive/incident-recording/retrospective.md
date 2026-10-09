---
title: "Incident recording"
date: 2026-10-08
---

# Incident recording — Retrospective

## What We Set Out to Do

The demo's step 6 needs a production break to become a reopened plan with nobody typing anything. Before this plan, a violation on the always-on server stayed a red chip until someone ran `indusk promises watch`; catchup told the person to run it; an open incident aged silently; a plan reopened from the archive could not get a worktree; and a running Claude session heard nothing until its next catchup. The brief made six promises: the admin records a production break unasked, catchup records what it finds, an open incident stays loud, a reopened plan can be worked, a break reaches the working agent, and the admin keeps what it heard. Decided with Sandy along the way: the local admin records (the server's pull request waits for workbench-watch-provisioning); recording commits on the trunk; an incident open a day is announced daily; no database (Jaeger, markdown and JSON lines in the project's home); the admin asks both Jaegers every five seconds and nothing pushes.

## What Actually Happened

75 files changed, +4150/−205, in 59 commits; code and tests account for 48 files, +3432/−86. Nine build phases after Test Phase 1: the writer (`recordBreaks`), the machine's record (inbox, heard, reminders), the prompt hook, the readers (`promise_health`, `status`, the admin), catchup's `record_breaks`, the admin daemon's loop, the reopened plan's worktree, then a falsification phase and a cleanup phase. 33 trajectory rows, all passing; no deferred row.

The live check (A6) ran against the real `indusk-always-on` server: 16 seconds from the **Break it** switch to the admin's commit, nothing typed, the incident, the promise and the archived plan's Maintenance phase in one commit, the plan page showing the archived plan **executing**. It needed the server's password, which was a write-only Fly secret no machine held; it was rotated with Sandy's go-ahead and now lives in Doppler `indusk/prd`.

## Getting to Done

Most of what took time was found, not planned:

- **The recorder's own marks could not be read by anyone** (found by A7's reading, Build Phase 6). Each mark named the project it recorded, the promise lives in dusk's registry, and dusk names no production source, so `promises status` dropped every mark. Sandy chose to leave the project off the recorder's marks.
- **A reopened plan was read from the trunk and its worktree listed as unassigned** (Build Phase 7). The plan's A15 row claimed `list_plans` and the admin read it from its worktree; nothing tested that half, and it was false. The resolver now takes an archived folder in an assigned worktree, and calls it "awaiting landing" only when the trunk's copy is not archived too.
- **Falsification found five real failures, all by reading code** (Build Phase 8): a commit that failed once was never finished and the next pass marked itself held; the agent's inbox entry was lost with it; recording committed onto whatever branch the checkout was on; a session starting later heard every entry ever written, fixed incidents included; and one incident's daily reminders each got their own line. Each test was red on its own assertion before its fix.
- **Two guards earlier phases broke** surfaced only through `vitest related` in Build Phase 6: test support in `lib/` built its own path to the promises folder, and the root `CLAUDE.md` was 82 bytes over its lowered budget.
- **Test-side mistakes**: A15's record read kept git's trailing newline, so it checked a path that never existed; A27's `git status --porcelain` collapsed a new untracked folder to its name; A31 counted mentions, not lines.

## What We Learned

- **A live reading of a behaviour promise's own marks belongs in the plan that declares it.** Every unit test of the recorder passed while its marks were invisible to the only registry that holds its promise. The project tag was right for the evaluator's promise and wrong for this one, and nothing short of reading `promises status` against a real daemon could tell.
- **A trajectory row that asserts two things gets one tested.** A15 said "creates its worktree … and the admin reads the plan from it"; the test covered the first half, and the second was false until Build Phase 7 wrote a case for it.
- **An agent that writes on a schedule beside a person meets the person's git.** The admin committing every five seconds in the developer's checkout makes `index.lock` an everyday failure; any writer on a timer needs its failed write finished by a later pass, not dropped.
- **Per-session delivery means a new session has heard nothing.** "Every session hears each break once" is right for running sessions and wrong for one started a week later; delivery needs a notion of what is still true.
- **Falsification by reading found every hypothesis this time.** All five were stated from the code before any test ran, and all five were real.

## What We'd Do Differently

- Write A7's reading (the recorder's marks through `promises status`) as a unit row in Build Phase 1, with a fixture daemon project different from the registry's project, instead of discovering it at the live check.
- Split any trajectory row whose `Asserts` joins two claims with "and", so each half gets its own test.
- Ask for the server credential at planning time: a live check against a deployed server should name where its credential lives before the phase that runs it.

## Insights Worth Carrying Forward

- A writer on a timer: write what the person must hear first, commit second, and keep what could not be committed until it is.
- Test the reader of a mark, not just the writer, whenever the writer and the reader belong to different projects.
- `git status --porcelain` needs `-uall` to name a file inside a new folder.

## Shape

Shape raised **1** finding across nine build phases (Build Phase 4: name the incidents table's inline owner cell `IncidentOwner`), and a human judged **0** wrong. Two left-as-is records (the async lock's loop, the hook's `readLines` mirror) were later resolved at cleanup as `_inbox.js`.

## Quality

No recurring lint or type error suggested a Biome rule; the formatting misses were caught by `biome check --write` per item. No rule added.

## Release

dusk installs its own build at landing (`pnpm install:local`); nothing is published at this close.
