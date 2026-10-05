# A flag that names a source must choose it — a `--source` that only labels its output reports production from a laptop

`promises watch --source deployed` once wrote `source: deployed` on every incident it opened, and read whatever single Jaeger the project resolved to. On a project with a production server and a local daemon, the flag decided the label and nothing else. An incident could say "deployed" while holding a trace from the developer's laptop, and `--source local` could record production's break as a local one.

Why it matters: an incident's source tells a person which logs to open and whether users were hit. A label that the code never acted on is a claim nobody checked. It reads exactly as true as one that was checked.

What to do: when a flag names where something came from, make it choose what is read, and refuse when that thing does not exist. `--source deployed` reads `production` and is refused naming `promises.jaeger` when none is set; `local`, `smoke` and `desk` read the laptop (`lib/promises/watch.ts`). Test it with two backends holding different data, so a flag that only labels cannot pass. Guarded by `promise-sources.test.ts` (A5).
