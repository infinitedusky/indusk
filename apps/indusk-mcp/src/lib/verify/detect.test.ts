import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runVerify } from "./verify.js";
import {
	buildImpl,
	commitAll,
	makeVerifyFixture,
	writeFixtureFile,
} from "./verify.test-support.js";

/**
 * A1–A3 (dawn-verify) — the three detections with existing machinery.
 *
 * A1 and A3 reuse `probePhaseClose` and `checkGoalposts` unchanged. A2 does
 * NOT come free from the probe: the probe asks "may the NEXT phase advance?",
 * and it deliberately neutralizes rows writable at that next phase, so the
 * verified phase's own test-first duty is invisible to it. Verify applies
 * Gate A's rule to phase N itself.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe("A1 — premature checkoff", () => {
	it("rejects, naming the unchecked gate item and the phase it belongs to", async () => {
		const impl = buildImpl({
			rows: [
				{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
			],
			phases: [
				{
					n: 1,
					name: "Parse",
					items: [[true, "add the parser"]],
					verification: [[false, "A1 passes (pnpm test)"]],
				},
				{ n: 2, name: "Render", items: [[true, "add the renderer"]] },
			],
		});
		const fixture = await makeVerifyFixture({ impl });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 2 });

		expect(report.verdict).toBe("rejected");
		const finding = report.findings.find((f) => f.kind === "premature-checkoff");
		expect(finding).toBeDefined();
		expect(finding?.message).toContain("A1 passes");
		expect(finding?.message).toMatch(/Phase 1/);
	});
});

describe("A2 — the test-first duty was skipped", () => {
	it("rejects, naming the row still planned at the phase where it was writable", async () => {
		const impl = buildImpl({
			rows: [
				{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
				{ id: "A2", asserts: "the widget renders", writableAt: 1, passesAt: 3, state: "planned" },
			],
			phases: [
				{
					n: 1,
					name: "Parse",
					items: [[true, "add the parser"]],
					verification: [[true, "A1 passes"]],
				},
			],
		});
		const fixture = await makeVerifyFixture({ impl });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.verdict).toBe("rejected");
		const finding = report.findings.find((f) => f.kind === "test-first");
		expect(finding).toBeDefined();
		expect(finding?.row).toBe("A2");
		expect(finding?.message).toMatch(/planned/);
	});

	it("stays silent when the row was authored red before the phase closed", async () => {
		const impl = buildImpl({
			rows: [
				{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
				{ id: "A2", asserts: "the widget renders", writableAt: 1, passesAt: 3, state: "written" },
			],
			phases: [
				{
					n: 1,
					name: "Parse",
					items: [[true, "add the parser"]],
					verification: [[true, "A1 passes"]],
				},
			],
		});
		const fixture = await makeVerifyFixture({ impl });
		roots.push(fixture.root);

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "test-first")).toEqual([]);
	});
});

describe("A3 — goalpost drift since the baseline", () => {
	it("rejects, showing both the previous and the current assertion text", async () => {
		const original = buildImpl({
			rows: [
				{
					id: "A1",
					asserts: "rejects a malformed version string",
					writableAt: 1,
					passesAt: 1,
					state: "written",
				},
			],
			phases: [
				{
					n: 1,
					name: "Parse",
					items: [[false, "add the parser"]],
					verification: [[false, "A1 passes"]],
				},
			],
		});
		const fixture = await makeVerifyFixture({ impl: original });
		roots.push(fixture.root);

		// The phase "completes" — but the bar moved while it did.
		const weakened = buildImpl({
			rows: [
				{
					id: "A1",
					asserts: "accepts a version string",
					writableAt: 1,
					passesAt: 1,
					state: "passing",
				},
			],
			phases: [
				{
					n: 1,
					name: "Parse",
					items: [[true, "add the parser"]],
					verification: [[true, "A1 passes"]],
				},
			],
		});
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			weakened,
		);
		await commitAll(fixture.root, "phase 1 work");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.verdict).toBe("rejected");
		const finding = report.findings.find((f) => f.kind === "goalpost");
		expect(finding).toBeDefined();
		expect(finding?.message).toContain("rejects a malformed version string");
		expect(finding?.message).toContain("accepts a version string");
	});

	it("does not flag honest forward progress on the State column", async () => {
		const original = buildImpl({
			rows: [
				{
					id: "A1",
					asserts: "rejects a malformed version",
					writableAt: 1,
					passesAt: 1,
					state: "written",
				},
			],
			phases: [
				{
					n: 1,
					name: "Parse",
					items: [[false, "add the parser"]],
					verification: [[false, "A1 passes"]],
				},
			],
		});
		const fixture = await makeVerifyFixture({ impl: original });
		roots.push(fixture.root);

		const advanced = buildImpl({
			rows: [
				{
					id: "A1",
					asserts: "rejects a malformed version",
					writableAt: 1,
					passesAt: 1,
					state: "passing",
				},
			],
			phases: [
				{
					n: 1,
					name: "Parse",
					items: [[true, "add the parser"]],
					verification: [[true, "A1 passes"]],
				},
			],
		});
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			advanced,
		);
		await commitAll(fixture.root, "phase 1 work");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "goalpost")).toEqual([]);
	});
});
