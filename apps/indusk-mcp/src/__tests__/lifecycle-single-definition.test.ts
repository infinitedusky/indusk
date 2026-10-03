// promise: one-definition-per-shared-rule
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * admin-ui-phase-progress — A16.
 *
 * The lifecycle was defined in three places, none of them exported: a
 * module-private `STAGE_ORDER` in the plan parser (missing `test-plan`), the
 * ritual order in skill prose, and two disagreeing gate-kind types. The admin
 * carried a fourth partial copy — a private phase-heading regex that could
 * not see `Test Phase N`. This pins the fix: one `PLAN_POSITIONS`, one
 * `GATE_STAGES`, one `PHASE_HEADING`, and no heading regex in the admin.
 *
 * Same shape as its siblings (`shared-resolution`, `execution-roots-…`,
 * `head-sha-…`): a source-tree scan asserting exactly one definition exists,
 * because no behavioural test can catch a divergence that has not happened.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const ADMIN_PHASES = join(REPO_ROOT, "apps/indusk-admin/src/lib/phases.ts");
const IGNORE = ["**/*.test.ts", "**/*.test-support.ts"];

function libFiles(): string[] {
	return globSync("**/*.ts", { cwd: SRC_LIB, ignore: IGNORE }).sort();
}

function definers(pattern: RegExp): string[] {
	return libFiles().filter((f) => pattern.test(readFileSync(join(SRC_LIB, f), "utf-8")));
}

describe("A16 — one lifecycle definition, one phase-heading parser", () => {
	it("(a) the admin's phases.ts carries no phase-heading regex of its own", () => {
		const source = readFileSync(ADMIN_PHASES, "utf-8");
		expect(
			source,
			"lesson: structural-single-definition-test-for-must-agree-invariants — phases.ts still spells a `Phase\\s` regex; the lifecycle is one definition in lib/lifecycle.ts",
		).not.toMatch(/Phase\\s/);
		expect(source, "phases.ts still walks lines for `### `").not.toMatch(/\^#{3}/);
	});

	it("(b) exactly one PLAN_POSITIONS and one GATE_STAGES, both in lifecycle.ts", () => {
		expect(definers(/export const PLAN_POSITIONS\b/)).toEqual(["lifecycle.ts"]);
		expect(definers(/export const GATE_STAGES\b/)).toEqual(["lifecycle.ts"]);
	});

	it("(c) no STAGE_ORDER array literal survives outside lifecycle.ts", () => {
		expect(definers(/const STAGE_ORDER\b/).filter((f) => f !== "lifecycle.ts")).toEqual([]);
	});

	it("(d) exactly one PHASE_HEADING definition, in impl-headings.ts", () => {
		expect(definers(/export const PHASE_HEADING\b/)).toEqual(["impl-headings.ts"]);
	});
});

/**
 * admin-plan-type — A26 (cleanup).
 *
 * The plan's falsification found two questions each answered in three files:
 * which status words mean a document is finished, and which document comes
 * next. Two of the three copies of each were in `tools/plan-tools.ts`, which
 * the scan above never read. A third thing was spelled three times and found
 * by nobody: the human word for a document. This reads `src/lib` AND
 * `src/tools`, and names the file that spells any of the three again.
 */

const SRC = join(REPO_ROOT, "apps/indusk-mcp/src");

/** Files under `src/lib` and `src/tools` whose source matches, as `lib/…` or `tools/…`. */
function spellers(pattern: RegExp): string[] {
	return globSync(["lib/**/*.ts", "tools/**/*.ts"], { cwd: SRC, ignore: IGNORE })
		.sort()
		.filter((f) => pattern.test(readFileSync(join(SRC, f), "utf-8")));
}

describe("A26 — a document's label, the finished words and the next document are each defined once", () => {
	it("(a) one DOCUMENT_LABELS, and no other file spells a document's label", () => {
		expect(spellers(/export const DOCUMENT_LABELS\b/)).toEqual(["lib/workflow-types.ts"]);
		const inline = spellers(/["'`](?:[Tt]est plan|ADR)["'`]/).filter(
			(f) => f !== "lib/workflow-types.ts",
		);
		expect(inline, "a document's label is spelled inline; read DOCUMENT_LABELS").toEqual([]);
	});

	it("(b) one isFinishedDocumentStatus, and no other file compares a status to the finished words", () => {
		expect(spellers(/export function isFinishedDocumentStatus\b/)).toEqual(["lib/lifecycle.ts"]);
		const chain =
			/===\s*"accepted"\s*\|\|[^;{}]*?===\s*"completed?"|===\s*"completed?"\s*\|\|[^;{}]*?===\s*"accepted"/;
		expect(
			spellers(chain).filter((f) => f !== "lib/lifecycle.ts"),
			"a second list of the words that mean finished; call isFinishedDocumentStatus",
		).toEqual([]);
	});

	it("(c) one nextRequiredDocument, and nothing indexes the next document position by hand", () => {
		expect(spellers(/export function nextRequiredDocument\b/)).toEqual(["lib/lifecycle.ts"]);
		expect(
			spellers(/DOCUMENT_POSITIONS\[[^\]]*\+\s*1\s*\]/),
			"the next document in lifecycle order, whatever the type; call nextRequiredDocument",
		).toEqual([]);
	});
});
