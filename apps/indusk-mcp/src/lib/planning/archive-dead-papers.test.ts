import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeDocs } from "../../__tests__/helpers/papers-fixture.js";
import { classifyPlans } from "./archive-dead.js";

/**
 * A29 (writing-skill falsification): `archive-dead` and the status word this
 * plan introduced. A plan carrying a published paper is not a dead draft —
 * archiving it moves the source the hotfix path publishes from. `published`
 * was never registered with the blocking set, the one detector keyed on
 * status words. Authored red against today's set.
 */

const ninetyDaysOn = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

describe("archive-dead and published papers", () => {
	it("A29: a plan with a published paper is never a dead-draft candidate, regardless of age", () => {
		const root = mkdtempSync(join(tmpdir(), "archive-dead-papers-"));
		writeDocs(join(root, ".indusk/planning/essays"), {
			"paper-1.md": {
				frontmatter: {
					title: "One",
					date: "2026-09-09",
					status: "published",
					kind: "paper",
					published: {
						destination: "blog",
						path: "writing/one.md",
						commit: "abc1234",
						source_commit: "def45678",
						hash: "sha256:00",
					},
				},
				body: "# One\n",
			},
			"paper-2.md": {
				frontmatter: { title: "Two", date: "2026-09-09", status: "draft", kind: "paper" },
				body: "# Two\n",
			},
		});

		const { candidates, skipped } = classifyPlans(root, { days: 30, now: ninetyDaysOn() });
		expect(candidates.map((c) => c.name)).not.toContain("essays");
		expect(skipped.find((s) => s.name === "essays")?.reason).toMatch(/published/);
	});

	it("a plan whose papers are all drafts is still a dead draft once the window passes", () => {
		const root = mkdtempSync(join(tmpdir(), "archive-dead-papers-"));
		writeDocs(join(root, ".indusk/planning/essays"), {
			"paper-1.md": {
				frontmatter: { title: "One", date: "2026-09-09", status: "draft", kind: "paper" },
				body: "# One\n",
			},
		});

		const { candidates } = classifyPlans(root, { days: 30, now: ninetyDaysOn() });
		expect(candidates.map((c) => c.name)).toContain("essays");
	});
});
