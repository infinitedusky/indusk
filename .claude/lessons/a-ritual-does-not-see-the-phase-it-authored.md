# A close-out ritual never sees the phase it authored — one pass each is not enough when rituals generate work

The close-out sequence is `/work → /falsify → /work → /cleanup → /work → /retrospective`, and it silently assumes each ritual runs once. That assumption breaks because **both rituals produce phases, and those phases contain real work the ritual has not examined.**

In `lifecycle-rebalance`: `/cleanup` authored Phase 6, and Phase 6's execution created two new modules (`lib/git.ts`, `impl-blocks.ts`) that no cleanup pass had reviewed. `/falsify` covered Phases 1–4; Phase 7 then shipped a new tracked artifact, new package exports and two new test files that no falsification pass had hunted. Running each ritual a second time found five more confirmed defects and two more inter-file duplications — including a duplication that had **already diverged**, and a regression that silently disabled `verify`'s phantom detection.

**The rule:** before `/retrospective`, check whether any phase was authored by a ritual *after* that ritual last ran. If so, run it again. In practice: re-run `/falsify` if new code landed after the last falsification phase, and re-run `/cleanup` if new files landed after the last cleanup phase — including the files the previous cleanup itself created.

**Why the gate does not catch this:** `checkRetrospectiveReadiness` asks whether a terminal Falsification Phase and a terminal Cleanup Phase exist. Both existed. Neither had seen the plan's most recent five phases. The gate proves a ritual ran, never that it ran over everything.

**Cheap heuristic:** compare the highest phase number against the phase number of each ritual's phase. If a ritual's phase is not among the last phases, its coverage is stale.
