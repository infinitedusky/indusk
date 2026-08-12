import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * A4 — every impl already in this repository still writes and validates, with
 * no edits.
 *
 * This is a **regression guard, green on arrival**, and declared as such. It is
 * also this plan's declared stop condition: the whole backward-compatibility
 * story is one optional `Build ` group in one regex, and if that story is
 * wrong, the alternative is migrating 52 files rather than shipping the trick.
 * A fixture would test the trick. Only the corpus tests the claim.
 *
 * **It is a differential guard, not an absolute one.** Authoring it turned up
 * that nine archived impls are refused by today's validator already — they were
 * written before the gate rules existed and are read-only history, so making
 * them pass is not this plan's job and editing them would be editing the
 * record. The claim that matters is therefore *nothing that validates today
 * stops validating*, which is both honest and stricter than a blanket "the
 * corpus is green": a new failure cannot hide inside an existing one.
 *
 * The baseline is pinned by name rather than counted, so a plan that broke one
 * file and fixed another could not net out to green.
 *
 * Runs the validator against each impl at its real path with the repo as cwd,
 * because the hook resolves config (`otel.role`, gate policy) relative to both.
 */

/**
 * Impls that already fail, for reasons that predate this plan: each is missing
 * gate sections that became mandatory after it was archived.
 *
 * `archive/graphiti-infrastructure` is here for a different reason and is worth
 * naming separately: it writes its phases as `## Phase N` rather than `### Phase
 * N`, so no phase parses and it passed **vacuously** until this plan's
 * zero-phase rejection landed. It is not a regression — it is the bug that
 * rejection exists to catch, found in the wild. Archived plans are read-only
 * history, so it is recorded rather than repaired.
 *
 * `react-native-support` had the identical defect and is *active*, so its
 * headings were repaired instead: an active plan whose gates are silently
 * disabled is a live hazard, and baselining the defect would have hidden that
 * behind a green test. Repairing it turned enforcement back on, which promptly
 * found a real violation underneath — Phase 2's Context gate is an opt-out at
 * write time under `ask` policy. That is left as-is and recorded here. Writing
 * a Context item for a plan this one does not own would be inventing content to
 * make a test green, and the violation is exactly the kind the guard exists to
 * surface. The plan is parked; whoever picks it up fixes the gate.
 */
const PRE_EXISTING_FAILURES = [
	"archive/code-quality-system",
	"archive/codegraph-context",
	"archive/context-skill",
	"archive/document-skill",
	"archive/extension-system",
	"archive/gate-policy-enforcement",
	"archive/graphiti-infrastructure",
	"archive/gsd-inspired-improvements",
	// Closes a fence with `` ``` **Done — …** `` — trailing text on the closing
	// line, which CommonMark does not accept as a closer, so the block runs to
	// the end of the file. Genuinely malformed rather than newly-strict: any
	// markdown renderer already treats the rest of that document as code. The
	// falsification's fence rule is what surfaced it. Archived, so recorded.
	"archive/handoff-multi-agent-section-shape",
	"archive/mcp-dev-system",
	"archive/verify-skill",
	"react-native-support",
];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

async function corpus(): Promise<string[]> {
	return glob("**/impl.md", {
		cwd: join(repoRoot, ".indusk", "planning"),
		absolute: true,
	});
}

describe("A4 — the existing corpus validates unchanged", () => {
	it("finds impls to check", async () => {
		// A corpus test that silently matched nothing would be the most
		// comfortable green in this file and would mean nothing at all.
		expect((await corpus()).length).toBeGreaterThan(40);
	}, 30_000);

	it("no impl that validates today stops validating", async () => {
		const files = await corpus();
		const refused: string[] = [];

		for (const file of files) {
			const content = await readFile(file, "utf8");
			const result = await runHook("validate-impl-structure.js", {
				tool_name: "Write",
				tool_input: { file_path: file, content },
				cwd: repoRoot,
			});
			if (result.exitCode !== 0) {
				refused.push(dirname(relative(join(repoRoot, ".indusk", "planning"), file)));
			}
		}

		expect(refused.sort()).toEqual(PRE_EXISTING_FAILURES);
	}, 300_000);
});
