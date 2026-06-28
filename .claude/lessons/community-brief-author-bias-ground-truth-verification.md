# Ground-truth-verify every "X already works" claim in a brief before acceptance

# Ground-truth-verify every "X already works" claim in a brief before acceptance

Brief author bias is the most expensive bug class in plan authoring. When the brief asserts that some existing code does X, the author tends to read the source looking for *confirmation* of the design intent rather than ground truth — and confirmation-shaped reading misses what the code actually does.

## What goes wrong

In `git-or-jj-substrate`'s brief, three claims were made about `eval-trigger.js`:

1. *"It tries jj first and falls back to git rev-parse HEAD for the change ID"*
2. *"It matches both `jj describe` and `git commit` as trigger commands"*
3. (Implicit) *"It's installed correctly by `indusk init`"*

All three were wrong:
1. The change-ID extractor used `jj log` with no git fallback.
2. The filter rejected `git commit`.
3. `init.ts` had a hardcoded `hookFiles` array that omitted `eval-trigger.js`.

Each claim looked plausible to the brief author because the *design intent* was that the hook should support both SCMs. The actual code didn't match the intent. The bug shipped to Phase 6 falsification, costing ~4 hours of investigation + fix work.

## The discipline

A brief is not accepted until every "X already works" or "X currently does Y" claim is annotated with one of:

- A source-code line range (`apps/foo/bar.ts:45-58`)
- A quoted snippet
- A test name that asserts the claim

Reading source code while writing a brief is a different operation than reading it during impl: the brief author is biased toward confirming the plan, and confirmation-shaped reading is structurally lossy.

## Cost-benefit

- Verification at brief time: ~20 minutes per claim
- Investigation cost when the claim turns out to be wrong: ~4 hours per claim
- Ratio: ~12×

The same pattern applies to:
- Briefs that assert what existing tests cover (often wrong; tests aren't read carefully)
- Briefs that assert how hooks/middleware/extensions behave (often based on documentation, not source)
- Briefs that assert what a config file does (often based on default values, not actual codepath behavior)

## How to apply

When reviewing or writing a brief, find every "X already works / X currently does Y / X is configured to Z" sentence. For each: either annotate with a source pointer, or rewrite as a question for impl phase 0 to resolve. Don't accept the brief until every assertion is either source-pointed or testable.

If the brief was authored before you noticed this, the cheapest recovery is a 30-minute "annotate-or-question" pass before impl starts.

