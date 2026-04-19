# Falsification fixtures must be minimal — any rule firing before the target obscures signal

# Falsification fixtures must be minimal

When writing a test for a `/falsify` hypothesis, the fixture must be *just barely* well-formed enough that the targeted validator rule is the only thing that can fail. Any rule that fires before yours will obscure the test signal — you'll see a failure for the wrong reason and either chase a phantom or, worse, declare your hypothesis confirmed when it wasn't.

## What goes wrong

Surfaced during `/falsify rationale-baseline-frontmatter`. The first version of the substring-attack fixture used a `feature` workflow without OTel/Context/Document gate sections. Result:

```
Impl structure incomplete (workflow: feature, policy: ask):
Phase 1 (Start) is missing: OTel, Context, Document
```

The structural-completeness check (a different validator rule entirely) fired *before* the rationale-completeness check could run. The hook exited 2, but for the wrong reason. Had the test only checked `exitCode === 2` without looking at stderr, the hypothesis would have appeared confirmed when in fact the rationale rule never fired at all.

## The lesson

Craft falsification fixtures with a minimum-viable-impl pattern:

- **Workflow:** pick the workflow with the fewest required gates (`bugfix` typically — only Verification + Document; no OTel, no Context).
- **Required sections:** include exactly the gate sections the chosen workflow demands, with one minimal `- [ ]` item each.
- **Trajectory rows:** the smallest set that exercises the target rule. Often just one row.
- **Reasonable defaults for everything else** (`gate_policy: ask`, etc.) so unrelated checks don't fire.

The fixture is *not* the unit under test. The validator is. Anything in the fixture beyond what the targeted rule requires is dead weight that can mask the signal.

## When asserting

Don't trust exit code alone. Always assert what the stderr contains — the specific rule name (`rationale-completeness`, `temporal-coherence`, etc.) — so you know which rule actually fired. A test that says `expect(exitCode).toBe(2)` is not a falsification test; it's a "something went wrong" test.

```ts
expect(exitCode, `stderr was: ${stderr}`).toBe(2);
expect(stderr).toContain("rationale-completeness");  // <-- the load-bearing line
```

## Generalization

This applies to any layered validation system where multiple rules can reject the same input. SQL parsers, type checkers, schema validators, linting pipelines. If your test fixture has more shape than your hypothesis requires, you're testing whatever fires first — not necessarily what you meant to test.
