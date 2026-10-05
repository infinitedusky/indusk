# One dead source never hides another — a read over several backends returns each one's failure as that backend's result

A developer reads promise health from two places: `local`, the laptop's telemetry daemon, and `production`, the always-on server. A read that throws on the first failure lets either one blank the other. A laptop with no daemon running would hide production's health, and a production outage would hide the local loop. Each surface would say "Jaeger could not be reached" and nothing else, while one backend held a perfectly good answer.

Why it matters: the reader is asking two questions, and one of them was answered. Throwing turns "I know half" into "I know nothing", which is the opposite of saying what you know. It is also the reason status, `promise_health` and the admin must agree: one of them reporting all-or-nothing makes the others look wrong.

What to do: resolve and read every source separately, and return each one's failure — `unreachable` or `blind`, with where it looked and why — as that source's entry (`readSources` in `lib/promises/telemetry.ts`). Resolution counts too: a missing credential or a stopped daemon is that source's failure, never a throw from the list. A surface then prints every source, says which failed, and still exits non-zero. Guarded by `promise-sources.test.ts` (A4).
