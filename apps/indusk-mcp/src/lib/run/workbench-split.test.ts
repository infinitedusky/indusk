import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it } from "vitest";
import { git } from "../../__tests__/helpers/test-git.js";
import {
	LAYOUTS,
	oneRepoAtPath,
	type VersionedWorkbench,
} from "../../__tests__/helpers/versioned-workbench.js";
import {
	fixtureDir,
	guineaPigHappyPathSteps,
	hooksDir,
	realGateScripts,
} from "./harness.test-support.js";
import { type RunLoopOptions, runLoop } from "./loop.js";

/**
 * dawn-workbench-execution — A7, A8 (run), A13 (run part).
 *
 * The loop takes one root as its whole world: tools, gates, commits and the
 * eval queue all hang off `options.worktree`. In a workbench the plan lives
 * in the workbench repository and the code in the declared repo, so a
 * one-root loop either cannot reach the plan (root = code) or commits code
 * into the workbench (root = workbench). These tests drive the REAL loop with
 * a scripted model and the REAL gate scripts over a one-repo workbench, and
 * assert what each repository holds afterwards.
 *
 * The call shape is the post-plan one (`planRoot` beside `worktree`), reached
 * through a cast because the option does not exist yet: the loop ignores it
 * today, which is exactly the failure the assertions describe.
 */

const PLAN = "semver";
const PLAN_DIR_REL = `.indusk/planning/${PLAN}`;
const IMPL_REL = `${PLAN_DIR_REL}/impl.md`;

let wb: VersionedWorkbench | null = null;
afterEach(() => {
	wb?.cleanup();
	wb = null;
});

/** The guinea-pig plan in the workbench, an empty code repo beside it, hooks installed at the workbench. */
function splitFixture(workbench: VersionedWorkbench) {
	const code = workbench.repos[0].dir;
	const planDir = join(workbench.root, PLAN_DIR_REL);
	mkdirSync(planDir, { recursive: true });
	cpSync(join(fixtureDir, "impl.md"), join(planDir, "impl.md"));
	cpSync(join(fixtureDir, "brief.md"), join(planDir, "brief.md"));
	mkdirSync(join(workbench.root, ".claude"), { recursive: true });
	cpSync(hooksDir, join(workbench.root, ".claude", "hooks"), { recursive: true });
	git(workbench.root, ["add", "-A"]);
	git(workbench.root, ["commit", "-qm", "plan: semver"]);
	return { code, implPath: join(planDir, "impl.md"), planBaseline: headOfRepo(workbench.root) };
}

function headOfRepo(dir: string): string {
	return git(dir, ["rev-parse", "HEAD"]);
}

/** The scripted happy path, with every edit of the plan addressed at the plan's own folder. */
function stepsAddressingThePlan(impl: string) {
	return guineaPigHappyPathSteps(impl, { itemwiseCheckoffs: true }).map((step) => ({
		...step,
		content: step.content.map((part) => {
			if (part.type !== "tool-call") return part;
			const input = JSON.parse(part.input) as { path?: string };
			if (input.path === "impl.md") input.path = IMPL_REL;
			return { ...part, input: JSON.stringify(input) };
		}),
	}));
}

/** Commits after `since` in `dir`, newest last, each with the paths it touched and its full message. */
function commitsAfter(dir: string, since: string) {
	const shas = git(dir, ["rev-list", "--reverse", `${since}..HEAD`])
		.split("\n")
		.filter(Boolean);
	return shas.map((sha) => ({
		sha,
		message: git(dir, ["log", "-1", "--format=%B", sha]),
		files: git(dir, ["show", "--name-only", "--format=", sha]).split("\n").filter(Boolean),
	}));
}

async function runSplit(workbench: VersionedWorkbench) {
	const { code, implPath, planBaseline } = splitFixture(workbench);
	const codeBaseline = headOfRepo(code);
	const impl = readFileSync(implPath, "utf8");
	const model = new MockLanguageModelV4({ doGenerate: stepsAddressingThePlan(impl) });
	const options = {
		worktree: code,
		planRoot: workbench.root,
		implPath,
		model,
		gate: { scripts: realGateScripts },
	} as unknown as RunLoopOptions;
	const result = await runLoop(options);
	return { code, implPath, planBaseline, codeBaseline, result };
}

function expectSplitOutcome(
	workbench: VersionedWorkbench,
	run: Awaited<ReturnType<typeof runSplit>>,
) {
	const { code, implPath, result } = run;
	expect(result.status, JSON.stringify(result, null, 2)).toBe("complete");

	// Code in the code repo, and only there.
	expect(existsSync(join(code, "semver.mjs")), "semver.mjs missing from the code repo").toBe(true);
	expect(existsSync(join(workbench.root, "semver.mjs")), "semver.mjs landed in the workbench").toBe(
		false,
	);

	// Checkoffs in the plan repo.
	const after = readFileSync(implPath, "utf8");
	expect(
		after.match(/^- \[x\] /gm)?.length ?? 0,
		"no checkoffs reached the plan repo",
	).toBeGreaterThanOrEqual(4);

	// Both trees committed clean.
	expect(git(code, ["status", "--porcelain"]), "code repo left dirty").toBe("");
	expect(git(workbench.root, ["status", "--porcelain"]), "workbench left dirty").toBe("");
}

describe("dawn-workbench-execution — run across the split", () => {
	it("A7: file edits land in the code repo and checkoffs in the plan repo, neither in the other", async () => {
		wb = oneRepoAtPath("nested");
		const run = await runSplit(wb);
		expectSplitOutcome(wb, run);
	}, 180_000);

	it("A8: each checkoff commits code to the code repo and only the checkoff to the plan repo, joined by a Code-Commit trailer", async () => {
		wb = oneRepoAtPath("nested");
		const run = await runSplit(wb);
		expectSplitOutcome(wb, run);

		const codeCommits = commitsAfter(run.code, run.codeBaseline);
		expect(codeCommits.length, "no commits landed in the code repo").toBeGreaterThan(0);
		for (const c of codeCommits) {
			expect(
				c.files.some((f) => f.startsWith(".indusk/")),
				`code commit ${c.sha} carries plan state`,
			).toBe(false);
		}
		const codeShas = new Set(codeCommits.map((c) => c.sha));

		const planCommits = commitsAfter(wb.root, run.planBaseline);
		expect(
			planCommits.length,
			"no checkoff commits landed in the plan repo",
		).toBeGreaterThanOrEqual(4);
		for (const c of planCommits) {
			expect(
				c.files.every((f) => f.startsWith(`${PLAN_DIR_REL}/`)),
				`plan commit ${c.sha} touches ${c.files.join(", ")}`,
			).toBe(true);
			const trailer = c.message.match(/^Code-Commit: ([0-9a-f]{40})$/m);
			expect(
				trailer,
				`plan commit ${c.sha} has no Code-Commit trailer:\n${c.message}`,
			).not.toBeNull();
			expect(
				codeShas.has(trailer?.[1] ?? ""),
				`trailer names ${trailer?.[1]}, not a code commit`,
			).toBe(true);
		}
	}, 180_000);
});

describe.each(LAYOUTS)("A13 (run) — the split holds on the %s layout", (_label, build) => {
	it("edits land in the code repo, checkoffs in the plan repo", async () => {
		wb = build();
		const run = await runSplit(wb);
		expectSplitOutcome(wb, run);
	}, 180_000);
});

import { execOptions, executeOf } from "./harness.test-support.js";
import { createWorktreeTools } from "./tools.js";

/**
 * A9 and A10 — authored at Build Phase 3, per Test Phase 1's register: their
 * subjects (`planRoot` on the loop, the object-form tool set) exist only now.
 */
describe("dawn-workbench-execution — the gate and the two allowed roots", () => {
	it("A9: a scripted checkoff while a row is non-terminal is refused by the gate read from the plan repo", async () => {
		wb = oneRepoAtPath("nested");
		const { code, implPath } = splitFixture(wb);
		const impl = readFileSync(implPath, "utf8");
		// Tests written and rows → written, then the model checks off the
		// items and the Verification line without ever making T1–T3 pass.
		const steps = stepsAddressingThePlan(impl).filter(
			(s) => !JSON.stringify(s).includes("| passing |"),
		);
		const model = new MockLanguageModelV4({ doGenerate: steps });
		const result = await runLoop({
			worktree: code,
			planRoot: wb.root,
			implPath,
			model,
			gate: { scripts: realGateScripts },
		});
		expect(result.status, JSON.stringify(result, null, 2)).toBe("stopped-red");
		if (result.status !== "stopped-red") return;
		expect(result.reason).toMatch(/T1|T2|T3|Trajectory|written/);
		// The verdict came from the plan repo's impl: its rows are still `written`.
		const after = readFileSync(implPath, "utf8");
		expect(after).toMatch(/\| T1 \|.*\| written \|/);
		expect(after).not.toMatch(/\| T1 \|.*\| passing \|/);
	}, 180_000);

	it("A10: a write outside both roots is refused, naming them; inside either is allowed", async () => {
		wb = oneRepoAtPath("nested");
		const { code } = splitFixture(wb);
		const tools = createWorktreeTools({
			codeRoot: code,
			planRoot: wb.root,
			planDir: PLAN_DIR_REL,
		});
		const write = executeOf(tools, "writeFile");

		await expect(
			write({ path: join(wb.root, ".indusk", "config.json"), content: "{}" }, execOptions),
		).rejects.toThrow(/outside both the code root .* and the plan's folder/);
		await expect(write({ path: "../escape.txt", content: "" }, execOptions)).rejects.toThrow(
			/outside both/,
		);

		await expect(write({ path: "src/ok.mjs", content: "" }, execOptions)).resolves.toMatch(/Wrote/);
		await expect(
			write({ path: `${PLAN_DIR_REL}/notes.md`, content: "" }, execOptions),
		).resolves.toMatch(/Wrote/);
		expect(existsSync(join(code, "src", "ok.mjs"))).toBe(true);
		expect(existsSync(join(wb.root, PLAN_DIR_REL, "notes.md"))).toBe(true);
	});
});
