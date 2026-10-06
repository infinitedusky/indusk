import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A30, the hook half.
 * lesson: a-build-skips-a-gate-only-with-its-reason
 *
 * A build runs without a person to ask, so its sessions set
 * `INDUSK_GATE_POLICY=auto` — the per-invocation level, ranked above the
 * plan's own `gate_policy`. Under it a gate item may be skipped only with
 * its reason, which the review then shows; a bare `(none needed)` says
 * nothing a person could judge, and is refused. Through `check-gates.js`, as
 * Claude Code runs it.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A plan whose Build Phase 1 Document item carries `skip`, and whose Build Phase 2 is about to start. */
function project(skip: string, policy = "ask"): { root: string; impl: string } {
	const root = mkdtempSync(join(tmpdir(), "gate-policy-env-"));
	roots.push(root);
	mkdirSync(join(root, ".indusk", "planning", "seats"), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		'{ "mode": "full", "otel": { "role": "library" } }\n',
	);
	const impl = join(root, ".indusk", "planning", "seats", "impl.md");
	writeFileSync(
		impl,
		[
			"---",
			"title: seats",
			"status: in-progress",
			`gate_policy: ${policy}`,
			"---",
			"",
			"## Checklist",
			"",
			"### Build Phase 1: Seats",
			"",
			"- [x] build seats",
			"",
			"#### Build Phase 1 Verification",
			"",
			"- [x] the tests pass",
			"",
			"#### Build Phase 1 Context",
			"",
			"- [x] the area's CLAUDE.md",
			"",
			"#### Build Phase 1 Document",
			"",
			`- [ ] ${skip}`,
			"",
			"### Build Phase 2: Holds",
			"",
			"- [ ] build holds",
			"",
			"#### Build Phase 2 Verification",
			"",
			"- [ ] the tests pass",
			"",
		].join("\n"),
	);
	return { root, impl };
}

function startPhaseTwo(p: { root: string; impl: string }, env: NodeJS.ProcessEnv = {}) {
	return runHook(
		"check-gates.js",
		{
			tool_name: "Edit",
			tool_input: {
				file_path: p.impl,
				old_string: "- [ ] build holds",
				new_string: "- [x] build holds",
			},
			cwd: p.root,
		},
		{ cwd: p.root, env },
	);
}

const BUILD = { INDUSK_GATE_POLICY: "auto" };

describe("A30 — under a build's policy, a gate is skipped only with its reason", () => {
	it("a skip that gives its reason lets the next phase start, over the plan's own ask", async () => {
		const r = await startPhaseTwo(
			project("(none needed — this phase changed no public surface)"),
			BUILD,
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("skip-reason: with its reason counts too", async () => {
		const r = await startPhaseTwo(
			project("skip-reason: the page is written in Build Phase 7"),
			BUILD,
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("a bare (none needed) is refused, saying a build must give its reason", async () => {
		const r = await startPhaseTwo(project("(none needed)"), BUILD);
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/reason/);
	});

	it("the environment outranks a plan set to strict", async () => {
		const r = await startPhaseTwo(project("(none needed — nothing to document)", "strict"), BUILD);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("without it, the plan's ask still requires the person's answer", async () => {
		const r = await startPhaseTwo(project("(none needed — this phase changed no public surface)"));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/policy: ask/);
	});

	it("a value that is not a policy is ignored, never read as auto", async () => {
		const r = await startPhaseTwo(project("(none needed — reason given)"), {
			INDUSK_GATE_POLICY: "yes",
		});
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/policy: ask/);
	});
});
