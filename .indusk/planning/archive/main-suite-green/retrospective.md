---
title: "main-suite-green — Retrospective"
date: 2026-10-15
---

# main-suite-green — Retrospective

## What We Set Out to Do

Make `pnpm test` pass from the root of a clean main. Landing skip-reason-why had found seven failures in `apps/indusk-mcp` and two admin timeouts under the root run, none of them that plan's. The brief made two promises: `the-everyday-suite-passes-on-main` (the root run passes) and `a-large-impl-gets-the-same-contract-answer` (the contract check reads an impl of any size reliably, so the write hook never refuses a large impl at random). It also changed `a-component-has-one-implementation` to hold only the mockups of landed plans.

## What Actually Happened

The branch touched 32 files (+762/−91), 27 of them under `apps/` and `turbo.json` (+529/−51), over 60 commits in six build phases after Test Phase 1.

- **Phases 1–2 went as planned.** The contract check reads stdin asynchronously. Four stale tests were brought up to the behaviour they guard. The landed-plans rule went into `lib/looks/landed.ts`, and cockpit-audit-fixes' brief gained its `## Looks`.
- **Phase 3 found more than the plan named.** The two admin timeouts had one cause: each test loaded its route's whole module graph inside its 5 s budget. The same pattern timed out two more files, `new-project-routes` and `new-project-parent`. Once the admin passed, the mcp package's root-run result was seen for the first time, because turbo had always stopped at the admin failure. Three or four mcp tests that spawn git or the CLI timed out, a different few each run, so Sandy chose a package-wide 15 s timeout. A browser template test failed once: Vite discovered a dependency mid-run and reloaded the page, fixed by pre-bundling `instrumentation-xml-http-request`. The last red was not a test at all. The trailing daemon guard found four telemetry processes that two other sessions had left running from their scratchpad homes. After Sandy had them stopped, the root run passed.
- **Falsification (Build Phase 4) found a real hole in Phase 2's rule.** The rule read only a mockup's latest approval, so an in-flight re-approval exempted the whole mockup. `plan.needs-you`, `plan.working`, `plan.parts`, `plan.released` and `phase-row.open` (all held earlier under landed plans) had silently dropped out of the check on main. The fix holds the components the landed approval recorded.
- **Cleanup (Build Phase 5)** made the `<component>.<state>` naming rule one function, `componentOfStory`; there had been three copies. It also gave the two landed-rule tests one fixture.
- **The cold audit (Build Phase 6) found two more gaps.** 230 of 587 approvals record no components, so the Phase 4 fix still exempted those mockups whole; they are now held in full. And on a clean checkout, every mcp test that needs the built CLI skipped silently: turbo's `^build` builds a package's dependencies, never the package itself. A1, the only row for the contract-stdin promise, was one of them. `turbo.json` now builds indusk-mcp before its tests.

## Getting to Done

- I wrote Phase 6's rule item wrong: "absent, empty, or no landed approval at all". The last clause contradicted A8, the row asserting that a component named only by an unlanded plan's mockups is not reported. The subagent stopped when `looks coverage` reported `plan.master`'s `plan-looks` and `subplan-row`, which plan-stories has not built yet. I corrected the item, and the rule now has three cases.
- Two edits went through a script rather than the editor, so the impl hooks did not run on them. I ran the contract check and the structure hook by hand afterwards, and both passed.
- A subagent ran `biome check --write` with an unquoted variable and reformatted ten unrelated files. It reverted them, and I checked the phase's commits touched only its files.

## What We Learned

- **A test that `await import`s its subject inside an `it` pays the cold module load inside its timeout**, and under a root run that load alone can cross 5 s. Import at the top of the file.
- **A failing package hides every package after it** when turbo stops on the first failure. The mcp package's root-run timeouts had never been seen because the admin always failed first.
- **An exemption keyed to "the latest record" forgets what earlier records established.** The exemption has to be per item, and it needs evidence of what landed. Falsification and the audit each found a variant of this in the same twenty lines.
- **`describe.skipIf(missing build)` plus turbo's `^build` is a silent skip.** `^build` builds dependencies, not the package's own `dist/`, so a promise's only test can pass by never running.
- **The suite promise depends on the machine, not only the code.** The daemon guard fails the root run for any session's leftover daemon.

## What We'd Do Differently

- Diagnose a red root run with `turbo run test --continue`, so every package's failures show in the first run rather than one package at a time.
- Before writing a rule item that changes an exemption, re-read every existing row about that exemption. A8 already answered the case I wrote wrongly in Phase 6.
- Edit impl.md only through the editor, never a script, so the hooks always see the edit.

## Insights Worth Carrying Forward

- Falsification and the cold audit each found a correctness gap in code that Shape (8 reviews, 0 findings, 1 left-as-is) and its own tests had passed. That is not a Shape failure, since Shape judges craft, not correctness. It is evidence that the two close-out readers pay for themselves on a rule with several cases.

## Audits

- **Docs:** `reference/cli/looks.md`'s unimplemented-component row still described the Phase 2 rule; it is fixed in this retrospective. `component-conventions.md`, `reference/cli/promises.md` and the admin and mcp `CLAUDE.md` lines match the code.
- **Tests:** root `pnpm test` exit 0 at Build Phase 6, every package green and no leftover daemons.
- **Trajectory audit:** A1–A13 all `passing`; no deferred, blocked or non-terminal rows.
- **Quality:** the only recurring mistake was formatting, caught by `biome check`; no new rule is warranted. Shape: 8 reviews, 0 findings, 0 judged wrong by a person.
- **Context:** the root's "Landing installs, publishing is deliberate" convention left the root, since the retrospective skill's Steps 10–11 state it where it applies. `apps/indusk-mcp/CLAUDE.md` is over its 16 KB nested budget (19,479 bytes, 19,446 on main before this plan), so nothing moved into it. Compacting it is outstanding.
- **Open, not fixed here:** the daemon guard fails the root run on other sessions' leftovers, and admin browser tests still `await import` pages inside an `it`.
