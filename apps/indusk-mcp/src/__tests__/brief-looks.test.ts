import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBriefContract } from "../lib/promises/brief-contract.js";
import { checkAllContracts } from "../lib/promises/contract.js";
import type { Registry } from "../lib/promises/registry.js";
import {
	type BriefAppProject,
	briefAppProject,
	briefOf,
	implOf,
	PLAN,
	PLAN_DIR,
} from "./helpers/brief-app.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { approveWithReview } from "./helpers/plan-review-fixture.js";

/**
 * promise: a-brief-lists-its-looks — brief-as-the-contract A1, A3, and the
 * guards A2 and A22 (a brief that says why it has no looks, or was written
 * before the section, is still approved when its plan touches no interface;
 * A22 is a regression guard over every plan already written).
 *
 * A brief lists the looks it makes, changes, replaces or must not break, or
 * says why it has none, and a plan that changes files under an app's interface
 * with none listed is refused at approval. Through `indusk plans approve` over
 * the `brief-app` fixture, and through the one reader of a brief's contract.
 */

let app: BriefAppProject;
beforeEach(() => {
	app = briefAppProject("brief-looks");
});
afterEach(() => app.cleanup());

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

describe.skipIf(SHOULD_SKIP)("the Looks section at approval", () => {
	it("A1 a plan that changes files under an app's interface, with no look and no reason, is refused naming what is missing", () => {
		app.writePlan({ brief: "legacy", impl: "interface" });
		const before = app.project.mainSha();

		const r = approveWithReview(app.trunk, PLAN, join(app.wt, PLAN_DIR));

		expect(r.code, out(r)).not.toBe(0);
		expect(out(r)).toContain("src/Card.jsx");
		expect(out(r)).toMatch(/looks?/i);
		expect(app.project.mainSha()).toBe(before);
	});

	it("A2 a brief that says why it has no looks is approved when its plan changes nothing under an app's interface", () => {
		app.writePlan({ brief: "none", impl: "internal" });
		const r = approveWithReview(app.trunk, PLAN, join(app.wt, PLAN_DIR));
		expect(r.code, out(r)).toBe(0);
	});

	it("A22 a brief written before the Looks section is approved when its plan changes nothing under an app's interface", () => {
		app.writePlan({ brief: "legacy", impl: "internal" });
		const r = approveWithReview(app.trunk, PLAN, join(app.wt, PLAN_DIR));
		expect(r.code, out(r)).toBe(0);
	});
});

describe.skipIf(SHOULD_SKIP)("a Files Affected cell is read path by path", () => {
	// promise: a-brief-lists-its-looks
	const cells = [
		["a path with a note after it", "`src/Card.jsx` (new parts)"],
		["two paths separated by a comma", "`lib/hold-timer.ts`, `src/Card.jsx`"],
		["two paths joined by and", "`lib/hold-timer.ts` and `src/Card.jsx`"],
	] as const;
	for (const [label, cell] of cells) {
		it(`A34 ${label} is refused at approval when one of them is under an app's interface`, () => {
			app.writePlan({
				brief: "legacy",
				impl: implOf("interface").replace("| `src/Card.jsx` |", `| ${cell} |`),
			});
			const before = app.project.mainSha();

			const r = approveWithReview(app.trunk, PLAN, join(app.wt, PLAN_DIR));

			expect(r.code, out(r)).not.toBe(0);
			expect(out(r)).toContain("src/Card.jsx");
			expect(app.project.mainSha()).toBe(before);
		});
	}
});

describe("A3 a look is read as the list it is under", () => {
	it("makes, must-not-break, changes and replaces each come back as what the brief put them under", () => {
		const parsed = parseBriefContract(briefOf("looks-listed"));

		expect(parsed.shape).toBe("contract");
		expect(parsed).toHaveProperty("looks");
		expect((parsed as { looks?: unknown }).looks).toMatchObject({
			makes: [{ name: "home.full" }],
			mustNotBreak: ["home.empty"],
			changes: [{ name: "detail.default" }],
			replaces: [{ old: "badge.old", by: "badge.ok" }],
		});
	});
});

describe.skipIf(SHOULD_SKIP)("A37 the Looks rule is held at approval, not after it", () => {
	const refusals = () =>
		checkAllContracts(app.wt, { registry: { promises: [] } as unknown as Registry })
			.refusals.map((r) => r.message)
			.join("\n");

	it("an approved plan whose brief predates the Looks section is not refused by the registry check; the same plan as a draft is", () => {
		app.writePlan({
			brief: "legacy",
			impl: implOf("interface").replace("status: draft", "status: approved"),
		});
		expect(refusals()).not.toContain("src/Card.jsx");

		app.writePlan({ brief: "legacy", impl: "interface" });
		expect(refusals()).toContain("src/Card.jsx");
	});
});
