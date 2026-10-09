import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkRetrospectiveReadiness } from "../lib/cleanup/gate.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { implText } from "./helpers/plan-fixture.js";
import { initRepoWithCommit } from "./helpers/test-git.js";

/**
 * promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes — plan-review-subagent A1, A2.
 * promise: an-audit-blocks-nothing — plan-review-subagent A10.
 *
 * A plan with every phase closed, falsification and cleanup done and every row
 * passing is audited before its retrospective: the readiness check lists `audit`
 * as missing until audit.md exists or the impl carries `audit: skipped` with an
 * `audit_reason`, and `indusk plans next` answers `audit` until then. What
 * audit.md says is never read: any content, or none, leaves the gate passing.
 */

const PLAN = "seat-holds";

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A finished build; `keys` are extra impl frontmatter lines, `auditMd` the audit's content or absent. */
function finished(opts: { keys?: string[]; auditMd?: string } = {}) {
	const root = mkdtempSync(join(tmpdir(), "audit-gate-"));
	roots.push(root);
	initRepoWithCommit(root);
	const planRoot = join(root, ".indusk", "planning", PLAN);
	mkdirSync(planRoot, { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		'{ "mode": "full", "otel": { "role": "library" } }\n',
	);
	writeFileSync(
		join(planRoot, "impl.md"),
		implText(PLAN, {
			keys: [
				"falsification: skipped",
				'falsification_reason: "nothing to falsify"',
				"cleanup: skipped",
				'cleanup_reason: "nothing to extract"',
				...(opts.keys ?? []),
			],
			rows: [{ state: "passing" }],
		}),
	);
	if (opts.auditMd !== undefined) writeFileSync(join(planRoot, "audit.md"), opts.auditMd);
	return { root, planRoot, impl: () => readFileSync(join(planRoot, "impl.md"), "utf-8") };
}

function next(root: string): string {
	const r = runCli(root, ["plans", "next", PLAN, "--json"]);
	expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
	return JSON.parse(r.stdout).step;
}

describe("plan-review-subagent A1 — no audit.md, the retrospective is not ready", () => {
	it("readiness lists `audit` as missing", () => {
		const p = finished();
		const r = checkRetrospectiveReadiness(p.planRoot, p.impl());
		expect(r.missing).toEqual(["audit"]);
		expect(r.passes).toBe(false);
	});

	it.skipIf(SHOULD_SKIP)("`plans next` answers `audit` rather than `review`", () => {
		expect(next(finished().root)).toBe("audit");
	});
});

describe("plan-review-subagent A2 — audit.md, or a skip with its reason, satisfies the gate", () => {
	const skip = ["audit: skipped", 'audit_reason: "a one-line doc fix"'];

	it("audit.md present: readiness passes", () => {
		const p = finished({ auditMd: "## Questions\n\n- nothing\n" });
		expect(checkRetrospectiveReadiness(p.planRoot, p.impl()).missing).toEqual([]);
	});

	it("`audit: skipped` with `audit_reason`: readiness passes", () => {
		const p = finished({ keys: skip });
		expect(checkRetrospectiveReadiness(p.planRoot, p.impl()).missing).toEqual([]);
	});

	it("a bare `audit: skipped` with no reason: `audit` is still missing", () => {
		const p = finished({ keys: ["audit: skipped"] });
		expect(checkRetrospectiveReadiness(p.planRoot, p.impl()).missing).toEqual(["audit"]);
	});

	it.skipIf(SHOULD_SKIP)("audit.md present: `plans next` answers `review`", () => {
		expect(next(finished({ auditMd: "- nothing\n" }).root)).toBe("review");
	});

	it.skipIf(SHOULD_SKIP)("the skip pair: `plans next` answers `review`", () => {
		expect(next(finished({ keys: skip }).root)).toBe("review");
	});

	it.skipIf(SHOULD_SKIP)("a bare skip: `plans next` answers `audit`", () => {
		expect(next(finished({ keys: ["audit: skipped"] }).root)).toBe("audit");
	});
});

describe("plan-review-subagent A10 — what audit.md says changes no gate", () => {
	const findings = [
		"## Does each row prove its promise?",
		"",
		"- src/seat.ts:12 — the row asserts a narrower thing than the sentence",
		"- src/seat.ts:40 — the diff does something the brief never promised",
		"",
		"## Which skip reason would you not accept?",
		"",
		"- impl.md:99 — blocker: the whole plan is wrong",
		"",
	].join("\n");

	for (const [name, auditMd] of [
		["an audit.md full of findings", findings],
		["an empty audit.md", ""],
	] as const) {
		it(`${name}: readiness passes`, () => {
			const p = finished({ auditMd });
			const r = checkRetrospectiveReadiness(p.planRoot, p.impl());
			expect(r.passes).toBe(true);
			expect(r.missing).toEqual([]);
		});

		it.skipIf(SHOULD_SKIP)(`${name}: \`plans next\` answers \`review\``, () => {
			expect(next(finished({ auditMd }).root)).toBe("review");
		});
	}
});
