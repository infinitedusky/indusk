import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ingestScorecard } from "../findings.js";
import type { EvalScorecard } from "../types.js";

/**
 * Falsification test for eval-scorecard-format-fix:
 * proves a real-world failure mode that the original plan's scope
 * implicitly promised to handle but did not.
 *
 * Surfaced on Numero 2026-04-19: the model returned a scorecard with a
 * completely invented schema (flat fields like `commit`, `description`,
 * `skipped_steps`, `followed_conventions` instead of the expected
 * `{questions: [...], summary, graphitiWrites}` shape). The wrapper
 * successfully JSON-parsed it, wrote it to results.log, then crashed
 * inside `ingestScorecard` because the for-of loop at findings.ts:69
 * has no `?? []` guard for missing `questions`.
 *
 * The crash produced a misleading `error: true` entry RIGHT AFTER the
 * (wrong-shape) scorecard was already written. Two entries for one
 * changeId, the second one falsely implying the scorecard was lost.
 *
 * The robustness goal of eval-scorecard-format-fix was: "the eval system
 * stops silently under-counting its own work; scorecards land cleanly."
 * That goal is violated when ingestScorecard throws on a parsed scorecard.
 */
describe("ingestScorecard: malformed scorecard shape (falsification)", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "ingest-scorecard-test-"));
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	it("does not throw when scorecard.questions is undefined (model returned a different schema)", () => {
		// This is what landed in Numero's results.log on 2026-04-19:
		// the model invented its own scorecard shape with no `questions` field.
		const malformed = {
			version: 1,
			timestamp: new Date().toISOString(),
			mode: "eval",
			changeId: "vkpqxxpoywskqtzywpupululqmxpkqon",
			projectGroup: "numero",
			// Notably: NO `questions` field. Model invented siblings instead:
			commit: "vkpqxxpoywskqtzywpupululqmxpkqon",
			description: "Phase 3.4 rename",
			skipped_steps: false,
			followed_conventions: true,
			overall_quality: "good",
			notes: "All renames clean",
			summary: "ok",
			graphitiWrites: 0,
			telemetryPosted: false,
		} as unknown as EvalScorecard;

		expect(() => ingestScorecard(tmpRoot, malformed)).not.toThrow();
	});

	it("does not throw when scorecard.questions is null", () => {
		const malformed = {
			version: 1,
			timestamp: new Date().toISOString(),
			mode: "eval",
			changeId: "abc",
			projectGroup: "test",
			questions: null,
			summary: "ok",
			graphitiWrites: 0,
			telemetryPosted: false,
		} as unknown as EvalScorecard;

		expect(() => ingestScorecard(tmpRoot, malformed)).not.toThrow();
	});

	it("does not throw when scorecard.questions is a non-array (e.g. boolean)", () => {
		const malformed = {
			version: 1,
			timestamp: new Date().toISOString(),
			mode: "eval",
			changeId: "abc",
			projectGroup: "test",
			questions: false,
			summary: "ok",
			graphitiWrites: 0,
			telemetryPosted: false,
		} as unknown as EvalScorecard;

		expect(() => ingestScorecard(tmpRoot, malformed)).not.toThrow();
	});

	it("does not throw when scorecard.questions is an OBJECT keyed by question id (the Numero 19:54 case)", () => {
		// Real failure observed on Numero 2026-04-19 19:54 UTC: model returned
		//   "questions": { "conventions": { "verdict": "adhered", ... } }
		// instead of an array. Array.isArray({...}) === false, so the helper
		// must return [] (not iterate the object's enumerable properties).
		const malformed = {
			version: 1,
			timestamp: new Date().toISOString(),
			mode: "eval",
			changeId: "sxuolozqqrxuurzvzkwlwomstolxqqrr",
			projectGroup: "numero",
			questions: {
				conventions: { verdict: "adhered", commentary: "..." },
				skipped_steps: { verdict: "no", commentary: "..." },
			},
			summary: "ok",
			graphitiWrites: 0,
			telemetryPosted: false,
		} as unknown as EvalScorecard;

		expect(() => ingestScorecard(tmpRoot, malformed)).not.toThrow();
	});

	it("processes a well-shaped scorecard normally (regression)", () => {
		const wellShaped: EvalScorecard = {
			version: 1,
			timestamp: new Date().toISOString(),
			mode: "eval",
			changeId: "good",
			projectGroup: "test",
			questions: [
				{
					id: "conventions",
					question: "Did the agent follow conventions?",
					answer: "no",
					severity: "warning",
					evidence: "evidence text",
					finding: "missed a thing",
				},
			],
			summary: "ok",
			graphitiWrites: 0,
			telemetryPosted: false,
		};

		expect(() => ingestScorecard(tmpRoot, wellShaped)).not.toThrow();
	});
});
