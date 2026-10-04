import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * watcher-heartbeat — A15 (cleanup).
 *
 * "When was this promise last seen" — the newest mark, upheld or violated —
 * was spelled three times by the end of this plan: `promise_health`'s
 * `lastSeen`, the admin's `healthOf`, and the `expect_every` judgment this plan
 * added. Three readers that must agree, each with its own copy, is how one of
 * them comes to report a promise silent while another shows it seen. One
 * `newestMark` in `promises/telemetry.ts`; every reader imports it.
 */

const ROOTS = ["apps/indusk-mcp/src", "apps/indusk-admin/src"];
const IGNORE = ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**", "**/*.test-support.ts"];
/** The expression that picks a promise's newest mark from its marks. */
const NEWEST_SPELLING = /lastUpheld\?\.at\]/g;

function occurrences(): { file: string; count: number }[] {
	const found: { file: string; count: number }[] = [];
	for (const root of ROOTS) {
		for (const file of globSync("**/*.{ts,tsx}", { cwd: join(REPO_ROOT, root), ignore: IGNORE })) {
			const count = (
				readFileSync(join(REPO_ROOT, root, file), "utf-8").match(NEWEST_SPELLING) ?? []
			).length;
			if (count > 0) found.push({ file: `${root}/${file}`, count });
		}
	}
	return found;
}

describe("A15 — one newest-mark rule", () => {
	it("the newest mark is computed only in newestMark, in promises/telemetry.ts", () => {
		const found = occurrences();
		expect(
			found,
			`lesson: structural-single-definition-test-for-must-agree-invariants — "last seen" has one home; found in ${found.map((f) => `${f.file}×${f.count}`).join(", ")}`,
		).toEqual([{ file: "apps/indusk-mcp/src/lib/promises/telemetry.ts", count: 1 }]);
	});

	it("newestMark is exported from promises/telemetry", () => {
		const source = readFileSync(
			join(REPO_ROOT, "apps/indusk-mcp/src/lib/promises/telemetry.ts"),
			"utf-8",
		);
		expect(source).toMatch(/export function newestMark\(/);
	});
});
