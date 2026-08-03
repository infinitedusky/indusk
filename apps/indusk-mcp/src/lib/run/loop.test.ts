import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseImplString } from "../impl-parser.js";
import {
	CLI_MJS,
	finishStep,
	fixtureDir,
	phase1ImplBlock,
	realGateScripts,
	rowLine,
	SEMVER_MJS,
	SEMVER_TEST_MJS,
	toolCallStep,
	phase1VerificationLine as verificationLine,
} from "./harness.test-support.js";
import { detectHumanGate, runLoop } from "./loop.js";

/**
 * T5 — the full loop runs the guinea-pig plan to impl-complete via Claude,
 * advancing only on green gates.
 * T6 — the goalpost guard STOPS the loop if the Test Trajectory table is
 * mutated mid-phase.
 *
 * Deterministic: a scripted MockLanguageModelV4 plays the model driving the
 * FULL loop over a temp copy of the guinea-pig fixture, with the REAL gate
 * scripts spawned live on every edit AND on the deliberate phase-close probe.
 * No API calls; the gate is never mocked.
 */

const execFileAsync = promisify(execFile);

/** One scripted model step that calls a tool. */

describe("full loop over the guinea-pig plan (T5)", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await mkdtemp(join(tmpdir(), "dawn-loop-t5-"));
		await cp(fixtureDir, worktree, { recursive: true });
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("T5: runs the plan to impl-complete via the scripted Claude driver, advancing only on green gates", async () => {
		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const rowsBlock = [rowLine(impl, "T1"), rowLine(impl, "T2"), rowLine(impl, "T3")].join("\n");
		const implBlock = phase1ImplBlock(impl);
		const verifLine = verificationLine(impl);

		// The scripted phase: tests-first RED, states → written, implement,
		// verify green, states → passing, check off impl items, check off
		// verification. Every impl.md edit passes through the REAL gate chain.
		const model = new MockLanguageModelV4({
			doGenerate: [
				toolCallStep("writeFile", { path: "semver.test.mjs", content: SEMVER_TEST_MJS }),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: rowsBlock,
					new_string: rowsBlock.replaceAll("| ⬜ |", "| written |"),
				}),
				toolCallStep("writeFile", { path: "semver.mjs", content: SEMVER_MJS }),
				toolCallStep("writeFile", { path: "cli.mjs", content: CLI_MJS }),
				toolCallStep("bash", { command: "node --test semver.test.mjs" }),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: rowsBlock.replaceAll("| ⬜ |", "| written |"),
					new_string: rowsBlock.replaceAll("| ⬜ |", "| passing |"),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: implBlock,
					new_string: implBlock.replaceAll("- [ ]", "- [x]"),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: verifLine,
					new_string: verifLine.replace("- [ ]", "- [x]"),
				}),
				finishStep("Phase 1 complete: semver core implemented, tests green, items checked."),
			],
		});

		const result = await runLoop({
			worktree,
			model,
			gate: { scripts: realGateScripts },
		});

		expect(result.status).toBe("complete");
		if (result.status !== "complete") return;
		expect(result.phases).toHaveLength(1);
		expect(result.phases[0]).toMatchObject({ phase: 1, steps: 9 });

		// impl-complete on disk: every remaining unchecked item is an
		// explicitly overridden "(none needed)" gate item.
		const after = await readFile(join(worktree, "impl.md"), "utf8");
		const unchecked = after.split("\n").filter((l) => l.startsWith("- [ ]"));
		expect(unchecked.length).toBeGreaterThan(0);
		expect(unchecked.every((l) => l.includes("(none needed)"))).toBe(true);
		expect(rowLine(after, "T1")).toContain("| passing |");
		expect(rowLine(after, "T2")).toContain("| passing |");
		expect(rowLine(after, "T3")).toContain("| passing |");

		// The guinea-pig itself is genuinely green — the fixture's load-bearing
		// gate ("checkoff depends on green tests") was honestly satisfied.
		await expect(
			execFileAsync(process.execPath, ["--test", "semver.test.mjs"], { cwd: worktree }),
		).resolves.toBeTruthy();
	});

	it("stops RED (never advances) when the phase did not actually close", async () => {
		// The model does nothing and claims it is done — the deliberate
		// check-gates probe must catch the lie; the loop must not advance.
		const model = new MockLanguageModelV4({
			doGenerate: [finishStep("All done!")],
		});

		const result = await runLoop({
			worktree,
			model,
			gate: { scripts: realGateScripts },
		});

		expect(result.status).toBe("stopped-red");
		if (result.status !== "stopped-red") return;
		expect(result.phase).toBe(1);
		expect(result.reason).toMatch(/Phase 1/);
		expect(result.phases).toHaveLength(0);
	});

	it("pauses at a human gate instead of self-approving it", async () => {
		// Add a manual-smoke verification item to the fixture copy — the loop
		// must pause BEFORE spending a single model step.
		const implPath = join(worktree, "impl.md");
		const impl = await readFile(implPath, "utf8");
		const verifLine = verificationLine(impl);
		await writeFile(
			implPath,
			impl.replace(
				verifLine,
				`${verifLine}\n- [ ] Manual smoke: run \`node cli.mjs parse 1.2.3\` and eyeball the output.`,
			),
			"utf8",
		);

		const model = new MockLanguageModelV4({
			doGenerate: [finishStep("should never be reached")],
		});

		const result = await runLoop({
			worktree,
			model,
			gate: { scripts: realGateScripts },
		});

		expect(result.status).toBe("paused-human-gate");
		if (result.status !== "paused-human-gate") return;
		expect(result.phase).toBe(1);
		expect(result.items.some((i) => /Manual smoke/.test(i))).toBe(true);
		expect(result.phases).toHaveLength(0);
	});
});

describe("goalpost guard stops a mutated trajectory mid-run (T6)", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await mkdtemp(join(tmpdir(), "dawn-loop-t6-"));
		await cp(fixtureDir, worktree, { recursive: true });
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("T6: a tool step rewriting an Asserts cell STOPS the loop and surfaces it", async () => {
		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const t1 = rowLine(impl, "T1");
		const cells = t1.slice(1, -1).split("|");
		cells[1] = " `parse` accepts any string without throwing ";
		const weakened = `|${cells.join("|")}|`;

		// The model weakens T1's assertion mid-phase (a non-checkbox edit the
		// gate scripts allow — exactly the gap the goalpost guard closes).
		const model = new MockLanguageModelV4({
			doGenerate: [
				toolCallStep("writeFile", { path: "semver.test.mjs", content: SEMVER_TEST_MJS }),
				toolCallStep("edit", { path: "impl.md", old_string: t1, new_string: weakened }),
				finishStep("Phase 1 done."),
			],
		});

		const result = await runLoop({
			worktree,
			model,
			gate: { scripts: realGateScripts },
		});

		expect(result.status).toBe("stopped-goalpost");
		if (result.status !== "stopped-goalpost") return;
		expect(result.phase).toBe(1);
		expect(result.violations.some((v) => v.includes("T1") && /Asserts/i.test(v))).toBe(true);

		// The mutation landed on disk (the guard detects, it does not revert) —
		// but the loop STOPPED instead of advancing on the weakened table.
		const after = await readFile(join(worktree, "impl.md"), "utf8");
		expect(after).toContain("accepts any string without throwing");
	});
});

describe("detectHumanGate (derived, no new marker)", () => {
	function phaseOf(md: string) {
		const parsed = parseImplString(md);
		if (parsed.phases.length === 0) throw new Error("no phase parsed");
		return parsed.phases[0];
	}

	const emptyTrajectory = { rows: [], deferred: [], present: false };

	it("flags a Deferred Verification item", () => {
		const phase = phaseOf(
			[
				"### Phase 5: Matrix",
				"",
				"- [x] run the matrix",
				"",
				"#### Phase 5 Verification",
				"",
				"- [ ] **Deferred Verification** (A8): outcome quality is human judgment.",
			].join("\n"),
		);
		const items = detectHumanGate(phase, emptyTrajectory);
		expect(items.some((i) => /Deferred Verification/.test(i))).toBe(true);
	});

	it("flags manual/browser smoke items and U-prefixed deferred rows", () => {
		const phase = phaseOf(
			[
				"### Phase 2: UI",
				"",
				"- [ ] build the page",
				"",
				"#### Phase 2 Verification",
				"",
				"- [ ] Browser smoke: does the dashboard look right?",
				"- [ ] U3: manually verify the deploy banner.",
			].join("\n"),
		);
		const items = detectHumanGate(phase, emptyTrajectory);
		expect(items).toHaveLength(2);
	});

	it("ignores checked human-gate items and machine-verifiable phases", () => {
		const phase = phaseOf(
			[
				"### Phase 1: Core",
				"",
				"- [ ] implement parse",
				"",
				"#### Phase 1 Verification",
				"",
				"- [x] Manual smoke: already done by the human.",
				"- [ ] `pnpm vitest run` is green (T1).",
			].join("\n"),
		);
		expect(detectHumanGate(phase, emptyTrajectory)).toEqual([]);
	});
});
