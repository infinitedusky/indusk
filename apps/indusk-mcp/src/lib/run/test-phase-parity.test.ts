import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gateTransition } from "../../__tests__/helpers/hook-runner.js";
import { createGatedWorktreeTools } from "./gate.js";
import {
	CLI_MJS,
	execOptions,
	executeOf,
	finishStep,
	fixtureDir,
	makeGatedWorktree,
	realGateScripts,
	SEMVER_MJS,
	SEMVER_TEST_MJS,
	type TempWorktree,
	toolCallStep,
} from "./harness.test-support.js";
import { runLoop } from "./loop.js";

/**
 * A10, A11 — two phase sequences, two execution lanes.
 *
 * The lanes share their gate scripts, which is exactly why this is worth
 * asserting rather than assuming: "they share the scripts" is a claim about
 * resolution, and resolution is a list of filenames that someone maintains.
 * `dawn-hook-parity` shipped with the budget script missing from that list.
 *
 * The plan is the guinea-pig semver fixture rewritten into the new shape:
 * Test Phase 1 authors the tests, Build Phase 1 builds. Red today because
 * `### Test Phase 1` parses as nothing, so the loop finds one phase where
 * there are two — or none at all.
 */

const TEST_PHASE_IMPL = `---
title: "Guinea-pig: semver CLI — Implementation"
date: 2026-08-11
status: accepted
trajectory: required
test_phases: required
gate_policy: auto
fixture: test-phase-structure
---

# Guinea-pig: semver CLI — Implementation

The guinea-pig plan in the two-sequence shape: the tests are authored in their
own phase, before the phase that makes them pass.

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | \`parse("1.2.3")\` yields \`{ major: 1, minor: 2, patch: 3 }\`; a malformed string throws | Test Phase 1 | Build Phase 1 | ⬜ |
| T2 | \`compare\` orders by major, then minor, then patch, returning \`-1\` / \`0\` / \`1\` | Test Phase 1 | Build Phase 1 | ⬜ |
| T3 | \`bump(v, "minor")\` increments minor and zeroes patch | Test Phase 1 | Build Phase 1 | ⬜ |

### Test Phase 1: Author the semver tests

- [ ] Author T1, T2 and T3 against the semver module, RED.

#### Test Phase 1 Verification

- [ ] T1, T2 and T3 exist and fail on their own assertions.

### Build Phase 1: semver core (parse / compare / bump)

- [ ] \`parse\`, \`compare\` and \`bump\`, plus a thin CLI wrapper.

#### Build Phase 1 Verification

- [ ] \`node --test semver.test.mjs\` is green: **T1**, **T2**, **T3**.

#### Build Phase 1 Context

- [ ] (none needed) — this is a fixture; it carries no project memory.

#### Build Phase 1 Document

- [ ] (none needed) — this is a fixture; no docs surface.
`;

/** The trajectory rows as one contiguous block, for a single scripted edit. */
function rowsBlock(impl: string): string {
	return impl
		.split("\n")
		.filter((l) => /^\| T[123] \|/.test(l))
		.join("\n");
}

function line(impl: string, startsWith: string): string {
	const found = impl.split("\n").find((l) => l.startsWith(startsWith));
	if (!found) throw new Error(`fixture line not found: ${startsWith}`);
	return found;
}

function checkOff(l: string): string {
	return l.replace("- [ ]", "- [x]");
}

describe("A10 — the thin lane walks a plan with two numbering sequences", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await mkdtemp(join(tmpdir(), "test-phase-loop-"));
		await cp(fixtureDir, worktree, { recursive: true });
		await writeFile(join(worktree, "impl.md"), TEST_PHASE_IMPL, "utf8");
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("closes the test phase, then the build phase, in order", async () => {
		const impl = await readFile(join(worktree, "impl.md"), "utf8");
		const rows = rowsBlock(impl);
		const authorItem = line(impl, "- [ ] Author T1");
		const testVerif = line(impl, "- [ ] T1, T2 and T3 exist");
		const buildItem = line(impl, "- [ ] `parse`, `compare`");
		const buildVerif = line(impl, "- [ ] `node --test");

		const model = new MockLanguageModelV4({
			doGenerate: [
				// Test Phase 1 — author the tests, mark them written, close.
				// The rows are NOT passing here, and must not need to be: they
				// pass at Build Phase 1. A gate that demanded green would make
				// the test phase impossible to close honestly.
				toolCallStep("writeFile", { path: "semver.test.mjs", content: SEMVER_TEST_MJS }),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: rows,
					new_string: rows.replaceAll("| ⬜ |", "| written |"),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: authorItem,
					new_string: checkOff(authorItem),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: testVerif,
					new_string: checkOff(testVerif),
				}),
				finishStep("Test Phase 1 complete: T1–T3 authored RED."),

				// Build Phase 1 — implement, go green, close.
				toolCallStep("writeFile", { path: "semver.mjs", content: SEMVER_MJS }),
				toolCallStep("writeFile", { path: "cli.mjs", content: CLI_MJS }),
				toolCallStep("bash", { command: "node --test semver.test.mjs" }),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: rows.replaceAll("| ⬜ |", "| written |"),
					new_string: rows.replaceAll("| ⬜ |", "| passing |"),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: buildItem,
					new_string: checkOff(buildItem),
				}),
				toolCallStep("edit", {
					path: "impl.md",
					old_string: buildVerif,
					new_string: checkOff(buildVerif),
				}),
				finishStep("Build Phase 1 complete: semver green."),
			],
		});

		const result = await runLoop({ worktree, model, gate: { scripts: realGateScripts } });

		expect(result.status).toBe("complete");
		if (result.status !== "complete") return;

		// Two phases, in sequence — the test phase first. Asserted by name
		// rather than number because the two sequences number independently:
		// "phase 1" alone no longer identifies a phase.
		expect(result.phases.map((p) => p.name)).toEqual([
			expect.stringContaining("Author the semver tests"),
			expect.stringContaining("semver core"),
		]);
	}, 120_000);
});

describe("A11 — the same violation is refused identically in both lanes", () => {
	let tree: TempWorktree;

	/** Build work checked off while the test that covers it is unauthored. */
	const BEFORE = TEST_PHASE_IMPL;
	const AFTER = TEST_PHASE_IMPL.replace("- [ ] `parse`, `compare`", "- [x] `parse`, `compare`");

	beforeEach(async () => {
		tree = await makeGatedWorktree("test-phase-parity", { fixtureAt: "root" });
		await writeFile(join(tree.root, "impl.md"), BEFORE, "utf8");
	});

	afterEach(async () => {
		await tree.cleanup();
	});

	it("both lanes refuse, and the thin lane's message is the hook's own", async () => {
		// Lane 1 — the PreToolUse hook, as Claude Code invokes it.
		const hookResult = await gateTransition(BEFORE, AFTER);
		expect(hookResult.exitCode).toBe(2);
		expect(hookResult.stderr).toMatch(/T1/);

		// Lane 2 — the thin lane's gated edit tool, production script
		// resolution, no scripts injected.
		const tools = createGatedWorktreeTools(tree.root);
		const edit = executeOf(tools, "edit");
		const laneResult = await edit(
			{
				path: "impl.md",
				old_string: "- [ ] `parse`, `compare`",
				new_string: "- [x] `parse`, `compare`",
			},
			execOptions,
		);

		// Not merely "also refused" — refused with the shared script's own
		// stderr, passed through. A thin-lane re-implementation of the rule
		// would satisfy "both refuse" and still be the drift this asserts
		// against.
		expect(String(laneResult)).toContain(hookResult.stderr.trim().split("\n")[0]);

		// And the edit never landed.
		const after = await readFile(join(tree.root, "impl.md"), "utf8");
		expect(after).toContain("- [ ] `parse`, `compare`");
	}, 60_000);
});
