import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parseImplString } from "../lib/impl-parser.js";
import { runHook, validateWrite } from "./helpers/hook-runner.js";
import { NO_TESTS_FLIP, summaryImpl, type TaskSpec } from "./helpers/phase-summary-fixture.js";

/**
 * promise: hidden-detail-is-only-read — A9, A10, A11 of the story-first-phases
 * impl.
 *
 * What is folded under a task is only read: it never ticks a box, skips a gate
 * or adds a task. The two scripts that check an impl file (check-gates.js when
 * a box is ticked, validate-impl-structure.js when the file is saved) are
 * driven as black boxes; the two impl readers are called for the counts.
 */

const hooksDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks");

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** A project holding one impl.md with `content` on disk. */
function project(content: string): { root: string; implPath: string } {
	const root = mkdtempSync(join(tmpdir(), "detail-only-read-"));
	roots.push(root);
	mkdirSync(join(root, ".indusk", "planning", "demo"), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
	const implPath = join(root, ".indusk", "planning", "demo", "impl.md");
	writeFileSync(implPath, content);
	return { root, implPath };
}

describe("A9 — editing a ticked box into a task's detail is not a checkoff", () => {
	const task: TaskSpec = {
		sentence: "The save check refuses a phase with no summary",
		detail: "Steps to try by hand:\n- [ ] example",
	};

	function editDetail(status: string) {
		const { root, implPath } = project(summaryImpl("demo", { status, buildTask: task }));
		return runHook(
			"check-gates.js",
			{
				tool_name: "Edit",
				tool_input: {
					file_path: implPath,
					old_string: "  - [ ] example",
					new_string: "  - [x] example",
				},
				cwd: root,
			},
			{ cwd: root },
		);
	}

	it("lets the edit through on a plan being drafted, judging no checkoff", async () => {
		const r = await editDetail("draft");
		expect(r.exitCode, `a ticked box inside a detail, on a draft: ${r.stderr}`).toBe(0);
	});

	it("lets the edit through on a plan being built, with its gates still open", async () => {
		const r = await editDetail("in-progress");
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("A10 — an opt-out phrase in a task's detail does not skip its gate", () => {
	const phrases = ["(none needed)", "(not applicable)", "skip-reason: nothing to say here"];
	const gates: Array<[string, keyof Parameters<typeof summaryImpl>[1]]> = [
		["Verification", "verificationTask"],
		["Context", "contextTask"],
		["Document", "documentTask"],
	];

	it.each(gates.flatMap(([gate, key]) => phrases.map((phrase) => [gate, phrase, key] as const)))(
		"a %s gate whose only task has %s in its detail is a real task",
		async (gate, phrase, key) => {
			const sentence =
				gate === "Verification"
					? `The save check refuses the shapes it should ${NO_TESTS_FLIP}`
					: `The ${gate} task is a real one`;
			const r = await validateWrite(summaryImpl("demo", { [key]: { sentence, detail: phrase } }));
			expect(r.exitCode, `${gate} with "${phrase}" folded under its task: ${r.stderr}`).toBe(0);
		},
	);

	it("still holds a top-level opt-out as an opt-out, refused at write time under ask", async () => {
		const impl = summaryImpl("demo").replace(
			/#### Build Phase 1 Document\n\n- \[ \][^\n]*\n(?: {2}[^\n]*\n)*/,
			"#### Build Phase 1 Document\n\n(none needed)\n",
		);
		expect(impl).toContain("Document\n\n(none needed)");
		const r = await validateWrite(impl);
		expect(r.exitCode, "a real top-level opt-out").toBe(2);
		expect(r.stderr).toMatch(/cannot use opt-outs/);
	});
});

describe("A11 — a box-shaped line in a task's detail adds no task", () => {
	const lines = (withBoxInDetail: boolean) =>
		[
			"### Build Phase 1: Placing a component",
			"",
			"- [ ] First task",
			"  <details><summary>Technical</summary>",
			"",
			"  Steps to try by hand:",
			...(withBoxInDetail ? ["  - [ ] example one", "  - [x] example two"] : []),
			"",
			"  </details>",
			"- [x] Second task",
			"",
			"#### Build Phase 1 Verification",
			"",
			"- [ ] It holds",
			"",
		].join("\n");

	it("the plan page's reader counts the same items with or without it", () => {
		const count = (md: string) =>
			parseImplString(md).phases[0].gates.reduce((n, g) => n + g.items.length, 0);
		expect(count(lines(false))).toBe(3);
		expect(count(lines(true))).toBe(count(lines(false)));
	});

	it("the tick check's reader counts the same items with or without it", async () => {
		const { parseImplPhases } = (await import(join(hooksDir, "_impl-phases.js"))) as {
			parseImplPhases: (md: string) => Array<{ items: unknown[] }>;
		};
		const count = (md: string) => parseImplPhases(md).reduce((n, p) => n + p.items.length, 0);
		expect(count(lines(false))).toBe(3);
		expect(count(lines(true))).toBe(count(lines(false)));
	});
});
