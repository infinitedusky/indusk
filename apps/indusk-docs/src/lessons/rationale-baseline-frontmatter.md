# Rationale Baseline Frontmatter — Lessons

Plan archive: `.indusk/planning/archive/rationale-baseline-frontmatter/`. Shipped in indusk-mcp 1.25.0 (feature) and 1.25.1 (`/falsify` fix-in-scope) on 2026-04-19. Both publishes within ~30 minutes of each other.

## What we learned

### Regex shape risk depends on what the value carries, not the key

When parsing a frontmatter key with a regex, the right anchor depends on what kind of value the key carries — not on what the sibling regexes in the same file do.

**Presence/enum keys** (e.g., `gate_policy: strict|ask|auto`, `trajectory: required`, `workflow: bugfix|refactor|feature|spike`) can get away with unanchored substring matches because the value space is bounded. For a false positive to fire, a quoted YAML value would have to contain the *exact* enum literal — vanishingly low.

**Value-bearing keys** (e.g., `rationale_baseline: \d+`) MUST be line-anchored. The regex `\d+` matches any digit sequence anywhere in the frontmatter. A `title:` value mentioning the key by name (e.g., `title: "Documenting rationale_baseline: 1 semantics"`) silently passes the integer to the parser.

This was 1.25.0's bug:

```js
// Vulnerable: matches anywhere in frontmatter
const m = frontmatter.match(/rationale_baseline:\s*(\d+)/);

// Fixed in 1.25.1: requires the key at start-of-line (i.e., a top-level YAML key)
const m = frontmatter.match(/^rationale_baseline:\s*(\d+)/m);
```

The author (me) mirrored the existing file's pattern without distinguishing that the siblings are presence/enum checks where false-positive risk is structurally low. Different parse semantics, same regex shape, very different risk profile. When introducing a new value-bearing key into a file with established but limited regex conventions, anchor your regex even if the siblings aren't anchored — the precedent is wrong for this case.

### The falsification ritual's value is highest immediately after authoring

Phase 4 of this plan caught a real, shipped-to-npm bug ten minutes after the publish that introduced it. The cheat-sheet effect (author has fresh memory of the code, may unconsciously avoid testing the things they'd be embarrassed to have missed) is real — but the cost of *delaying* the ritual is higher: cold context, lost intuition about where the seams are, weaker connection between the hypothesis and the just-authored implementation.

The pattern complements [`eval-scorecard-format-fix`](./eval-scorecard-format-fix.md)'s identification of the cheat-sheet effect — same-session ritual catches the bugs that the next-day ritual would miss because the author no longer remembers which decisions were arbitrary vs. load-bearing.

Run `/falsify` on the same session as the impl-complete moment whenever possible. Pay the cheat-sheet tax to capture the same-session bugs.

### Falsification fixtures must be MINIMAL

The first version of the substring-attack fixture used a `feature` workflow without OTel/Context/Document gate sections. The structural-completeness check fired *before* the rationale-completeness check could run — masking the actual hypothesis. Had the test only checked `exitCode === 2` without looking at stderr, the hypothesis would have appeared confirmed when in fact the rationale rule never fired.

Craft falsification fixtures with a minimum-viable-impl pattern:
- Pick the workflow with the fewest required gates (`bugfix` typically).
- Include exactly the gate sections that workflow demands, with one minimal `- [ ]` item each.
- Use the smallest set of trajectory rows that exercises the target rule.
- Always assert stderr contains the specific rule name (`rationale-completeness`, `temporal-coherence`, etc.) — not just that exit code is 2.

The fixture is *not* the unit under test. The validator is. Anything in the fixture beyond what the targeted rule requires is dead weight that can mask the signal. This applies to any layered validation system where multiple rules can reject the same input.

### TS↔JS parity tests via subprocess are cheap and load-bearing

The CLAUDE.md gotcha already named JS-port-mirrors-TS as a known risk. This plan operationalized parity coverage concretely for the first time:

```ts
// Shared fixture set. For each fixture:
//   - run TS validator directly (in-process)
//   - spawn JS hook as subprocess with synthetic Edit/Write event
//   - compare pass/fail decisions
```

~50 lines of test for production-grade parity coverage of two implementations that mirror each other manually. The pattern is reusable for any future TS-source-with-JS-port mirror in this codebase. Crucially, the subprocess invocation exercises the *actual* hook execution path (including frontmatter parsing) — not a unit of the JS port's internals.

## What we'd do differently

### Anchor the regex on first authorship

Knew it was a substring match, mirrored the file's existing pattern, didn't notice the integer-value distinction. Pre-emptively distinguish between presence-check parsing and value-extraction parsing when adding to a file with established regex conventions.

### Keep the State column pure

`check-gates.js` validates the Trajectory State cell against an exact-match enum (`planned | writable | written | passing | skipped | blocked | unknown`). Inline reason text after a hyphen breaks parsing. Put rationale in `Asserts` (or a new dedicated column), keep `State` to the bare keyword.

### Document the umbrella when adding a sub-key

This plan's docs-phase bumped the validator-rule count in the trajectory guide from four to five — because adding the `rationale_baseline` sub-key surfaced that the parent `rationale: required` opt-in was previously unmentioned. When documenting a new configuration option that opts into an existing feature, check whether the existing feature is itself well-documented.

## Why this matters

This plan was technically tiny (~30 lines of source code change across two implementations) but produced four lessons that generalize to any regex-based parsing, any layered validator, any TS-source-with-JS-port mirror, and any falsification ritual run by the author of the code. The size of the lesson harvest is uncorrelated with the size of the change. Every plan with a falsification round is an opportunity to capture cross-project knowledge — not just the impl's specific story.
