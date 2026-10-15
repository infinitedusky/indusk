import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { isCleanupPhaseTerminal, isFalsificationPhaseTerminal } from "../lib/cleanup/gate.js";
import { parseImplString } from "../lib/impl-parser.js";
import { prepareShapeReview } from "../lib/shape/shape.js";
import { runHook, validateWrite } from "./helpers/hook-runner.js";
import { NO_TESTS_FLIP, summaryImpl, type TaskSpec } from "./helpers/phase-summary-fixture.js";

/**
 * promise: hidden-detail-is-only-read — A9, A10, A11, A17, A23, A24 of the
 * story-first-phases impl.
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

/**
 * A17 of the story-first-phases impl: two readers that never learned the rule
 * (the ritual-phase finished check, the Shape step's verification check) must
 * not count a box line quoted inside a task's folded detail or a code block,
 * and must still count a genuine indented unchecked sub-item outside any fold.
 */
describe("A17 — a box line quoted in a task's fold does not hold a phase open", () => {
	const fold = (inner: string[]) => [
		"- [x] The one task of this phase is done",
		"  <details><summary>Technical</summary>",
		"",
		...inner,
		"",
		"  </details>",
	];
	const ritualImpl = (word: string, taskLines: string[]) =>
		[
			"# Plan",
			"",
			`### Build Phase 5: ${word} — a theme`,
			"",
			"**Tier**: med — the work step's default",
			"",
			"The phase does its work.",
			"",
			...taskLines,
			"",
		].join("\n");

	const unfenced = fold(["  Steps to try by hand:", "  - [ ] example"]);
	const fenced = fold(["  ```markdown", "  - [ ] example", "  ```"]);

	for (const [label, lines] of [
		["unfenced", unfenced],
		["inside a fence", fenced],
	] as const) {
		it(`a falsification phase is finished with a quoted unticked box ${label}`, () => {
			expect(isFalsificationPhaseTerminal(ritualImpl("Falsification", lines))).toBe(true);
		});
		it(`a cleanup phase is finished with a quoted unticked box ${label}`, () => {
			expect(isCleanupPhaseTerminal(ritualImpl("Cleanup", lines))).toBe(true);
		});
	}

	it("a genuine indented unchecked sub-item outside any fold still holds the phase open", () => {
		const lines = ["- [x] The one task", "  - [ ] a real nested item still to do"];
		expect(isFalsificationPhaseTerminal(ritualImpl("Falsification", lines))).toBe(false);
		expect(isCleanupPhaseTerminal(ritualImpl("Cleanup", lines))).toBe(false);
	});

	it("a genuine indented unchecked sub-item after a fold has closed still holds the phase open", () => {
		const lines = [...unfenced, "  - [ ] a real nested item after the fold"];
		expect(isFalsificationPhaseTerminal(ritualImpl("Falsification", lines))).toBe(false);
	});

	describe("Shape reads a Verification section as green", () => {
		const shapeOutcome = async (verification: TaskSpec) => {
			const { root } = project("");
			const body = summaryImpl("demo", { verificationTask: verification });
			try {
				return await prepareShapeReview({
					root,
					plan: "demo",
					phase: { kind: "build", number: 1 },
					implBody: body,
				});
			} catch (error) {
				// Past the verification check, the review looks for the phase's
				// boundary; a throw there means verification was read as green.
				return { kind: "past-verification", error };
			}
		};
		const notGreen = (o: Awaited<ReturnType<typeof shapeOutcome>>) =>
			o.kind === "skipped" && /verification is not green/.test(o.reason);

		it("with a ticked task whose fold quotes an unticked box", async () => {
			const o = await shapeOutcome({
				sentence: `The save check refuses the shapes it should ${NO_TESTS_FLIP}`,
				checked: true,
				detail: "Steps to try by hand:\n- [ ] example",
			});
			expect(notGreen(o), "a ticked Verification task, its detail quoting - [ ]").toBe(false);
		});

		it("with a ticked task whose fenced detail quotes an unticked box", async () => {
			const o = await shapeOutcome({
				sentence: `The save check refuses the shapes it should ${NO_TESTS_FLIP}`,
				checked: true,
				detail: "```markdown\n- [ ] example\n```",
			});
			expect(notGreen(o), "a ticked Verification task, a fence quoting - [ ]").toBe(false);
		});

		it("is not green when a real task in the section is unticked", async () => {
			const o = await shapeOutcome({
				sentence: `The save check refuses the shapes it should ${NO_TESTS_FLIP}`,
				checked: false,
				detail: "Steps.",
			});
			expect(notGreen(o)).toBe(true);
		});
	});
});

/**
 * A23 of the story-first-phases impl: a task fold opened and never closed hides
 * every line after it, real unticked tasks included, from the readers that skip
 * folded text. The save check refuses it; the readers stop the fold at the next
 * column-zero task or heading, as an unterminated fence masks nothing.
 */
describe("A23 — a task fold that is never closed hides nothing and is refused when saved", () => {
	const OPEN_FOLD = [
		"- [x] The first fix is made",
		"  <details><summary>Technical</summary>",
		"",
		"  Steps to try by hand:",
		"  - [ ] example",
		"",
		"- [ ] The second fix is made",
	];
	const ritualImpl = (word: string) =>
		[
			"# Plan",
			"",
			`### Build Phase 5: ${word} — a theme`,
			"",
			"**Tier**: med — the work step's default",
			"",
			"The phase does its work.",
			"",
			...OPEN_FOLD,
			"",
		].join("\n");

	it("a cleanup phase with a real unticked task after the open fold is not finished", () => {
		expect(isCleanupPhaseTerminal(ritualImpl("Cleanup"))).toBe(false);
	});

	it("a falsification phase with a real unticked task after the open fold is not finished", () => {
		expect(isFalsificationPhaseTerminal(ritualImpl("Falsification"))).toBe(false);
	});

	it("Shape does not read a Verification section as green past an open fold", async () => {
		const { root } = project("");
		const good = summaryImpl("demo", {
			verificationTask: {
				sentence: `The save check refuses the shapes it should ${NO_TESTS_FLIP}`,
				checked: true,
				detail: "Steps.",
			},
		});
		const open = good.replace(
			/(- \[x\] The save check refuses the shapes it should[^\n]*\n {2}<details>[\s\S]*?)\n {2}<\/details>\n/,
			"$1\n\n- [ ] A second check that is still to do\n",
		);
		expect(open).not.toBe(good);
		let outcome: Awaited<ReturnType<typeof prepareShapeReview>> | { kind: "past" };
		try {
			outcome = await prepareShapeReview({
				root,
				plan: "demo",
				phase: { kind: "build", number: 1 },
				implBody: open,
			});
		} catch {
			outcome = { kind: "past" };
		}
		expect(
			outcome.kind === "skipped" && /verification is not green/.test(outcome.reason),
			"an unticked task after an unclosed fold",
		).toBe(true);
	});

	const task: TaskSpec = {
		sentence: "The save check refuses a phase with no summary",
		detail: "Steps.",
	};

	function leftOpen(spec: Parameters<typeof summaryImpl>[1] = {}): string {
		const impl = summaryImpl("demo", { buildTask: task, ...spec });
		const at = impl.indexOf(task.sentence);
		const close = impl.indexOf("  </details>\n", at);
		return impl.slice(0, close) + impl.slice(close + "  </details>\n".length);
	}

	it("the control: the same impl with its fold closed passes the save check", async () => {
		const r = await validateWrite(summaryImpl("demo", { buildTask: task }));
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("an opted-in impl with a task fold left open is refused, naming the task", async () => {
		const r = await validateWrite(leftOpen());
		expect(r.exitCode, "a fold opened under the Build Phase 1 task and never closed").toBe(2);
		expect(r.stderr).toContain(task.sentence);
		expect(r.stderr).toMatch(/details|fold/i);
	});
});

/**
 * A24 of the story-first-phases impl: an Edit whose old text begins at a folded
 * box's dash carries no indent, so the tick check must judge the box by its
 * place in the whole file, not by the edit's own text.
 */
describe("A24 — ticking a box inside a fold, the edit starting at its dash, is not a checkoff", () => {
	const task: TaskSpec = {
		sentence: "The save check refuses a phase with no summary",
		detail: "Steps to try by hand:\n- [ ] example",
	};

	function tick(status: string) {
		const { root, implPath } = project(summaryImpl("demo", { status, buildTask: task }));
		return runHook(
			"check-gates.js",
			{
				tool_name: "Edit",
				tool_input: {
					file_path: implPath,
					old_string: "- [ ] example",
					new_string: "- [x] example",
				},
				cwd: root,
			},
			{ cwd: root },
		);
	}

	it("lets the edit through on a plan being drafted", async () => {
		const r = await tick("draft");
		expect(r.exitCode, `an edit starting at a folded box's dash, on a draft: ${r.stderr}`).toBe(0);
	});

	it("lets the edit through on a plan being built, with its gates still open", async () => {
		const r = await tick("in-progress");
		expect(r.exitCode, r.stderr).toBe(0);
	});
});
