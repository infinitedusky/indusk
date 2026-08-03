import matter from "gray-matter";
import { parseTrajectory, type Trajectory } from "../trajectory/parser.js";

/**
 * The goalpost guard — the loop's anti-gaming policy.
 *
 * Extracted from `loop.ts` (Phase 7): these are pure functions over a parsed
 * trajectory with no dependency on the loop that calls them, and they encode
 * the plan's sharpest rule — that a run may not quietly move the bar it is
 * being measured against. They read better as one named unit than as a middle
 * section of the orchestrator.
 */

/** Parse the Test Trajectory table out of full impl.md content (frontmatter included). */
export function snapshotTrajectory(implContent: string): Trajectory {
	return parseTrajectory(matter(implContent).content);
}

/**
 * Goalpost guard: compare a pre-phase trajectory snapshot against the
 * post-phase table. Returns violations (empty = clean).
 *
 * Violations: Asserts-text changes, `Passes at` moved later, `Writable at`
 * moved later (dodges the test-first duty), row removal, and **self-assigned
 * terminality** — flipping a row to `skipped`/`blocked` mid-phase (T13).
 * `skipped` is a legitimate HUMAN choice with a documented reason; when the
 * loop's own subject writes it, it is a model declaring its way out of a test
 * it could not make pass, and the phase-close probe would then read it as
 * terminal and advance. Honest forward progress (→ `written` → `passing`)
 * stays allowed, as do added rows.
 */
export function checkGoalposts(before: Trajectory, after: Trajectory): string[] {
	const violations: string[] = [];
	const afterById = new Map(after.rows.map((row) => [row.id, row]));

	for (const row of before.rows) {
		const now = afterById.get(row.id);
		if (!now) {
			violations.push(`Trajectory row ${row.id} was removed mid-phase — a deleted goalpost.`);
			continue;
		}
		if (now.asserts !== row.asserts) {
			violations.push(
				`Trajectory row ${row.id} Asserts changed mid-phase — a moved goalpost. Was: "${row.asserts}" — now: "${now.asserts}".`,
			);
		}
		if (
			Number.isFinite(row.passesAt) &&
			Number.isFinite(now.passesAt) &&
			now.passesAt > row.passesAt
		) {
			violations.push(
				`Trajectory row ${row.id} Passes at moved later mid-phase (Phase ${row.passesAt} → Phase ${now.passesAt}) — a deferred goalpost.`,
			);
		}
		if (
			Number.isFinite(row.writableAt) &&
			Number.isFinite(now.writableAt) &&
			now.writableAt > row.writableAt
		) {
			violations.push(
				`Trajectory row ${row.id} Writable at moved later mid-phase (Phase ${row.writableAt} → Phase ${now.writableAt}) — the test-first duty was deferred, not met.`,
			);
		}
		if (!SELF_ASSIGNABLE_STATES.has(row.state) && SELF_ASSIGNABLE_STATES.has(now.state)) {
			violations.push(
				`Trajectory row ${row.id} was flipped to "${now.state}" mid-phase (from "${row.state}") — terminality a human documents, not one the run declares for itself.`,
			);
		}
	}

	return violations;
}

/** States that end a row's obligation — legitimate from a human, not from the run. */
const SELF_ASSIGNABLE_STATES: ReadonlySet<string> = new Set(["skipped", "blocked"]);
