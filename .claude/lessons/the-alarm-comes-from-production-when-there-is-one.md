# The alarm comes from production when there is one — a local break during development is work in progress, not an alarm

A developer building a feature breaks promises on their laptop all the time: that is what writing the code looks like before it works. Once a project reads both its local daemon and its production server, merging the two would turn every local experiment into "unrecorded violations outrank the roadmap" — the session would lead with the developer's own half-written code, every time. Showing only production would hide the local loop that tells them their change broke a promise before it ships.

Why it matters: a raised violation interrupts whatever the person was about to do. Raising local work in progress spends that interruption on something they already know, and an alarm that cries every session stops being read.

What to do: show every source, and raise from one. The **alarm source** is production when the project names one, otherwise local (`alarmSource` in `lib/promises/sources.ts`). `promise_health`'s top-level `needsAttention`, the admin sidebar's red mark, `status`'s exit code and catchup's "raise first" all come from it; a local-only break appears under `local` and is mentioned after. Guarded by `promise-sources.test.ts` (A6) and the admin's `http-promise-sources.test.ts`.
