import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDriver } from "./driver.js";
import {
	createGatedWorktreeTools,
	createGateToolApproval,
	resolveGateScripts,
	runGateScripts,
	toGateEnvelope,
} from "./gate.js";
import {
	execOptions,
	executeOf,
	fixtureDir,
	hooksDir,
	realGateScripts,
	repoRoot,
} from "./harness.test-support.js";

/**
 * T2/T3/T4 — the gate adapter + Tier-1 enforcement.
 *
 * T3/T4 spawn the REAL gate scripts (this repo's `.claude/hooks/`) against a
 * temp copy of the guinea-pig fixture — deterministic, no API calls, and the
 * gate itself is never mocked (a mocked gate would make T3 vacuous).
 */

/** The guinea-pig Phase 1 implementation item a premature checkoff flips. */
const PARSE_ITEM_UNCHECKED =
	"- [ ] `parse(input): { major, minor, patch }` — accept exactly three dot-separated non-negative integers; reject leading zeros, missing/extra segments, and non-numeric segments (throw).";
const PARSE_ITEM_CHECKED = PARSE_ITEM_UNCHECKED.replace("- [ ]", "- [x]");

describe("gate adapter — AI SDK tool-call → gate envelope (T2)", () => {
	it("maps an edit tool-call to the exact Edit envelope", () => {
		const envelope = toGateEnvelope("/tmp/wt", "edit", {
			path: "plans/impl.md",
			old_string: "- [ ] item",
			new_string: "- [x] item",
		});

		expect(envelope).toEqual({
			tool_name: "Edit",
			tool_input: {
				file_path: "/tmp/wt/plans/impl.md",
				old_string: "- [ ] item",
				new_string: "- [x] item",
			},
			cwd: "/tmp/wt",
		});
	});

	it("maps a writeFile tool-call to the exact Write envelope", () => {
		const envelope = toGateEnvelope("/tmp/wt", "writeFile", {
			path: "impl.md",
			content: "# fresh impl\n",
		});

		expect(envelope).toEqual({
			tool_name: "Write",
			tool_input: {
				file_path: "/tmp/wt/impl.md",
				content: "# fresh impl\n",
			},
			cwd: "/tmp/wt",
		});
	});

	it("rejects paths escaping the worktree root", () => {
		expect(() =>
			toGateEnvelope("/tmp/wt", "edit", {
				path: "../outside/impl.md",
				old_string: "a",
				new_string: "b",
			}),
		).toThrow(/escapes the worktree root/);
	});
});

describe("gate script resolution — target project's .claude/hooks/", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "dawn-gate-resolve-"));
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("finds both scripts by walking up from the worktree root", async () => {
		const project = join(root, "project");
		const worktree = join(project, "trees", "plan-x");
		await mkdir(join(project, ".claude/hooks"), { recursive: true });
		await mkdir(worktree, { recursive: true });
		await writeFile(join(project, ".claude/hooks/check-gates.js"), "// stub\n");
		await writeFile(join(project, ".claude/hooks/validate-impl-structure.js"), "// stub\n");

		expect(resolveGateScripts(worktree)).toEqual([
			join(project, ".claude/hooks/validate-impl-structure.js"),
			join(project, ".claude/hooks/check-gates.js"),
		]);
	});

	it("throws loudly when no ancestor has the gate scripts", async () => {
		const bare = join(root, "bare");
		await mkdir(bare, { recursive: true });
		expect(() => resolveGateScripts(bare)).toThrow(/\.claude\/hooks/);
	});
});

describe("own-the-execute gate against the REAL scripts (T3/T4)", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await mkdtemp(join(tmpdir(), "dawn-gate-t3t4-"));
		await cp(fixtureDir, worktree, { recursive: true });
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("T3: a premature phase-checkoff is blocked — exit 2, edit NOT applied, block message returned", async () => {
		const before = await readFile(join(worktree, "impl.md"), "utf8");
		expect(before).toContain(PARSE_ITEM_UNCHECKED); // precondition: fixture text pinned

		const tools = createGatedWorktreeTools(worktree, { scripts: realGateScripts });
		const result = await executeOf(tools, "edit")(
			{
				path: "impl.md",
				old_string: PARSE_ITEM_UNCHECKED,
				new_string: PARSE_ITEM_CHECKED,
			},
			execOptions,
		);

		// The block message (the gate script's stderr) IS the tool result.
		expect(String(result)).toMatch(/test-first violation/);
		expect(String(result)).toMatch(/not applied/i);

		// The edit did NOT land on disk.
		const after = await readFile(join(worktree, "impl.md"), "utf8");
		expect(after).toBe(before);
	});

	it("T4: a compliant edit passes the gate (exit 0) and is applied on disk", async () => {
		// Make the checkoff compliant: the fixture's trajectory rows are green.
		const implPath = join(worktree, "impl.md");
		const primed = (await readFile(implPath, "utf8")).replaceAll("| ⬜ |", "| passing |");
		await writeFile(implPath, primed, "utf8");

		const tools = createGatedWorktreeTools(worktree, { scripts: realGateScripts });
		const result = await executeOf(tools, "edit")(
			{
				path: "impl.md",
				old_string: PARSE_ITEM_UNCHECKED,
				new_string: PARSE_ITEM_CHECKED,
			},
			execOptions,
		);

		expect(String(result)).toMatch(/Edited impl\.md/);
		const after = await readFile(implPath, "utf8");
		expect(after).toContain(PARSE_ITEM_CHECKED);
		expect(after).not.toContain(PARSE_ITEM_UNCHECKED);
	});

	it("runGateScripts surfaces exit 2 + stderr from the real check-gates script", async () => {
		const envelope = toGateEnvelope(worktree, "edit", {
			path: "impl.md",
			old_string: PARSE_ITEM_UNCHECKED,
			new_string: PARSE_ITEM_CHECKED,
		});
		const gate = await runGateScripts(envelope, realGateScripts);
		expect(gate.allowed).toBe(false);
		expect(gate.blockMessage).toMatch(/test-first violation/);
	});
});

describe("toolApproval second layer (defense-in-depth)", () => {
	let worktree: string;

	beforeEach(async () => {
		worktree = await mkdtemp(join(tmpdir(), "dawn-gate-approval-"));
		await cp(fixtureDir, worktree, { recursive: true });
	});

	afterEach(async () => {
		await rm(worktree, { recursive: true, force: true });
	});

	it("denies a premature checkoff with the gate's block message as the reason", async () => {
		const approval = createGateToolApproval(worktree, { scripts: realGateScripts });
		const status = await approval.edit(
			{
				path: "impl.md",
				old_string: PARSE_ITEM_UNCHECKED,
				new_string: PARSE_ITEM_CHECKED,
			},
			execOptions,
		);

		expect(status).toMatchObject({ type: "denied" });
		expect((status as { reason?: string }).reason).toMatch(/test-first violation/);
	});

	it("approves a compliant edit", async () => {
		const implPath = join(worktree, "impl.md");
		const primed = (await readFile(implPath, "utf8")).replaceAll("| ⬜ |", "| passing |");
		await writeFile(implPath, primed, "utf8");

		const approval = createGateToolApproval(worktree, { scripts: realGateScripts });
		const status = await approval.edit(
			{
				path: "impl.md",
				old_string: PARSE_ITEM_UNCHECKED,
				new_string: PARSE_ITEM_CHECKED,
			},
			execOptions,
		);

		expect(status).toBe("approved");
	});

	it("blocks a premature checkoff end-to-end through the rented loop (both layers wired)", async () => {
		const implPath = join(worktree, "impl.md");
		const before = await readFile(implPath, "utf8");

		const model = new MockLanguageModelV4({
			doGenerate: [
				{
					content: [
						{
							type: "tool-call" as const,
							toolCallId: "call-premature-edit",
							toolName: "edit",
							input: JSON.stringify({
								path: "impl.md",
								old_string: PARSE_ITEM_UNCHECKED,
								new_string: PARSE_ITEM_CHECKED,
							}),
						},
					],
					finishReason: { unified: "tool-calls" as const, raw: "tool_use" },
					usage: {
						inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
						outputTokens: { total: 10, text: 10, reasoning: 0 },
					},
					warnings: [],
				},
				{
					content: [{ type: "text" as const, text: "done" }],
					finishReason: { unified: "stop" as const, raw: "end_turn" },
					usage: {
						inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
						outputTokens: { total: 10, text: 10, reasoning: 0 },
					},
					warnings: [],
				},
			],
		});

		const result = await runDriver({
			worktree,
			prompt: "Check off the parse item.",
			model,
			gate: { scripts: realGateScripts },
		});

		// The loop completed instead of crashing, and the edit never landed.
		expect(result.finishReason).toBe("stop");
		const after = await readFile(implPath, "utf8");
		expect(after).toBe(before);
	});
});
