---
plan: decisions-as-questions
reviewed: 2026-10-19
stage: before-approval
---

# Plan review — decisions-as-questions

Read cold, against the code the plan leans on. Each finding has my answer and its reason; none needed a person, so no `blocker:` line. Nothing was approved.

## Findings

1. **No way for a session to send a recommendation, a reason, a cost or what an option changes.** (high; confirmed) The brief's first promise `a-decision-is-a-question` needs these fields. Build Phase 2 of the impl, the phase that wires sessions to the record, says the session `question` event "gains optional fields", but that event is built from the `AskUserQuestion` tool's input (`lib/session/protocol.ts:149-154`), whose schema has only question, header, options (label, description) and multiSelect; an agent cannot add fields the tool does not define. *Answer: amendment.* ADR decision 12 (new) adds a structured ask on the indusk MCP server (`ask_decision`), which arrives as the same kind of permission request and is turned into the record; Build Phase 2 gets its task. Rejected alternative recorded: encode the fields in option text (cost and `changes` would be prose, which decision 3 forbids reading).

2. **Builds never reach `session/manager.ts`'s question path.** (high; confirmed) An unattended build runs through `lib/build/build-session.ts`, which answers every question with `refuseBuildQuestion` (`lib/session/permissions.ts:96`: "decide on your own judgement and record it"), and its prompt (`build-session.ts:36`) says "nobody will answer a question". Both are pinned by `build-session-gates.test.ts` and `protocol.test.ts`. The impl names none of these files, so as written a build would keep refusing and the plan's own promise `a-build-runs-to-review-unasked` would not change in practice. *Answer: amendment.* Build Phase 2 gets a task for the build path (structured ask recorded; plain `AskUserQuestion` still refused, now naming the structured tool; the prompt text changed); the files and the two existing tests join Files Affected.

3. **An untouched follow-on is archived by `archive-dead` after the draft age limit**, which would "close" it and let the release through with nobody deciding. (medium; confirmed from `plans archive-dead`, which moves plans whose documents are all draft or abandoned and old enough) That breaks `release-refuses`, the clause that the release refuses until each follow-on is closed by a person. *Answer: amendment.* ADR decision 11 and Build Phase 3: a plan with `follow_on_of` is never dead-archived; new row T24 proves it.

4. **Nothing proves the sweep itself.** (medium) T4, T5 and T9 assert the deadline functions (`isDue`); no row asserts that the sweep tells the session to continue with the recommendation, marks `went-ahead`, and leaves an expensive or raised question alone. Passing T4 to T11 would not notice a sweep that never fires or fires on an expensive question. *Answer: amendment.* New row T23 (Build Phase 2) for `cheap-and-moderate-go-ahead` and `never-timed-out`.

5. **The save-time check accepts any `question: <id>`.** (medium) `never-decided-silently` is "never recorded without asking it as a question"; a made-up id satisfies the hook. *Answer: amendment.* The hook checks the id exists in the plan's question record; T3 asserts a made-up id is refused. The record is written before the document line, so a real one is always findable.

6. **The system-tier test paths are invented.** (medium; confirmed) `vitest.tiers.ts` is an explicit `SYSTEM` file list, there is no `src/__tests__/system/` and no `*.tiers.test.ts` convention; the impl's own Note 3 doubted this. A test left off the list would run in the everyday suite and `everyday-tests-never-wait.test.ts` would refuse it. *Answer: amendment.* T20, T21, T22 and Test Phase 1 name real paths and a task adds each to the `SYSTEM` list.

7. **T21 relies on `indusk release --dry-run`, which does not exist** (`bin/commands/release.ts` takes no such option). (medium; confirmed) *Answer: amendment.* T21 runs the follow-on step directly in a real temp repository; no new flag.

8. **Mockup paths and state are stale.** (low; confirmed) The three looks are at `.indusk/mockups/admin/screens/` (not `indusk-admin`) and `approved.json` records all three approved by Sandy Corsillo on 2026-10-19; the impl says two still wait. *Answer: amendment*, wording only. Approval is untouched.

9. **Resume of a stopped build is assumed to exist.** (low; unknown) Build Phase 2 says it "reuses the existing resume for a stopped build"; I did not find one for `build-session.ts` (a build session is one `claude -p` turn). *Answer: nothing to change in the plan now; added to Notes* as the first thing to check at Build Phase 2, with the fallback to start a new session with the answer as its first message.

## Audit questions

## Does each row prove its promise's sentence, or something narrower?
- `impl.md` T9 — proves `isDue` returns false for expensive, narrower than "never goes ahead on a timer"; closed by T23 (finding 4).
- `impl.md` T3 — proved a reference's presence only; closed by finding 5.
- Every other promise's rows prove its sentence as worded.

## What does the diff change that no row touches?
- `impl.md` Build Phase 2 — the unattended build prompt and `refuseBuildQuestion` change had no row; now covered by the amended T19/T7 files (finding 2).
- `archive-dead` behaviour; T24 added.

## What does the code do that the brief never promised?
- The `ask_decision` tool (finding 1) is a mechanism, not a promise; it carries `asked-with-a-recommendation` and is in no scope line. Added to the impl's In Scope.

## Which rejected ADR alternative does the code quietly take?
- nothing

## Which skip reason would you not accept?
- `Test Phase 1 Document` and `Build Phase 6 Context` skips hold: no user-facing behaviour is written in Test Phase 1, and the rules were recorded in the phases that made them. `Build Phase 2 Document` and `Build Phase 4 Document` defer to Build Phase 6, which does write the guide page; accepted.

## What else would have to change for each promise to hold?
- `apps/indusk-mcp/src/lib/build/build-session.ts`, `lib/session/permissions.ts` — for `a-decision-is-a-question` and `expensive-waits` (finding 2).
- `apps/indusk-mcp/src/lib/planning/archive-dead.ts` — for `release-refuses` (finding 3).
- `apps/indusk-mcp/vitest.tiers.ts` — for the live checks to run in the right tier (finding 6).
