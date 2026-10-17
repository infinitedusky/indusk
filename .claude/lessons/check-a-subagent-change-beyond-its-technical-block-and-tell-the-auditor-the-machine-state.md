# Review what a phase changed beyond what its Technical block says before closing it, and hand a cold auditor the machine's state since approval

In daemon-found-not-guessed the Build Phase 8 lost-address change passed every test and still broke the brief on upgrade (a pre-plan daemon's ports would be stored as the address). The Technical block asked only for the daemon's ports to be kept; the change went further (it kept a running daemon's ports even when the block was free). Nothing reads a change against what the block did not ask for. Separately, the cold auditor reads the plan as approved, so it did not know that the machine's daemon had been restarted onto the block and what state it was in.

**Rule:** before closing a phase, diff what it changed against what its Technical block says, and check anything beyond it against the brief. When handing the audit to a cold reader, add one line on the machine's state since approval (what was restarted, migrated or left running).

**How to apply:** make "changes beyond the Technical block" an explicit line in the phase-close check, and put the machine-state line in the audit's input.

See `.indusk/planning/archive/daemon-found-not-guessed/retrospective.md` and `impl.md` (Build Phase 8, row A43).
