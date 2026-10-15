# A guard test that reads prose must be run against a reworded violation — an exemption word like "not" in the filter lets the claim through

The docs guard in browser-template-claims (otel-docs-claims.test.ts) first exempted any sentence containing "no", "not" or "never", so "A request from a .then() chain follows the click, not only synchronous ones" passed. A prose guard's keyword filter and its exemptions are both heuristics; the exemption must be as narrow as the phrase that actually states the limit ("its own trace", "not in the click's"), and the test must carry at least one reworded violation that must be flagged plus the current correct wording that must pass.

How to apply: for any test that scans documentation sentences, author the red case as a rewording of the false claim before the guard is written, and name the exemption as a constant with a stated meaning.

See: .indusk/planning/archive/browser-template-claims/retrospective.md (T7).
