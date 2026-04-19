# Anchor frontmatter regexes when the key is value-bearing

# Anchor frontmatter regexes when the key is value-bearing

When parsing a frontmatter key with a regex, the right anchor depends on what kind of value the key carries — not on what the sibling regexes in the same file do.

## The pattern

**Presence/enum keys** (e.g., `gate_policy: strict|ask|auto`, `trajectory: required`, `workflow: bugfix|refactor|feature|spike`) can get away with unanchored substring matches because the value space is bounded. For a false positive to fire, a quoted YAML value would have to contain the *exact* enum literal — vanishingly low.

**Value-bearing keys** (e.g., `rationale_baseline: \d+`, `version: \d+`, `timeout_ms: \d+`) MUST be line-anchored. The regex `\d+` matches any digit sequence anywhere in the frontmatter. A `title:` value mentioning the key by name (e.g., `title: "Documenting rationale_baseline: 1 semantics"`) silently passes the integer to the parser.

## What goes wrong without the anchor

Surfaced via `/falsify` against `rationale-baseline-frontmatter` (indusk-mcp 1.25.0 → 1.25.1):

```js
// Vulnerable: matches anywhere in frontmatter
const m = frontmatter.match(/rationale_baseline:\s*(\d+)/);

// Fixed: requires the key at the start of a line (i.e., a top-level YAML key)
const m = frontmatter.match(/^rationale_baseline:\s*(\d+)/m);
```

A documentation plan whose title contained the literal `rationale_baseline: 1` silently inherited that baseline from string content — never having set the YAML field. A Phase-1 row that should have required rationale silently passed.

## The lesson

When introducing a new value-bearing key into a file with existing pattern-match parsing, anchor your regex even if the siblings aren't anchored. The precedent is wrong for this case. Different parse semantics, same regex shape, different risk profile.

Use `/^key:.../m` for value-bearing keys. The `m` flag makes `^` match start-of-line, so the key must appear as a top-level YAML key (column 0), not as a substring inside a quoted value.

## When this comes up

Any time you're adding a new frontmatter key, settings field, or env-var-like config that takes a value (integer, identifier, path, URL — anything regex-extractable). Check whether the existing parser pattern in the file is anchored. If not, anchor yours anyway — and consider whether the sibling unanchored ones should be fixed too (often they're enum/presence checks that are technically vulnerable but unlikely to trip in practice; document the asymmetry).
