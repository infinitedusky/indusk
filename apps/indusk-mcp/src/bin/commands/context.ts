import { checkClaudeMdPointers } from "../../lib/context-pointers.js";

/**
 * `indusk context check-pointers` — verify every path-shaped reference in the
 * project CLAUDE.md resolves on disk. Under the 60 KB budget regime (entries
 * are rule + pointer), a dead pointer is a lost rule body. Exit 1 on dead
 * pointers so the check composes into verification pipelines.
 */
export function contextCheckPointers(projectRoot: string): void {
	const report = checkClaudeMdPointers(projectRoot);
	if (report === null) {
		console.error("No CLAUDE.md found at the project root.");
		process.exitCode = 1;
		return;
	}
	console.info(`${report.scanned.length} pointer(s) scanned`);
	if (report.dead.length === 0) {
		console.info("PASS — all pointers resolve");
		return;
	}
	console.error(`FAIL — ${report.dead.length} dead pointer(s):`);
	for (const p of report.dead) {
		console.error(`  - ${p}`);
	}
	process.exitCode = 1;
}
