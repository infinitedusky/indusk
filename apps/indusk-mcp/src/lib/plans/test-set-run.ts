import type { FileResult } from "../tests/run-files.js";
import type { TestSet } from "./test-set.js";

/**
 * Running a plan's test set (tests-never-make-us-wait ADR D3).
 *
 * `planTestSet` decides which files; this reports the set. How a file is run is `lib/tests/run-files.ts`.
 *
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 */

/** The set as lines, each file with its reason, then what was named and not run. */
export function describeTestSet(set: TestSet, results?: readonly FileResult[]): string {
	const verdict = new Map((results ?? []).map((r) => [r.path, r.passed]));
	const lines = set.files.map((f) => {
		const v = verdict.get(f.path);
		const mark = v === undefined ? "  " : v ? "ok" : "FAIL";
		return `${mark.padEnd(4)} ${f.path}  (${f.reason})`;
	});
	if (set.withoutTests.length > 0)
		lines.push(
			"",
			`no tests: ${set.withoutTests.join(", ")} (a Must-not-break promise naming no test)`,
		);
	if (set.manual.length > 0) lines.push("", `manual, not run: ${set.manual.join("; ")}`);
	return lines.join("\n");
}
