import { type ContextFileReport, checkAllContextPointers } from "../../lib/context-pointers.js";

/** A context file as the report names it: in a workbench, its repo first. */
function where(r: ContextFileReport): string {
	return r.repo ? `${r.repo}: ${r.file}` : r.file;
}

/**
 * `indusk context check-pointers` — verify every path-shaped reference and
 * every `lesson: <name>` token in every context file resolves, and refuse
 * hand-copied version claims. Under the budget regime (entries are rule +
 * pointer), a dead pointer is a lost rule body, and a literal `**Version**:`
 * is a copy nothing in the release flow updates. Since context-tiers the walk
 * covers every `CLAUDE.md` git knows about, not only the root — a rule moved
 * to a nested file keeps its pointers, and so must the check. Exit 1 on any
 * failure so the check composes into verification pipelines.
 */
export function contextCheckPointers(projectRoot: string): void {
	const reports = checkAllContextPointers(projectRoot);
	if (reports === null) {
		console.error("No CLAUDE.md found at the project root.");
		process.exitCode = 1;
		return;
	}
	const scanned = reports.reduce((n, r) => n + r.scanned.length, 0);
	console.info(
		`${scanned} pointer(s) scanned across ${reports.length} context file(s): ${reports.map(where).join(", ")}`,
	);
	const failures = reports.reduce((n, r) => n + r.dead.length + r.versionClaims.length, 0);
	if (failures === 0) {
		console.info("PASS — all pointers resolve");
		return;
	}
	for (const r of reports) {
		if (r.dead.length > 0) {
			console.error(`FAIL — ${r.dead.length} dead pointer(s) in ${where(r)}:`);
			for (const p of r.dead) {
				console.error(`  - ${p}`);
			}
		}
		if (r.versionClaims.length > 0) {
			console.error(
				`FAIL — ${r.versionClaims.length} hand-copied version claim(s) in ${where(r)}:`,
			);
			for (const v of r.versionClaims) {
				console.error(
					v.problem === "mismatch"
						? `  - line ${v.line}: says ${v.claim}, package.json says ${v.actual} — replace the literal with a pointer to package.json/changelog`
						: `  - line ${v.line}: says ${v.claim}, but package.json has no version to check it against — replace the literal with a pointer to package.json/changelog`,
				);
			}
		}
	}
	process.exitCode = 1;
}
