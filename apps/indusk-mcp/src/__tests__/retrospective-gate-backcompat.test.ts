import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	appendHypothesis,
	isFalsificationComplete,
	markTerminated,
} from "../lib/falsification/log.js";

/**
 * T6 — Legacy `falsification.md` backward compatibility.
 *
 * The retrospective skill's Step 0 gate grows a new pass condition in 1.27.4+:
 * "all impl phases terminal" (the new phase-authoring flow's default path).
 * This test proves the LEGACY path — `isFalsificationComplete(planRoot)`
 * returning true for a pre-1.27.4 plan with a completed `falsification.md`
 * file — still works unchanged. No regression.
 *
 * Scope: the legacy path's correctness. The new "all impl phases terminal"
 * path is a markdown instruction to the retrospective skill, not a code
 * function; its correctness is verified by dogfood (T1–T5 in impl.md).
 */

let planRoot: string;

beforeEach(() => {
	planRoot = mkdtempSync(join(tmpdir(), "falsify-backcompat-"));
});

afterEach(() => {
	if (planRoot) rmSync(planRoot, { recursive: true, force: true });
});

describe("T6 — legacy falsification.md gate path (backward compatibility)", () => {
	it("a plan with a completed legacy log passes isFalsificationComplete", () => {
		// Seed a legacy falsification.md: one hypothesis entry, then terminator.
		appendHypothesis(planRoot, {
			hypothesis: "Concurrent writes to the registry race",
			testPath: "apps/indusk-mcp/src/__tests__/registry-race.test.ts",
			outcome: "fix-in-scope",
			note: "Legacy fixture for backward-compatibility regression test.",
		});
		markTerminated(planRoot, "No further in-scope hypothesis after investigation.");

		// The legacy gate path passes for this shape — unchanged from pre-1.27.4.
		expect(isFalsificationComplete(planRoot)).toBe(true);
	});

	it("a plan with a log but no terminator does NOT pass (incomplete)", () => {
		// Hypothesis entry without the subsequent terminator — represents a
		// ritual that was started but abandoned. Must not pass.
		appendHypothesis(planRoot, {
			hypothesis: "Hypothesis without termination",
			testPath: "apps/indusk-mcp/src/__tests__/never-terminated.test.ts",
			outcome: "accept-finding",
		});

		expect(isFalsificationComplete(planRoot)).toBe(false);
	});

	it("a plan with no falsification.md at all does NOT pass the legacy path", () => {
		// No log file; legacy path rejects. New flow's "all impl phases
		// terminal" path would handle this case separately (not tested here —
		// that's a markdown-instruction branch verified via dogfood).
		expect(isFalsificationComplete(planRoot)).toBe(false);
	});
});
