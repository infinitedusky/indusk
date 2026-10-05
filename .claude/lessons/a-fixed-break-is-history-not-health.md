# A fixed break is history, not health — a chip that counts fixed violations as live calls a mended promise broken for a week

The admin's chip once turned a behaviour promise red whenever any violation sat in the quiet window. `every-commit-evaluated`'s incident was fixed on 2026-10-03 and every run after it held, and the chip still read *violated* — and would have until its last violation aged out seven days later. The chip could not tell "broken now" from "was broken, and mended".

Why it matters: a red chip is a claim that something needs doing. Once the incident is fixed nothing does, and a chip that keeps saying otherwise teaches people to ignore red — the one colour the loop depends on being read.

What to do: judge a violation by its incident, through the one rule both the chip and the timeline use (`violationState` in `lib/promises/incidents.ts`: unrecorded, open or fixed). Production's chip, or the only source's, is red while any violation in the window is unrecorded or open, and shows `fixed` (purple) once every one is fixed. Local's chip beside a production source follows the newest run instead: nobody records an incident for a break during development. Guarded by `http-promise-timeline-sources.test.ts` (A9).
