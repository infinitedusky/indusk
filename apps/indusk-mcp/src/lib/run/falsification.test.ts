import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../../bin/commands/run.js";
import { createGatedWorktreeTools, runGateScripts } from "./gate.js";
import { checkGoalposts, snapshotTrajectory } from "./goalposts.js";
import {
	execOptions,
	executeOf,
	fixtureDir,
	hooksDir,
	realGateScripts,
	repoRoot,
} from "./harness.test-support.js";
import { createWorktreeTools } from "./tools.js";

/**
 * Phase 6 — falsification hypotheses (T10–T16).
 *
 * Each test targets one named failure mode of the attested Tier-1 claim
 * ("the gate fires on each edit; exit 2 refuses; discipline is structural").
 * They assert against behavior that exists TODAY, so they are red until the
 * Phase 6 fixes land. The gate scripts are never mocked — a mocked gate makes
 * the whole family vacuous.
 */

const PARSE_ITEM_UNCHECKED =
	"- [ ] `parse(input): { major, minor, patch }` — accept exactly three dot-separated non-negative integers; reject leading zeros, missing/extra segments, and non-numeric segments (throw).";

let worktree: string;
let outside: string;

beforeEach(async () => {
	worktree = await mkdtemp(join(tmpdir(), "falsify-wt-"));
	outside = await mkdtemp(join(tmpdir(), "falsify-outside-"));
	await mkdir(join(worktree, ".claude"), { recursive: true });
	await cp(hooksDir, join(worktree, ".claude/hooks"), { recursive: true });
	await cp(fixtureDir, join(worktree, "guinea-pig"), { recursive: true });
});

afterEach(async () => {
	await rm(worktree, { recursive: true, force: true });
	await rm(outside, { recursive: true, force: true });
});

describe("T10 — the bash tool is an ungated write surface", () => {
	// The move a blocked model reaches for: rewrite the checkbox with a shell
	// command instead of the edit tool. `sed -i.bak` works on both macOS and
	// GNU; the induction is verified by CONTROL below — without it, a command
	// that silently fails to mutate would make this test pass vacuously.
	const CHECKOFF_COMMAND = "sed -i.bak 's/^- \\[ \\] `parse/- [x] `parse/' guinea-pig/impl.md";

	it("CONTROL: the shell checkoff genuinely mutates an ungated worktree", async () => {
		const tools = createWorktreeTools(worktree);
		await executeOf(tools, "bash")({ command: CHECKOFF_COMMAND }, execOptions);

		const after = await readFile(join(worktree, "guinea-pig/impl.md"), "utf8");
		expect(after).toContain("- [x] `parse");
	});

	it("refuses a phase-checkoff performed through bash, exactly as the edit tool would", async () => {
		const tools = createGatedWorktreeTools(worktree, { scripts: realGateScripts });
		const implPath = join(worktree, "guinea-pig/impl.md");

		await executeOf(tools, "bash")({ command: CHECKOFF_COMMAND }, execOptions);

		const after = await readFile(implPath, "utf8");
		expect(after).toContain(PARSE_ITEM_UNCHECKED);
		expect(after).not.toContain("- [x] `parse");
	});
});

describe("T11 — bash is bound to the worktree, not merely started in it", () => {
	it("refuses a bash command that writes outside the worktree root", async () => {
		const tools = createGatedWorktreeTools(worktree, { scripts: realGateScripts });
		const escapeTarget = join(outside, "escaped.txt");

		await executeOf(tools, "bash")(
			{ command: `echo pwned > ${JSON.stringify(escapeTarget)}` },
			execOptions,
		);

		expect(existsSync(escapeTarget)).toBe(false);
	});
});

describe("T12 — symlinks cannot walk the file tools out of the worktree", () => {
	it("refuses a write through an in-worktree symlink that points outside it", async () => {
		const secret = join(outside, "secret.txt");
		await writeFile(secret, "original", "utf8");
		await symlink(outside, join(worktree, "escape-link"));

		const tools = createWorktreeTools(worktree);

		await expect(
			executeOf(tools, "writeFile")(
				{ path: "escape-link/secret.txt", content: "overwritten" },
				execOptions,
			),
		).rejects.toThrow(/escape|outside|worktree/i);

		expect(await readFile(secret, "utf8")).toBe("original");
	});
});

describe("T13 — terminality cannot be self-assigned mid-phase", () => {
	it("flags a non-terminal row flipped to skipped as a moved goalpost", () => {
		const table = (state: string) =>
			[
				"## Test Trajectory",
				"",
				"| ID | Asserts | Writable at | Passes at | State |",
				"|----|---------|-------------|-----------|-------|",
				`| T1 | the thing works | Phase 1 | Phase 1 | ${state} |`,
				"",
			].join("\n");

		const before = snapshotTrajectory(table("written"));
		const after = snapshotTrajectory(table("skipped"));

		const violations = checkGoalposts(before, after);

		expect(violations.join(" ")).toMatch(/T1/);
		expect(violations.length).toBeGreaterThan(0);
	});

	it("still allows the honest forward transition to passing", () => {
		const table = (state: string) =>
			[
				"## Test Trajectory",
				"",
				"| ID | Asserts | Writable at | Passes at | State |",
				"|----|---------|-------------|-----------|-------|",
				`| T1 | the thing works | Phase 1 | Phase 1 | ${state} |`,
				"",
			].join("\n");

		expect(
			checkGoalposts(snapshotTrajectory(table("written")), snapshotTrajectory(table("passing"))),
		).toEqual([]);
	});
});

describe("T14 — a broken gate script never silently allows the edit", () => {
	it("blocks when a gate script exits non-zero-non-2 (crash / malformed impl)", async () => {
		const crasher = join(worktree, "crashing-gate.js");
		await writeFile(crasher, "process.exit(1);\n", "utf8");

		const result = await runGateScripts(
			{
				tool_name: "Edit",
				tool_input: {
					file_path: join(worktree, "guinea-pig/impl.md"),
					old_string: "a",
					new_string: "b",
				},
				cwd: worktree,
			},
			[crasher],
		);

		expect(result.allowed).toBe(false);
		expect(result.blockMessage ?? "").toMatch(/exit|fail|error/i);
	});
});

describe("T15 — a killed gate script never counts as allow", () => {
	it("blocks when the gate script is killed by the spawn timeout", async () => {
		const hanger = join(worktree, "hanging-gate.js");
		await writeFile(hanger, "setTimeout(() => {}, 60_000);\n", "utf8");

		const result = await runGateScripts(
			{
				tool_name: "Edit",
				tool_input: {
					file_path: join(worktree, "guinea-pig/impl.md"),
					old_string: "a",
					new_string: "b",
				},
				cwd: worktree,
			},
			[hanger],
			{ timeoutMs: 250 },
		);

		expect(result.allowed).toBe(false);
		expect(result.blockMessage ?? "").toMatch(/timed out|timeout/i);
	}, 10_000);
});

describe("T16 — --max-steps is validated before the run starts", () => {
	it("rejects non-numeric, zero, and negative step budgets with a max-steps-specific error", async () => {
		await mkdir(join(worktree, ".indusk"), { recursive: true });
		await writeFile(join(worktree, ".indusk/config.json"), "{}\n", "utf8");
		const implPath = join(worktree, "guinea-pig/impl.md");

		// A provider key must be present, or the run would exit 1 for the key
		// check instead — the assertion below matches the max-steps message
		// specifically so this can never pass for the wrong reason.
		const priorKey = process.env.GOOGLE_API_KEY;
		process.env.GOOGLE_API_KEY = "test-key-not-used";
		const errors: string[] = [];
		const priorError = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(args.map(String).join(" "));
		};

		try {
			for (const maxSteps of [Number.NaN, 0, -5]) {
				process.exitCode = 0;
				errors.length = 0;
				await run(worktree, implPath, { model: "gemini", maxSteps });
				expect(process.exitCode).toBe(1);
				expect(errors.join(" ")).toMatch(/max-steps/i);
			}
		} finally {
			console.error = priorError;
			process.exitCode = 0;
			if (priorKey === undefined) delete process.env.GOOGLE_API_KEY;
			else process.env.GOOGLE_API_KEY = priorKey;
		}
	});
});
