import { describe, expect, it } from "vitest";

/**
 * Falsification bounty for bug-fix-eval-agent.
 *
 * Hypothesis: the existing regression test at
 * `falsification-hook-esm-require.test.ts` uses the regex `/require\("fs"\)/`
 * which is narrow — it catches only the exact double-quoted CJS-require
 * pattern. Someone reintroducing the bug via `require('fs')` with single
 * quotes, `` require(`fs`) `` with backticks, or `const f = require; f("fs")`
 * with aliasing would slip past the regression guard.
 *
 * The plan's T3 claims "the test fails on the pre-fix code" — true for the
 * specific pre-fix pattern. But it's a weaker guarantee than "the test
 * catches the bug CLASS." The author's happy path wrote the test against
 * the exact observed failure; the bounty here is that the guard is narrower
 * than the invariant it protects.
 *
 * This test confirms the gap by checking which variants the current regex
 * would reject. A complete regression guard would reject all of them.
 */

// Mirror the regex shape used in falsification-hook-esm-require.test.ts.
// Post-Phase 4 broadening: covers all CJS require() shapes for fs/path —
// single/double/backtick quotes, optional whitespace, optional node: prefix.
// If the original test's regex changes further, update this mirror.
const EXISTING_REGRESSION_REGEX_FS = /require\s*\(\s*['"`](?:node:)?fs['"`]\s*\)/;
const EXISTING_REGRESSION_REGEX_PATH = /require\s*\(\s*['"`](?:node:)?path['"`]\s*\)/;

// Semantic-equivalent regressions that a malicious edit (or innocent
// refactor) could introduce, all of which would re-break the hook with
// the same ReferenceError as the original bug. The broadened regex
// (Phase 4 of this plan) must catch all of these.
//
// Intentionally NOT included: `const r = require; const fs = r("fs");`
// (aliased). A static regex can't reasonably catch arbitrary indirection
// — catching the straightforward forms is the 99% case.
const SEMANTICALLY_EQUIVALENT_BUG_VARIANTS = [
	`const fs = require('fs');`, // single quotes
	`const fs = require(\`fs\`);`, // backticks
	`const fs = require ("fs");`, // whitespace before paren
	`const fs = require(  "fs"  );`, // whitespace inside parens
	`const fs = require('node:fs');`, // with node: prefix
	`const path = require("path");`, // the companion path require
];

describe("falsification: regression regex catches only the exact double-quoted variant — narrower than the invariant", () => {
	for (const snippet of SEMANTICALLY_EQUIVALENT_BUG_VARIANTS) {
		it(`catches semantic-equivalent: ${snippet.slice(0, 50)}...`, () => {
			const matchesFs =
				EXISTING_REGRESSION_REGEX_FS.test(snippet) || EXISTING_REGRESSION_REGEX_PATH.test(snippet);
			// The hypothesis: these variants should all be caught by a complete
			// regression guard. If any variant evades the regex, the guard is
			// broken and we have our bounty.
			expect(matchesFs).toBe(true);
		});
	}
});
