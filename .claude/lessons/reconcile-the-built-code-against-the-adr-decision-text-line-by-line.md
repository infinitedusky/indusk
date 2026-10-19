# Before closing a plan, read the built code against the ADR's decision text line by line — falsify, cleanup and a cold audit read code against tests and the plan, and missed five departures

In daemon-found-not-guessed, reconciling each ADR decision with the code found five departures (lost address file, homes matched by exact string, pairing by start time only, readers losing a half-running daemon, a reap hint that could not act) that the falsification ritual, the cleanup ritual and the cold audit had not named. The rituals read the code against the tests and the plan's rows; the decision text is a third source and none of them held it against the code. A further case (the stale record making the running daemon a stray; `reap` dropping orphans) was found by the audit only because it compared with the ADR.

**Rule:** a plan's closing includes one pass that takes each ADR decision sentence and finds the code that makes it true, noting every difference as either a fix or a dated amendment.

**How to apply:** at the retrospective, list the ADR's decisions, open the code each names, and record the result. Do it before the docs are written, so the docs describe the reconciled behaviour.

See `.indusk/planning/archive/daemon-found-not-guessed/adr.md` (Amendments 7 and 9), `audit.md` and `retrospective.md`.
