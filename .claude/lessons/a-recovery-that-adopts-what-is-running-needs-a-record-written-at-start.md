# A recovery path that adopts what is running cannot tell "on its address" from "predates the address" — write the answer into the record at start

daemon-found-not-guessed first rebuilt a lost address file from the ports the running daemon held. Every test passed, but on the upgrade a pre-plan daemon on 4318, 16686 and 62843 would have been stored as the address, against the plan's rule that InDusk takes its own block and leaves 4318 to other tools. Reading sockets cannot tell a daemon that was on its address from one that predates the address. Sandy decided (2026-10-17): "Record carries the address" — `DaemonMeta.address` is written when the daemon starts or is taken over, the lost file is rebuilt from it exactly (picked ports and holders included), and a daemon whose record carries no address lends nothing.

**Rule:** if a recovery step infers state from what is running, ask what it infers for processes that started before the state existed. Only a value recorded at start can distinguish them; inference from the running process cannot.

**How to apply:** for any "adopt what is running" path, write a row for the pre-existing-process case, and put the identity of the intended configuration into the record the starter writes.

See `.indusk/planning/archive/daemon-found-not-guessed/adr.md` (amendment 1, row A43) and `retrospective.md`.
