import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type BriefAppProject, briefAppProject, PLAN } from "./helpers/brief-app.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: a-brief-lists-its-looks — the second moment of the check
 * (brief-as-the-contract ADR D2). Approval reads what the impl says it will
 * change; `plans accept` reads what the branch changed. A plan whose brief
 * says `None` for its looks, but whose branch changed a file under an app's
 * interface, is refused naming the file, and the refusal names the amendment.
 */

let app: BriefAppProject;
beforeEach(() => {
	app = briefAppProject("accept-looks");
});
afterEach(() => app.cleanup());

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

describe.skipIf(SHOULD_SKIP)("plans accept over the branch's diff", () => {
	it("refuses a brief that says None when the branch changed a file under the interface", () => {
		app.writePlan({ brief: "none", impl: "internal" });
		expect(runCli(app.trunk, ["plans", "approve", PLAN]).code).toBe(0);
		app.project.commit(app.wt, { "src/Card.jsx": "export const Card = () => null;\n" }, "build");

		const r = runCli(app.trunk, ["plans", "accept", PLAN]);

		expect(r.code, out(r)).not.toBe(0);
		expect(out(r)).toContain("src/Card.jsx");
		expect(out(r)).toMatch(/amend/i);
	});

	it("accepts when the branch changed nothing under the interface", () => {
		app.writePlan({ brief: "none", impl: "internal" });
		expect(runCli(app.trunk, ["plans", "approve", PLAN]).code).toBe(0);
		app.project.commit(app.wt, { "notes.txt": "n\n" }, "build");

		const r = runCli(app.trunk, ["plans", "accept", PLAN]);

		expect(r.code, out(r)).toBe(0);
	});
});
