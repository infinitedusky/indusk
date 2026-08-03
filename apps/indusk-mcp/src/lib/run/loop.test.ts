import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseImplString } from "../impl-parser.js";
import { fixtureDir, realGateScripts } from "./harness.test-support.js";
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
function toolCallStep(toolName: string, input: Record<string, unknown>) {
	return {
		content: [
			{
				type: "tool-call" as const,
				toolCallId: `call-${toolName}-${Math.random().toString(36).slice(2, 8)}`,
				toolName,
				input: JSON.stringify(input),
			},
		],
		finishReason: { unified: "tool-calls" as const, raw: "tool_use" },
		usage: {
			inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 10, text: 10, reasoning: 0 },
		},
		warnings: [],
	};
}

/** The final scripted model step: plain text, no tool call. */
function finishStep(text: string) {
	return {
		content: [{ type: "text" as const, text }],
		finishReason: { unified: "stop" as const, raw: "end_turn" },
		usage: {
			inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 10, text: 10, reasoning: 0 },
		},
		warnings: [],
	};
}

/** Find the trajectory table line for a row id in impl.md content. */
function rowLine(content: string, id: string): string {
	const line = content.split("\n").find((l) => l.startsWith(`| ${id} |`));
	if (!line) throw new Error(`trajectory row ${id} not found in fixture`);
	return line;
}

/** The contiguous block of unchecked implementation items in Phase 1. */
function phase1ImplBlock(content: string): string {
	const start = content.indexOf("### Phase 1:");
	const end = content.indexOf("#### Phase 1 Verification");
	if (start === -1 || end === -1) throw new Error("fixture phase structure not found");
	return content
		.slice(start, end)
		.split("\n")
		.filter((l) => l.startsWith("- [ ]"))
		.join("\n");
}

/** The single Phase 1 Verification checklist line. */
function verificationLine(content: string): string {
	const start = content.indexOf("#### Phase 1 Verification");
	const end = content.indexOf("#### Phase 1 Context");
	const line = content
		.slice(start, end)
		.split("\n")
		.find((l) => l.startsWith("- [ ]"));
	if (!line) throw new Error("fixture verification item not found");
	return line;
}

const SEMVER_MJS = `const RE = /^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/;

export function parse(input) {
	const m = RE.exec(input);
	if (!m) throw new Error(\`invalid semver: \${input}\`);
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compare(a, b) {
	const pa = parse(a);
	const pb = parse(b);
	for (const key of ["major", "minor", "patch"]) {
		if (pa[key] < pb[key]) return -1;
		if (pa[key] > pb[key]) return 1;
	}
	return 0;
}

export function bump(version, level) {
	const v = parse(version);
	if (level === "major") return \`\${v.major + 1}.0.0\`;
	if (level === "minor") return \`\${v.major}.\${v.minor + 1}.0\`;
	if (level === "patch") return \`\${v.major}.\${v.minor}.\${v.patch + 1}\`;
	throw new Error(\`invalid level: \${level}\`);
}
`;

const SEMVER_TEST_MJS = `import assert from "node:assert/strict";
import test from "node:test";
import { bump, compare, parse } from "./semver.mjs";

test("T1: parse yields fields and rejects malformed input", () => {
	assert.deepEqual(parse("1.2.3"), { major: 1, minor: 2, patch: 3 });
	for (const bad of ["01.2.3", "1.2", "1.x.3"]) {
		assert.throws(() => parse(bad));
	}
});

test("T2: compare orders by major, then minor, then patch", () => {
	assert.equal(compare("1.9.9", "2.0.0"), -1);
	assert.equal(compare("2.1.0", "2.0.9"), 1);
	assert.equal(compare("1.2.3", "1.2.3"), 0);
	assert.equal(compare("1.2.3", "1.2.4"), -1);
});

test("T3: bump increments the level and zeroes lower fields", () => {
	assert.equal(bump("1.2.3", "minor"), "1.3.0");
	assert.equal(bump("1.2.3", "major"), "2.0.0");
	assert.equal(bump("1.2.3", "patch"), "1.2.4");
});
`;

const CLI_MJS = `#!/usr/bin/env node
import { bump, compare, parse } from "./semver.mjs";

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "parse") console.log(JSON.stringify(parse(args[0])));
else if (cmd === "compare") console.log(compare(args[0], args[1]));
else if (cmd === "bump") console.log(bump(args[0], args[1]));
else {
	console.error("usage: semver parse <v> | compare <a> <b> | bump <v> <level>");
	process.exit(1);
}
`;

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
