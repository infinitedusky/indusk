import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { initRepoWithCommit } from "./helpers/test-git.js";

/**
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A11, A12, A14.
 *
 * `indusk plans next <plan>` says what an unattended build does next, from
 * the plan as it stands: work an open phase, author the falsification, author
 * the cleanup, stop at a judgement the plan declared, or stop at review. It
 * never answers the retrospective. Through the CLI, over impls written here.
 */

const PLAN = "seat-holds";

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

interface Phase {
	heading: string;
	items?: string[];
	verification?: string[];
	done: boolean;
}

function phaseText(p: Phase): string {
	const box = p.done ? "[x]" : "[ ]";
	const title = p.heading.replace(/^### /, "");
	return [
		p.heading,
		"",
		...(p.items ?? ["build it"]).map((i) => `- ${box} ${i}`),
		"",
		`#### ${title.split(":")[0]} Verification`,
		"",
		...(p.verification ?? ["the tests pass"]).map((i) => `- ${box} ${i}`),
		"",
	].join("\n");
}

/** `audited` writes the plan's audit.md (plan-review-subagent: the audit comes after cleanup, before review). */
function project(
	phases: Phase[],
	frontmatter: string[] = [],
	deferred = "",
	audited = false,
): string {
	const root = mkdtempSync(join(tmpdir(), "plans-next-"));
	roots.push(root);
	initRepoWithCommit(root);
	mkdirSync(join(root, ".indusk", "planning", PLAN), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		'{ "mode": "full", "otel": { "role": "library" } }\n',
	);
	const allDone = phases.every((p) => p.done);
	writeFileSync(
		join(root, ".indusk", "planning", PLAN, "impl.md"),
		[
			"---",
			`title: "${PLAN}"`,
			`status: ${allDone ? "completed" : "in-progress"}`,
			...frontmatter,
			"---",
			"",
			`# ${PLAN}`,
			"",
			deferred,
			"## Checklist",
			"",
			...phases.map(phaseText),
		].join("\n"),
	);
	if (audited) writeFileSync(join(root, ".indusk", "planning", PLAN, "audit.md"), "- nothing\n");
	return root;
}

function next(dir: string): { step: string; item?: string } {
	const r = runCli(dir, ["plans", "next", PLAN, "--json"]);
	expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
	return JSON.parse(r.stdout);
}

const build = (done: boolean): Phase => ({ heading: "### Build Phase 1: Seats", done });
const falsification = (done: boolean): Phase => ({
	heading: "### Build Phase 2: Falsification — holds that never expire",
	done,
});
const cleanup = (done: boolean): Phase => ({
	heading: "### Build Phase 3: Cleanup — one seat module",
	done,
});

describe.skipIf(SHOULD_SKIP)("indusk plans next", () => {
	it("A11 — from the first phase through falsification and cleanup, it works and never asks", () => {
		const states: Array<[Phase[], string, boolean?]> = [
			[[build(false)], "work"],
			[[build(true)], "falsify"],
			[[build(true), falsification(false)], "work"],
			[[build(true), falsification(true)], "cleanup"],
			[[build(true), falsification(true), cleanup(false)], "work"],
			[[build(true), falsification(true), cleanup(true)], "audit"],
			[[build(true), falsification(true), cleanup(true)], "review", true],
		];
		const steps = states.map(([phases, , audited]) => next(project(phases, [], "", audited)).step);
		expect(steps).toEqual(states.map(([, step]) => step));
	});

	it("A12 — an open manual check the plan declared stops the build, naming it", () => {
		const item = "manual smoke: open the table page and see the held seat greyed out";
		const dir = project([{ ...build(false), items: ["build it"], verification: [item] }]);
		expect(next(dir)).toMatchObject({ step: "judgement", item });
	});

	it("A12 — an open item that names a Deferred Verification row stops the build, naming it", () => {
		const item = "U1 reviewed by the person who accepts the plan";
		const deferred = [
			"### Deferred Verification",
			"",
			"- **The seat looks held (U1)**",
			"  - reason: visual",
			"  - would require: a person",
			"  - mitigation: review",
			"",
		].join("\n");
		const dir = project([{ ...build(false), verification: [item] }], [], deferred);
		expect(next(dir)).toMatchObject({ step: "judgement", item });
	});

	it("A14 — rituals skipped with reasons and every phase closed: review, never the retrospective", () => {
		const dir = project(
			[build(true)],
			[
				"falsification: skipped",
				'falsification_reason: "a one-line change"',
				"cleanup: skipped",
				'cleanup_reason: "a one-line change"',
				"audit: skipped",
				'audit_reason: "a one-line change"',
			],
		);
		const step = next(dir).step;
		expect(step).toBe("review");
		expect(step).not.toBe("retrospective");
	});
});
