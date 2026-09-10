import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { paper, planFolder } from "../__tests__/helpers/papers-fixture.js";
import { paperContentHash, parsePlan } from "./plan-parser.js";

/**
 * Papers in the plan parser (writing-skill A1, A3; A2 is deferred to Build
 * Phase 1 because it asserts on a field `PlanSummary` does not have yet).
 *
 * Authored red at Test Phase 1: today a folder of `kind: paper` documents
 * reports `stage: unknown` with next step "Create a brief", and a paper
 * carrying a status outside the vocabulary is not reported at all.
 */

describe("papers in the plan parser", () => {
	it("A1: a papers-only folder reports stage paper, a derived status, and a real next step", () => {
		const dir = planFolder({
			"paper-1.md": paper({ title: "One", status: "draft" }),
			"paper-2.md": paper({ title: "Two", status: "accepted" }),
		});

		const s = parsePlan(dir);
		expect(s.stage).toBe("paper");
		// Least-advanced paper wins: draft < accepted < published.
		expect(s.stageStatus).toBe("draft");
		expect(s.nextStep).not.toBe("Create a brief");
		expect(s.nextStep).toMatch(/paper-1\.md/);
	});

	it("A3: a paper with a status outside the vocabulary is reported malformed, never read as draft", () => {
		const dir = planFolder({
			"paper-1.md": paper({ title: "One", status: "finished" }),
		});

		const s = parsePlan(dir);
		expect(s.stage).toBe("paper");
		expect(s.stageStatus).toBe("malformed");
		expect(s.nextStep).toMatch(/paper-1\.md/);
		expect(s.nextStep).toMatch(/status/i);
	});

	it("A2: a plan with lifecycle docs and papers keeps its stage and lists the papers", () => {
		const dir = planFolder({
			"brief.md": { frontmatter: { title: "x", date: "2026-09-09", status: "accepted" }, body: "" },
			"paper-1.md": {
				frontmatter: { title: "One", date: "2026-09-09", status: "draft", kind: "paper" },
				body: "# One",
			},
		});

		const s = parsePlan(dir);
		expect(s.stage).toBe("brief");
		expect(s.papers).toEqual([{ file: "paper-1.md", title: "One", status: "draft", stale: false }]);
	});

	it("staleness is derived from the content hash, never stored", () => {
		const raw = matter.stringify("# One\n\nBody.\n", {
			title: "One",
			date: "2026-09-09",
			status: "published",
			kind: "paper",
		});
		const hash = paperContentHash(raw);
		expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
		// The hash ignores `status` and the `published` block, so writing them
		// back after a publish does not change what it hashes.
		const withBlock = matter.stringify("# One\n\nBody.\n", {
			title: "One",
			date: "2026-09-09",
			status: "accepted",
			kind: "paper",
			published: { destination: "blog", hash },
		});
		expect(paperContentHash(withBlock)).toBe(hash);

		const current = planFolder({
			"paper-1.md": {
				frontmatter: {
					title: "One",
					date: "2026-09-09",
					status: "published",
					kind: "paper",
					published: { destination: "blog", hash },
				},
				body: "# One\n\nBody.\n",
			},
		});
		expect(parsePlan(current).papers?.[0]?.stale).toBe(false);

		const edited = planFolder({
			"paper-1.md": {
				frontmatter: {
					title: "One",
					date: "2026-09-09",
					status: "published",
					kind: "paper",
					published: { destination: "blog", hash },
				},
				body: "# One\n\nBody, revised.\n",
			},
		});
		expect(parsePlan(edited).papers?.[0]?.stale).toBe(true);

		// Published by hand with no record: cannot be confirmed current, so stale.
		const unrecorded = planFolder({
			"paper-1.md": {
				frontmatter: { title: "One", date: "2026-09-09", status: "published", kind: "paper" },
				body: "# One\n",
			},
		});
		expect(parsePlan(unrecorded).papers?.[0]?.stale).toBe(true);
	});
});
