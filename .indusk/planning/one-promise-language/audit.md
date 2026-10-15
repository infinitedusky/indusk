---
plan: one-promise-language
audited: 2026-10-15
model: claude-opus-5-5
---

# Audit — one-promise-language

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-mcp/src/__tests__/promise-words.test.ts:102` — `a-promise-is-upheld-or-broken`, clause "signal, not mark". A10, the word-scan row, refuses *mark* only after `a`/`its`/`the`/`every`, or in `marked the promise`. These still pass the scan: `guide/run-your-own-server.md:3` ("production marks"), `:117` ("sends one mark"), `guide/promises.md:218` ("that mark"), `:263` ("reads promise marks"), `guide/index.md:178` ("a promise's mark"), `:183` ("run, mark, Jaeger"), `guide/contract.md:28` ("sends marks"), `guide/always-on.md:3` ("a run marks a promise"), `reference/cli/telemetry-server.md:47` ("what has been marked"), `guide/try-it.md:24,46`. The row proves "no *the mark*", not "the telemetry is called a signal".
- `apps/indusk-mcp/src/__tests__/promise-words.test.ts:48-56` — the same promise. A10 reads `skills/*.md` but not the extension skills that `indusk init` installs. `apps/indusk-mcp/extensions/testing/skill.md:39,43,54` (installed as `.claude/skills/testing/SKILL.md`) still says `// or "violated"` with no read-as-broken line, "Test the mark", and "asserts a violation". The scan also skips `docker/Dockerfile.always-on:5` and `docker/fly.always-on.toml:36,49,77`. Those are the image and Fly sources the release publishes, and they still say "violation". The plan reworded their twins under `templates/server/`.
- `apps/indusk-mcp/src/lib/promises/signal-writers.test.ts` — the same promise. A3, the writers row, covers four InDusk writers and the demo. A fifth writer, `apps/indusk-mcp/scripts/suite-speed.js:37`, writes `indusk.promise.outcome` itself, around `markPromise`. Its line at `:117`, printed in every `pnpm test` summary, says `marked <promise> violated`.
- `apps/vscode-extension/src/core/view-words.test.ts:20-45` — the same promise, clause "no signal is never shown as holding". A7 and A9, the editor rows, test the amber and unverified states and a missing row. They do not test grey: `view.ts:37` maps grey, which is what `health.ts:485` gives a retired promise and `health-line.ts:150-152` emits, to `holding`, and `markers.ts:84` draws it with the ok tone. The rows also miss `fixed` (`view.ts:33`, "fixed" where the admin says "broke — fixed") and `activity.ts:50` ("No runs yet.").
- `apps/indusk-admin/src/components/PromiseWords.test.tsx` — the same promise. A6 and A7, the admin rows, test the chips, timeline cells, health lines and plan-list warning. They miss the dashboard row's last column, `Promises.tsx:376` ("never seen"), and the promise page's legend, `promise/PromiseProof.tsx:266` ("Grey: nothing seen.").

## What does the diff change that no row touches?
- `apps/indusk-mcp/src/lib/promises/store.ts:281`, `health-line.ts:53,173-176` — `indusk promises health --json` now writes `runs[].outcome: "broken"` where it wrote `"violated"`. That JSON is the editor extension's only input. No row covers the JSON contract, or an editor installed before this plan reading it.
- `apps/indusk-mcp/src/lib/testing/trace-shape.ts:156,163` — the failure messages of the test helper a person reads say "marks promise … violated". No row covers them, and the scan does not read them.

## What does the code do that the brief never promised?
- `apps/indusk-mcp/src/lib/promises/health-line.ts:53` — it changes a machine-read value. The brief's Not promised section keeps machine names ("the attributes stay; only what people read changes"). Yet the outcome word in `promises health --json`, read by a program (the editor), changed in this release. This is the change the ADR deferred to `mark-first` for the signal attribute.

## Which rejected ADR alternative does the code quietly take?
- `apps/indusk-mcp/src/lib/promises/health-line.ts:53` — the ADR rejected the alternative "Write `broken` in this release" because a reader older than this plan drops `broken`. The health line takes that alternative for its own wire. An editor extension installed before this release (`indusk editor install` is never re-run by `indusk update`) applies `r.outcome === "violated" ? "broke" : "held"`, so it shows every broken run as **held**.
- `apps/indusk-mcp/src/lib/promises/incidents.ts:232` — the same reasoning applies to the registry state, but ADR decision 3 took it in the open. Opening an incident writes `known-broken`, and an InDusk older than this plan refuses that state as invalid (`promiseProblem`). Any checkout that pulls the trunk commit and runs an older `indusk promises check` is refused. Not quiet, but the ADR does not apply to the state the skew argument it makes for the outcome.

## Which skip reason would you not accept?
- nothing — none of the thirteen rows is skipped or deferred; the only `skipIf` in the diff (`promises-check.test.ts:33`, missing build) predates this plan.

## What else would have to change for each promise to hold?
- `apps/docs/src/guide/try-it.md:35`, `guide/promises.md:217`, `reference/cli/demo.md:40`, `reference/cli/looks.md:415` — `a-promise-is-upheld-or-broken`. These pages say the demo, the evaluator and the looks check mark their span `broken`. This release they write `violated` (`examples/seat-holds/src/seats.ts:65`, `lib/promises/mark.ts:5`). Someone who searches Jaeger for `indusk.promise.outcome=broken` finds nothing.
- `apps/indusk-admin/src/components/ui/PromiseRow.tsx:27` — the same promise, clause "no signal is never shown as holding". The dashboard draws an `enforced` behaviour promise's dot `bg-ok` (green) even when no signal has reached it in the window. The look is held by an approved mockup, which this plan's brief rules out changing.
- `apps/indusk-mcp/scripts/suite-speed.js:37` — the writer switch in `mark-first`, the next-release plan carrying it, has to cover this writer too. `mark.ts` describes itself as "the one place to change", and it is not the only one.
