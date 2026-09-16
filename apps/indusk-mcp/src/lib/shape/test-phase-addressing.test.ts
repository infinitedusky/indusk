import { describe, expect, it } from "vitest";
import { recordPhaseStart } from "./boundary.js";
import { blockLines, findHeadingIndex } from "./impl-blocks.js";
import { prepareShapeReview, recordReviewedNothingFound } from "./shape.js";
import { commitAll, git, makeRepo, trackedRoots, writeFixtureFile } from "./shape.test-support.js";

/**
 * admin-ui-phase-progress — A18.
 *
 * Every Shape function took a bare `phase: number` and resolved headings that
 * deliberately did not match `### Test Phase N`, so a test phase — the phase
 * that authors ten test files — could not be reviewed or recorded against.
 * Worse, the existence guard compared numbers only, so a test-phase-only impl
 * passed the guard and then failed the gate lookup, reading as "not green"
 * rather than "no such phase" (`shape-cannot-see-test-phases`). Addressed as
 * `{ kind: "test", number: 1 }` the review runs and the note lands under the
 * test phase's own heading, not Build Phase 1's.
 */

const TWO_SEQUENCE_IMPL = [
	"---",
	'title: "Fixture"',
	"status: in-progress",
	"---",
	"",
	"## Checklist",
	"",
	"### Test Phase 1: Author red",
	"",
	"- [x] author everything",
	"",
	"#### Test Phase 1 Verification",
	"",
	"- [x] A1 red on its own assertion",
	"",
	"#### Test Phase 1 Context",
	"",
	"- [x] (none needed)",
	"",
	"#### Test Phase 1 Document",
	"",
	"- [x] (none needed)",
	"",
	"### Build Phase 1: Build it",
	"",
	"- [ ] build the thing",
	"",
	"#### Build Phase 1 Verification",
	"",
	"- [ ] A1 passes",
	"",
	"#### Build Phase 1 Context",
	"",
	"- [ ] a line",
	"",
	"#### Build Phase 1 Document",
	"",
	"- [ ] a page",
	"",
].join("\n");

function block(body: string, heading: RegExp): string[] {
	const lines = body.split("\n");
	const at = findHeadingIndex(lines, heading);
	if (at === -1) throw new Error(`no heading ${heading}`);
	return blockLines(lines, at);
}

describe("A18 — a Test Phase can be Shape-reviewed and recorded against", () => {
	const roots = trackedRoots();

	it("prepareShapeReview for { kind: 'test', number: 1 } returns the review, not a skip", async () => {
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, {
			plan: "p",
			phase: 1,
			kind: "test",
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-09-16T00:00:00.000Z",
		});
		await writeFixtureFile(root, "src/a.test.ts", "export const a = 1;\n");
		await commitAll(root, "author a test");

		const outcome = await prepareShapeReview({
			root,
			plan: "p",
			phase: { kind: "test", number: 1 },
			implBody: TWO_SEQUENCE_IMPL,
		});
		expect(outcome.kind, JSON.stringify(outcome)).toBe("review");
		if (outcome.kind === "review") expect(outcome.files).toContain("src/a.test.ts");
	});

	it("the same impl, addressed as Build Phase 1, is not green — the two phases are not confused", async () => {
		const root = await makeRepo();
		roots.push(root);
		await recordPhaseStart(root, {
			plan: "p",
			phase: 1,
			sha: await git(root, "rev-parse", "HEAD"),
			at: "2026-09-16T00:00:00.000Z",
		});
		const outcome = await prepareShapeReview({
			root,
			plan: "p",
			phase: { kind: "build", number: 1 },
			implBody: TWO_SEQUENCE_IMPL,
		});
		expect(outcome.kind).toBe("skipped");
	});

	it("recordReviewedNothingFound lands under ### Test Phase 1, not under ### Build Phase 1", () => {
		const after = recordReviewedNothingFound(TWO_SEQUENCE_IMPL, { kind: "test", number: 1 });
		const testBlock = block(after, /^###\s+Test\s+Phase\s+1\b/);
		const buildBlock = block(after, /^###\s+Build\s+Phase\s+1\b/);
		expect(testBlock.join("\n")).toContain("Shape — reviewed");
		expect(buildBlock.join("\n")).not.toContain("Shape — reviewed");
	});
});
