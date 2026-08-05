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
 * A5 (dawn-verify) — phantom work.
 *
 * The failure nobody had named: an agent flips checkboxes and writes no code.
 * Every other detection passes — no gate is unchecked, no goalpost moved, the
 * tests were already green from an earlier phase. Only the diff since the
 * baseline shows the work never happened.
 *
 * The rule is deliberately narrow: it fires ONLY when a phase's diff touches
 * nothing but the plan's own impl.md. A detector that cries wolf gets disabled.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

function impl(checked: boolean): string {
	return buildImpl({
		rows: [
			{ id: "A1", asserts: "the widget parses", writableAt: 1, passesAt: 1, state: "passing" },
		],
		phases: [
			{
				n: 1,
				name: "Parse",
				items: [[checked, "add the parser"]],
				verification: [[checked, "A1 passes"]],
			},
		],
	});
}

describe("A5 — an item checked off with no corresponding change", () => {
	it("rejects, naming the item that was checked without work", async () => {
		const fixture = await makeVerifyFixture({ impl: impl(false) });
		roots.push(fixture.root);

		// The only thing that changed is the checkbox.
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			impl(true),
		);
		await commitAll(fixture.root, "phase 1 (allegedly)");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.verdict).toBe("rejected");
		const finding = report.findings.find((f) => f.kind === "phantom");
		expect(finding).toBeDefined();
		expect(finding?.message).toContain("add the parser");
	});

	it("stays silent when real work landed alongside the checkoff", async () => {
		const fixture = await makeVerifyFixture({ impl: impl(false) });
		roots.push(fixture.root);

		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			impl(true),
		);
		await writeFixtureFile(fixture.root, "src/parser.js", "export const parse = (s) => s;\n");
		await commitAll(fixture.root, "phase 1 with actual work");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "phantom")).toEqual([]);
	});
});
