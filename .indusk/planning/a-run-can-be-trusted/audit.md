---
plan: a-run-can-be-trusted
audited: 2026-10-19
model: claude-opus-5-5
---

# Audit — a-run-can-be-trusted

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-mcp/src/lib/run-record/situation.ts:156` — Clause `says-what-is-true` (the page and nav row state the plan's situation in words) is proved by rows A65–A68 of this plan's trajectory, which assert the sentences for planning, building, waiting, complete and stopped. All four call `situation()` with inputs built by hand. No row gives it a run that ended normally and whose wait the person has since answered. `runStatus` (`liveness.ts:36`) reads such a record as `stopped`, and its reason is the raw stop step name.
  - breaks when: a planning run ends at `ready-for-approval` and the person approves. With nothing left to wait on, the plan reads "Stopped — ready-for-approval. Build starts the planning again." and its next step is "press Build to start it again", although the plan is approved and Build would start the build.
  - answer: nothing — a real defect in the stopped sentence; this unattended build was told not to act on audit findings, so it goes to /falsify as a hypothesis
- `apps/indusk-mcp/src/lib/run-record/next-step.ts:59` — Clause `always-a-next-step` (every open plan shows its next step and who takes it) is proved by A70 and A71. A70 asserts each situation has a next step; A71 asserts no real plan lacks one. Neither checks that the step shown is true. The nav row builds its situation without confirmations (`plan-situation.ts:132` fills them only for the plan's own page), so every merged plan in the nav gets the "nothing open" branch.
  - breaks when: a plan merged to main still has unreported clause signals. Its nav row tooltip reads "Next, you: everything is confirmed; the retrospective closes it", while the plan page lists signals still to confirm.
  - answer: nothing — real, nav tooltip only (the plan page lists the open signals); left for /falsify under the same instruction
- `apps/indusk-mcp/src/lib/plans/steps.ts:179` — Clause `the-planning-audit-is-a-step` (the Planning audit step is in progress while the plan is read cold) is proved by A72, A81 and A88. These assert the step reads in progress only while the admin's planning run is on its `plan-review` step. A cold read started any other way is not seen.
  - breaks when: `/audit <plan> --before-approval` runs in an interactive or terminal session. The Planning audit step reads "to do" for the whole read.
  - answer: nothing — the clause scopes the step to the admin's planning run; a terminal /audit leaves no run record to read, so 'to do' there is as designed
- `apps/indusk-mcp/hooks/plan-write-guard.js:486` — Clause `shell-write-refused` (any shell command that writes, moves or deletes a file in a plan folder is refused) is proved by A22–A30 and A75–A77. These rows list specific command forms. Calling `judgeCommand` directly shows that each of the following writes a plan document and is allowed:
  - `perl -0pi -e … impl.md`: the `-i` test `/^-[a-zA-Z]*i/` fails on the digit.
  - `python3 - <<'PY' … open(impl,'w')`: a script read from stdin is never read.
  - `node -e "…writeFileSync(process.argv[1])" <plan path>`: the plan path is an argument, not in the inline text.
  - `F=<plan path>; echo x >> $F`
  - `git apply x.patch` where the patch edits a plan document (`:620` refuses only a plan path given on the command line).
  - `awk -i inplace`, `sponge`, `ed`.
  - breaks when: an agent ticks a box with any of these forms. The witness hook (which records afterwards what the shell changed in plan folders) reports it later; the guard does not stop it.
  - answer: signal — any change to a plan folder during a shell command the guard allowed is reported broken; plan-write-witness.js via lib/promises/clause-verdicts.ts; on every shell command that changes a plan folder; clause: a-plan-document-is-written-through-its-checks/shell-write-refused
- `apps/indusk-mcp/hooks/plan-write-guard.js:68` — Clause `reads-pass` (a shell command that only reads a plan document is never refused) is proved by A31–A35. None of them covers an inline interpreter that reads. The `WRITE_CALL` pattern counts any `.write(` as a write, and the guard refuses a cleanup command in a plan folder whatever its flags.
  - breaks when: `node -e "process.stdout.write(fs.readFileSync('<plan>/impl.md','utf8'))"`, `python3 -c "sys.stdout.write(open('<plan>/impl.md').read())"`, a read whose text contains `rename(`, or `git clean -n` (a dry run) run inside a plan folder. Each is refused, as confirmed by `judgeCommand`.
  - answer: nothing — real false refusals; a refused read costs one retry through the Read tool and loses no data; left for /falsify
- `apps/indusk-mcp/src/lib/promises/contract.ts:481` — Clauses `refused-without-signals` (saving an impl with no signal task for a clause is refused) and `a-live-check-proves-no-clause` (saving an impl where an after-landing row names a clause is refused). A36–A45 and A83 prove the rule only for a draft impl, and A40 asserts that an approved or in-progress impl is never refused. The impl hook also exits before the contract check when the text holds `<!-- skip-gates -->` under any policy but `strict` (`validate-impl-structure.js`, before line 195). A signal task counts if its text has the clause name, the word "signal" and something shaped like a path (`clause-signal-rules.ts:92`). Nothing checks the path exists or reports anything.
  - breaks when: during a build, someone deletes a signal task or adds a `live check` row naming a clause to an in-progress impl. The save goes through, and the problem shows only at `promises confirm`.
  - answer: nothing — by design: A40, the trajectory row asserting an approved or in-progress impl is never newly refused, is the brief's choice; promises confirm catches the gap at close
- `apps/indusk-mcp/src/lib/plans/bring-trunk.ts:99` — Clause `the-two-landed-plans-report` (the three clauses of `a-brief-is-accepted-on-current-main` report, so that plan can close) is proved by A46–A49 and A86, which show the spans are emitted. `a-conflict-refuses` reports only when a real acceptance meets a conflict. The only row that shows the other plan closing is L2, a live check that runs after landing and is `skipped`.
  - breaks when: no conflicting acceptance happens after landing. `a-conflict-refuses` stays at no signal, and `a-brief-is-accepted-on-current-main` still cannot close. That is the situation the clause was written to end.
  - answer: nothing — real: the other plan closes only once a conflicting acceptance happens in use; L2, the after-landing live check, tracks it and the person decides whether to wait
- `apps/indusk-mcp/src/__tests__/admin-recorder.test.ts:96` — Clause `recorder-waits-for-its-break` (the recorder test waits for its incident and passes with other builds running) is proved by A59, A60, A62 and A89. A59 delays the scan by pausing the admin process with `SIGSTOP`. No row runs the test while other builds load the machine, so slow Jaeger queries and late span indexing under load are never exercised.
  - breaks when: under real concurrent landings, every recorder pass throws or ends `ok` before the break is searchable. The test then fails at its 4-minute bound, or fails with "finished a scan … found no incident". Either way the result depends on load, not on the code under test.
  - answer: signal — the recorder landing test's result is reported at every landing, which runs under real concurrent load; apps/indusk-mcp/src/lib/plans/land-recorder-signal.ts; once per landing; clause: landing-tests-hold-under-load/recorder-waits-for-its-break

## What does the diff change that no row touches?
- `apps/indusk-mcp/src/lib/run-record/landed.ts:91` — "On main" is read from the root checkout's current branch (`git branch --show-current`, and `"HEAD"` in `apps/indusk-admin/src/lib/plan-situation.ts:78`), not from the project's trunk. For a workbench plan, the landing merge goes into the code repo (`land.ts` `landWorkbenchPlan`), but only the root's history is searched. A21 and A87 run normal-mode landings with the trunk passed in.
  - breaks when: (1) the project root is checked out on any branch other than main. Every landed plan then reads not complete, and `build-host.ts:201` re-judges a recorded "released" on each poll and flips it to `release-failed: … not on main`. (2) A workbench plan is landed but its documents are not yet archived at the root. It reads stopped instead of complete.
  - answer: nothing — real; the project root sits on main by convention, but the workbench case is a genuine gap; left for /falsify
- `apps/indusk-mcp/src/lib/promises/clause-verdicts.ts:320` — The guard snapshots every plan folder before each Bash command, and the witness snapshots after. Any change between the two is blamed on that command and reported as `shell-write-refused` broken. No row covers a second writer working at the same time.
  - breaks when: a long `pnpm test`, or any shell command, is running while the Edit tool, another session in the same worktree, or the admin's planning run writes a plan document. The clause reads broken, naming an innocent command.
  - answer: nothing — real source of false breaks; each break names the command so a person can dismiss it; left for /falsify
- `apps/indusk-admin/src/lib/build-host.ts:570` — The build's record is written with no process and no stop before `await depsFor(...)`. The in-memory entry is set only after that await (line 583). During that gap, `buildState` reads the fresh record through liveness as a dead run.
  - breaks when: the page polls, or Build is pressed again, while `planLocation` resolves. The controls read "Stopped: the run died", and a second press sees a dead run and starts a restart.
  - answer: nothing — real race window between writing the record and setting the in-memory entry; left for /falsify
- `apps/indusk-mcp/src/lib/plans/steps.ts:205` — Falsify, Cleanup, Audit and the executing phases count as running only when `live.build` is set, which only an admin build run sets. An admin interactive session (`live.writing`) doing that work is ignored.
  - breaks when: the person runs `/work` or `/falsify` in an admin session. The step reads "to do" and the plan reads "nothing is running" while the session works.
  - answer: nothing — interactive admin sessions are outside the brief's 'run' (a build, a planning run, a release)
- `apps/indusk-mcp/src/lib/plans/land-recorder-signal.ts:41` — The landing report takes any clause-test file that carries the `recorder-waits-for-its-break` token. Two unit files carry it: `wait-for-incident.test.ts` and `recorder-loop.scan.test.ts`.
  - breaks when: a later plan's rows name only those unit files. Its landing reports the clause upheld, although the recorder landing test never ran.
  - answer: nothing — hypothetical until a later plan names only the unit files; the landing already keeps a failing file's result; left for /cleanup
- `apps/indusk-admin/src/components/plan/PlanStatusCard.tsx:55` — With an empty confirmation list, the complete card reads "Everything it promised is confirmed." The list is empty whenever `readStanding` fails (its error is swallowed at `plan-situation.ts:154`) or the plan's promises are not written as clauses.
  - breaks when: the promise registry cannot be read, or the plan's promises are still `declared`. A merged plan then claims everything is confirmed.
  - answer: nothing — same root as the nav-row finding (confirmations not loaded or swallowed); left for /falsify

## What does the code do that the brief never promised?
- `apps/indusk-mcp/src/lib/plans/archive.ts:70` — Archival now goes through `indusk plans archive`, which refuses while the plan owns a `declared` promise. The retrospective skill now calls it, and the guard refuses the old `mv`. The brief says nothing about archiving.
  - breaks when: a plan's promises cannot be confirmed (a clause at no signal). The retrospective cannot archive it by any route, and the plan never closes.
  - answer: nothing — consistent with the planning rule that a plan confirms its promises before it archives; a clause at no signal is meant to block the close, and withdraw remains the route
- `apps/indusk-mcp/hooks/plan-write-guard.js:739` — In every InDusk project the hooks reach, every Bash command now snapshots every plan folder twice and writes a pending file in machine state. Commands that changed a plan folder are recorded for judging. The brief promised a refusal, not a witness on every command.
  - breaks when: a project has many plans and runs shell commands often. Each command pays for two full folder scans, and the cost and stray pending files reach projects that never opted in.
  - answer: nothing — the witness is how shell-write-refused gets an independent signal; its cost is unmeasured and whether it reaches non-opted projects is the person's call
- `apps/indusk-mcp/src/bin/cli.ts:1525` — Every `indusk` command except `promises contract` first drains and sends the guard's decisions, at most once a minute. `program.parse()` became `await program.parseAsync()`.
  - breaks when: the local daemon is up but slow to accept spans. The first `indusk` command in each minute waits on span export before doing its own work. This includes the commands hooks and the build runner invoke.
  - answer: nothing — bounded to once a minute; export latency unmeasured; /falsify can time it
- `apps/indusk-mcp/src/bin/commands/promises.ts:241` — Signal reports from later plans are attributed to this plan: `{ plan: "a-run-can-be-trusted", phase: "Build Phase 4" }` here, and `"Build Phase 6"` in `land-recorder-signal.ts:23`.
  - breaks when: another plan's impl is refused, or another plan lands. Its spans show in the timeline as this plan's Build Phase 4 or 6.
  - answer: nothing — a real mislabel once another plan uses it; left for /cleanup

## Which rejected ADR alternative does the code quietly take?
- `apps/indusk-mcp/src/bin/commands/promises.ts:230` — Impl Decision 8 rejected a check that gives itself its own verdict, because such a verdict "can never read broken". Decision 17 likewise requires signals to read a source independent of the code they judge. `reportRefusedSignalRules` does what both rejected: whenever the contract check refuses a draft, it reports `refused-without-signals` and `a-live-check-proves-no-clause` upheld, on the rule's own word.
  - breaks when: the rule refuses wrongly, for example by miscounting a task that does name its signal. Each wrong refusal still adds an upheld report, which dilutes the independent broken reports from `promises confirm`.
  - answer: nothing — real departure from Decisions 8/17; the self-reported upheld is supplementary to promises confirm's independent reports; left for /falsify or /cleanup to remove or justify
- `apps/indusk-mcp/hooks/validate-impl-structure.js:164` — Impl Decision 9 rejected "a second reader in the hook": checks that need the brief go through `indusk promises contract`, "no new hook code". `briefStatesClauses` adds a hook-side regex reader of `brief.md` frontmatter, and it decides whether the draft check runs at all.
  - breaks when: a brief has CRLF line endings, frontmatter not at byte 0, or a `clauses` value the package's `parseBriefContract` accepts but this regex does not. The hook skips the clause-signal check for the draft, while the package would have refused it.
  - answer: nothing — real departure from Decision 9; the CRLF and offset-frontmatter cases are unobserved; left for /cleanup

## What let these through?
- The situation and next-step rows feed hand-built inputs to pure functions, so no row drives a real end state from a record on disk — findings: `situation.ts:156`, `next-step.ts:59`, `PlanStatusCard.tsx:55` — highlight: h-20261019-033
- The shell-write guard's rows list the command forms the author thought of, not an adversarial set — findings: `plan-write-guard.js:486`, `plan-write-guard.js:68` — highlight: h-20261019-034
- Code added during the build was never re-checked against the impl's own Decisions and rejected alternatives — findings: `promises.ts:230`, `validate-impl-structure.js:164`, `promises.ts:241` — highlight: h-20261019-035
