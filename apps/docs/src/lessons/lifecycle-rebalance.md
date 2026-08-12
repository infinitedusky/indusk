# Lessons from lifecycle-rebalance

Nine phases against a plan that budgeted four. The five extra phases are the content — each one exists because something the gates could not see turned out to be true.

## Tested is not reachable

After six phases and 41 passing tests, **the feature had never executed once.** `lib/shape/` was absent from `package.json` `exports`, so no consumer could import it. The documented phase-start command invoked a bare `tsx` that is not on `PATH`, with a top-level `await` that `tsx -e` does not support. And no boundary record existed, so the entry point had never been called outside a fixture.

Every gate passed the entire time, because the gates check the code and the code was fine. What was missing was the path from a user to the code — and **no test could see it**, because all 41 imported the source directly.

Two lessons already in the registry covered this (`point-the-tool-at-itself-before-calling-it-done`, `consumer-reachability-before-publish`) and neither fired. That suggests the gap is structural rather than a knowledge problem: green tests feel like completion, and nothing in the loop asks "can anyone reach this?"

**What to do instead:** declare the export in the same commit as the first library file, and paste the documented command and run it *verbatim* before writing it down. Nothing in a normal repo executes a command that lives in a skill or a README, so a broken instruction ships green forever.

## A ritual never sees the phase it authored

`/cleanup` authored Phase 6, whose execution created two new modules no cleanup pass had reviewed. `/falsify` covered Phases 1–4; Phase 7 then shipped new exports, a new tracked artifact and two new test files no falsification had hunted.

Running each ritual a second time found **five more confirmed defects and two more duplications** — including one that had already diverged and a regression that silently disabled phantom detection.

The readiness gate does not catch this: it asks whether a terminal Falsification Phase and Cleanup Phase *exist*. Both did. Neither had seen the plan's most recent five phases. **The gate proves a ritual ran, never that it ran over everything.**

## "Already diverged" is the strongest argument a duplication rule can have

The second cleanup pass found that the two structural-test files each carried a copy of the source-scanning helper — and the copies had **already drifted within hours**, in the two files whose entire purpose is asserting that things have exactly one definition.

No behavioral test can catch a divergence that has not happened yet. That is why these invariants are pinned with tests asserting *exactly one definition exists*, and why the argument for that instrument is so much stronger after you have watched it happen.

## Every silent failure mode should lean the same way

Falsification found five defects in the review scope, and all five failed by **under**-reporting — a resumed phase dropping earlier work, deleted paths counted as reviewable, untracked files from earlier phases attributed to this one. Under-reporting is indistinguishable from the check working correctly.

So every fallback now leans toward over-reporting: an unreadable stat keeps the file, an unparseable timestamp falls back to the epoch. **Over-reporting costs a re-read; under-reporting loses work while still reporting success.** Only one of those is recoverable.

## A number outlives the caveat that qualifies it

The first calibration data point is "2 findings, 0 judged wrong." Left bare in a table, that reads as evidence the judgment is calibrated. It is not: author, reviewer and judge were the same agent, on diffs written minutes earlier, and only one of the two findings came from a live per-phase run.

The caveat is now recorded in the same table cell as the number, because a figure copied forward without its qualification becomes a claim nobody checks.

## Fix the flaky test, do not file it

Three tests in this plan failed on vitest's 5s default while doing real subprocess work. One surfaced as a *new* failure during a late full-suite run, in a file the plan never touched.

A flaky test in the verification path is worse than a reliably red one: it invalidates every "suite green" claim built on top of it — including the ones this plan had been making for several phases. Fixed rather than recorded as known-red.

## See also

- [The Shape check](/guide/shape)
- [Decision: lifecycle-rebalance](/decisions/lifecycle-rebalance)
