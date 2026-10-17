---
title: "The daemon is found, not guessed — Retrospective"
date: 2026-10-17
status: complete
---

# The daemon is found, not guessed — Retrospective

## What We Set Out to Do

Make every reader of promises, every InDusk command and every application on a machine reach the same one local telemetry daemon. Before this plan, a status read could delete the daemon's record, readers guessed ports, a lost record meant a second daemon, test daemons leaked by the thousand, two thirds of the daemon's log was Jaeger failing to trace itself, and the evaluator had logged "endpoint unset" 2,303 times. The promise `the-daemon-readers-follow-is-the-one-running` and its six clauses said what had to hold.

## What Actually Happened

- **Build Phases 1–4** shipped as planned: one definition of an InDusk daemon process, no read deletes the record, a lost daemon is found from the process list and its sockets, one address per machine chosen once (InDusk's own block, 24316–24319) and read by everything, `start` and `register` take over rather than start a second, `reap` stops this home's strays, Jaeger's own tracing off.
- **Build Phase 5** made each clause a span sent by the command that knows the answer, restarted this machine's daemon onto the stored address (18 projects' `.mcp.json` re-pointed to 24317) and ran the live check on this machine: green on the second run.
- **Build Phase 6 (falsification)** found three gaps: a half-running daemon went unreported, a damaged address file read as no address, and the `promises status` change made during Build Phase 5 judged a laptop's breaks by the production rule.
- **Build Phase 7 (cleanup)** read a record's ports and compared them with the address in one place each (six hand-written copies in four files before), and moved finding into `daemon-find.ts`.
- **Build Phase 8 (audit)**: the cold reader's stale-record and orphan findings, then five more places the code was narrower than the decision, found while bringing the ADR up to date. The first fix for a lost address file adopted any running daemon's ports, which on an upgrade would have stored 4318 as the address; it was caught on review and redone so the record carries the address it ran on.
- 143 commits, 85 files, +7,861/−1,104; code in `apps/indusk-mcp/src` +3,253/−645 across 29 files, tests +3,687/−229 across 27.

## Getting to Done

- The live check was red only on a word: `promises status` never printed "broken" for any promise. Sandy chose to make status say it, by the rule the admin and editor already use; falsification then found it used that rule wrongly for a laptop beside production.
- The package context file (`apps/indusk-mcp/CLAUDE.md`) was already 22 KB against a 16 KB budget, so every context step had to shrink it while adding a rule. It is still over.
- The audit's no-address findings looked like the reader assuming the stable port had not happened. It had read the approved impl, where the move was still a step to come, and the first-setup code paths, which are real for every other machine. Three were set aside with that reason in Notes; two held.
- Bringing the brief, ADR and clause plan up to what was built surfaced five gaps between the ADR and the code that no row or ritual had caught. All five went into Build Phase 8.
- The brief's address clause now names `indusk telemetry address --reset` as the one deliberate way the address changes. `plans amendments` did not list it as an amendment (it reads the trunk's copy, and a reworded clause matched in brief and registry is not an amendment to it), so the brief's re-approval is by hand.
- This machine's daemon runs from the worktree's binaries since the Build Phase 5 restart; it is restarted from trunk after landing.

## What We Learned

- A rule that already decides a word in one surface (the admin's `healthOf`) is the one every surface uses, and the rule's inputs come with it: reusing `healthOf` without `ruleFor` reproduced the admin's word with the wrong judgment for one source.
- A recovery path that adopts what is running cannot tell "the daemon was on its address" from "the daemon predates the address". Only a record written at start can; anything inferred from ports guesses, which is what this plan existed to remove.
- Reconciling the ADR with the code is a review in its own right: writing the amendments found five departures that falsification, cleanup and the cold audit had all missed, because each of them read the code against the tests or the plan, not against the decision text line by line.
- A cold auditor's findings are judged against the machine's state, not only the documents: it reads the plan as approved, so anything that happened after approval (here the move onto the stored address) is invisible to it.

## What We'd Do Differently

- Read the ADR's decisions against the code at the end of the last build phase, not after the audit; it would have put the five gaps into one phase instead of a late fourth.
- Check a subagent's change "beyond what the Technical block says" before closing its phase. The lost-address change passed every test and would have broken the brief on every upgrade.
- Hand the cold auditor a one-line statement of the machine's state since approval, so its findings are about the code rather than a moment already past.

## Insights Worth Carrying Forward

- **Shape:** six findings across the build phases (a named function for a status sentence twice, a named step from machine state to start decision, one table for start options, a guessed finder name removed, one role-to-port table in the finder); none judged wrong by a person.
- **Deferred verification:** the brief's three expectations (one daemon for a month, no "endpoint unset" lines, a readable log) are looked at 30 days and one week after landing; until then, each is watched by the reports `telemetry status` and the finders send.
- **Not done here:** the extension manifest's health checks (`extensions/local-telemetry/manifest.json`) still check the daemon by pid and port and read `~/.indusk` directly; carried to a later plan.

Landed on main at 60e81c068, 2026-10-17. Installed with `pnpm install:local` the same day (the land had not run it; trunk's build lacked the plan's code until then); this machine's daemon restarted from trunk's binaries at 17:50Z, which also cleared the four live-check breaks from Jaeger's memory. Nothing published: this project installs its own build and publishes deliberately.
