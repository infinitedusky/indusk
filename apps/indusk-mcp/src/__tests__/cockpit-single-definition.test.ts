import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * plan-cockpit A34: every derived fact the cockpit shows is defined once, in
 * the package — the promise words, plan titles and release dates
 * (`promises/display`), and standing, proof, the fix prompt, the steps of a
 * plan, what it waits on and its history (`promises/standing`,
 * `promises/proof`, `promises/fix`, `plans/steps`, `plans/waiting`,
 * `plans/history`) — and the admin and the editor read them. A second copy is
 * how a dashboard and an editor come to say two things about one promise.
 *
 * Red until Build Phase 6 (the modules arrive across Build Phases 1, 5 and
 * 6); each module's definition and the extension's fix prompt are separate
 * assertions so each build phase turns its own green.
 *
 * promise: display-names-are-defined-once
 * promise: a-look-reports-like-any-promise — ui-promises A39 (a look's standing is defined once, in `promises/look-standing`).
 * promise: the-nav-says-where-a-plan-is — nav-stage-matches-plan-page A3 (which step a plan is at is defined once, `plans/steps`'s `stepAt`).
 * lesson: structural-single-definition-test-for-must-agree-invariants
 */

const LESSON = "lesson: structural-single-definition-test-for-must-agree-invariants";
const PACKAGE = join(REPO_ROOT, "apps/indusk-mcp");
const ADMIN = join(REPO_ROOT, "apps/indusk-admin/src");
const EDITOR = join(REPO_ROOT, "apps/vscode-extension/src");

/** The subpath, the source file that defines it, the function it defines. */
const MODULES = [
	["./promises/rows", "src/lib/promises/rows.ts", "rowsNaming"],
	["./promises/standing", "src/lib/promises/standing.ts", "standingOf"],
	["./promises/proof", "src/lib/promises/proof.ts", "proofOf"],
	["./promises/fix", "src/lib/promises/fix.ts", "fixPrompt"],
	["./plans/steps", "src/lib/plans/steps.ts", "planSteps"],
	["./plans/steps", "src/lib/plans/steps.ts", "stepAt"],
	["./plans/waiting", "src/lib/plans/waiting.ts", "planWaiting"],
	["./plans/history", "src/lib/plans/history.ts", "appendDecision"],
	// brief-as-the-contract Build Phase 4: a plan's promises, expectations, looks
	// and waiting amendments are the package's, drawn by the plan page.
	["./plans/parts", "src/lib/plans/parts.ts", "readPlanParts"],
	// ui-promises Build Phase 4: a look's state — approved, covered, held — is
	// the package's, read by the admin's Looks page and dashboard and the editor.
	["./looks/approvals", "src/lib/looks/approvals.ts", "approvalOf"],
	["./looks/coverage", "src/lib/looks/coverage.ts", "coverageOf"],
	["./looks/verdict", "src/lib/looks/verdict.ts", "verdict"],
	["./promises/standing", "src/lib/promises/look-standing.ts", "lookStandingOf"],
] as const;

/** Functions only the package may define. */
const PACKAGE_ONLY = [
	"standingOf",
	"proofOf",
	"fixPrompt",
	"planSteps",
	"stepAt",
	"currentStep",
	"planWaiting",
	"appendDecision",
	"readPlanParts",
	"approvalOf",
	"coverageOf",
	"verdict",
	"lookStandingOf",
	"lookStandingFor",
];

function sources(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
		return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
	});
}

const packageJson = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf-8")) as {
	exports: Record<string, { default?: string } | string>;
};

describe("A34 — the cockpit's facts are defined once, in the package", () => {
	for (const [subpath, file, fn] of MODULES) {
		it(`A34 the package exports ${subpath} and ${file} defines ${fn}`, () => {
			const where = `apps/indusk-mcp/${file} — ${LESSON}`;
			expect(Object.keys(packageJson.exports), `no ${subpath} export in package.json`).toContain(
				subpath,
			);
			const path = join(PACKAGE, file);
			const text = existsSync(path) ? readFileSync(path, "utf-8") : "";
			expect(text, where).toMatch(new RegExp(`export (async )?function ${fn}\\(`));
		});
	}

	it("A34 neither the admin nor the editor defines standingOf, proofOf, fixPrompt, planSteps, planWaiting, appendDecision, or a look's approvalOf, coverageOf, verdict, lookStandingOf or lookStandingFor", () => {
		const names = PACKAGE_ONLY.join("|");
		const defining = new RegExp(`(function|const|let) (${names})\\b`);
		const copies = [...sources(ADMIN), ...sources(EDITOR)]
			.filter((path) => defining.test(readFileSync(path, "utf-8")))
			.map((path) => relative(REPO_ROOT, path));
		expect(copies, `a second definition of a cockpit fact — ${LESSON}`).toEqual([]);
	});

	it("A34 neither the admin nor the editor holds a fix prompt of its own", () => {
		const copies = [...sources(ADMIN), ...sources(EDITOR)]
			.filter((path) => /Record the break first/.test(readFileSync(path, "utf-8")))
			.map((path) => relative(REPO_ROOT, path));
		expect(copies, `a second fix prompt — it is promises/fix's — ${LESSON}`).toEqual([]);
	});
});
