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

	it("A19 — does not fire when the work is real but still UNTRACKED", async () => {
		// `changedPathsSince` reads `git diff`, which shows tracked modifications
		// and never untracked files. So an agent that writes code without staging
		// it looks like it wrote nothing at all. The working-tree stance was
		// half-in, half-out: either end is defensible, the inconsistency is not.
		const fixture = await makeVerifyFixture({ impl: impl(false) });
		roots.push(fixture.root);

		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			impl(true),
		);
		// Real work, written but never `git add`ed.
		await writeFixtureFile(fixture.root, "src/parser.js", "export const parse = (s) => s;\n");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "phantom")).toEqual([]);
	});

	it("A20 — still fires when the only other change is InDusk machine state", async () => {
		// Verify's OWN success artifact is tracked and gets committed, so from the
		// first clean run onward every later phase's diff contains it — which made
		// "nothing but impl.md changed" permanently false and silently disabled
		// this detection. Self-inflicted, and invisible unless you go looking.
		const fixture = await makeVerifyFixture({ impl: impl(false) });
		roots.push(fixture.root);

		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			impl(true),
		);
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "verify", "ledger.jsonl"),
			'{"plan":"other","phase":1,"sha":"deadbee","trajectory":"sha256:x","timestamp":"t"}\n',
		);
		await writeFixtureFile(fixture.root, join(".indusk", "eval", "pending.jsonl"), "{}\n");
		await commitAll(fixture.root, "phase 1 (allegedly) + machine state");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "phantom").length).toBeGreaterThan(0);
	});

	it("T22 — still fires when the only other change is the phase-boundary record", async () => {
		// The same trap as A20, sprung a second time by a different plan. Shape's
		// boundary record is tracked too, and it is written when a phase OPENS —
		// so it lands in the diff of a phase that has not yet done anything, which
		// is the worst possible timing for something that reads as evidence of
		// work. isMachineState listed `.indusk/verify/` and `.indusk/eval/` and
		// was never told about it.
		const fixture = await makeVerifyFixture({ impl: impl(false) });
		roots.push(fixture.root);

		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			impl(true),
		);
		await writeFixtureFile(
			fixture.root,
			join(".indusk", "phase-boundary.jsonl"),
			'{"plan":"other","phase":1,"sha":"deadbee","timestamp":"t"}\n',
		);
		await commitAll(fixture.root, "phase 1 (allegedly) + a boundary record");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "phantom").length).toBeGreaterThan(0);
	});

	it("A21 — still fires when the item's text was edited in the same commit", async () => {
		// Items were matched across the baseline by text, so rewording an item
		// while checking it off made it look like a brand-new item rather than a
		// checkoff — and brand-new items are never flagged.
		const fixture = await makeVerifyFixture({ impl: impl(false) });
		roots.push(fixture.root);

		await writeFixtureFile(
			fixture.root,
			join(".indusk", "planning", fixture.plan, "impl.md"),
			impl(true).replace("- [x] add the parser", "- [x] add the parser (revised wording)"),
		);
		await commitAll(fixture.root, "phase 1 (allegedly), item reworded");

		const report = await runVerify({ root: fixture.root, plan: fixture.plan, phase: 1 });

		expect(report.findings.filter((f) => f.kind === "phantom").length).toBeGreaterThan(0);
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
