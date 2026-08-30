import { checkClaudeMdPointers } from "../../lib/context-pointers.js";

/**
 * `indusk context check-pointers` — verify every path-shaped reference in the
 * project CLAUDE.md resolves on disk, and refuse hand-copied version claims.
 * Under the 60 KB budget regime (entries are rule + pointer), a dead pointer
 * is a lost rule body, and a literal `**Version**:` is a copy nothing in the
 * release flow updates. Exit 1 on either so the check composes into
 * verification pipelines.
 */
export function contextCheckPointers(projectRoot: string): void {
	const report = checkClaudeMdPointers(projectRoot);
	if (report === null) {
		console.error("No CLAUDE.md found at the project root.");
		process.exitCode = 1;
		return;
	}
	console.info(`${report.scanned.length} pointer(s) scanned`);
	const failures = report.dead.length + report.versionClaims.length;
	if (failures === 0) {
		console.info("PASS — all pointers resolve");
		return;
	}
	if (report.dead.length > 0) {
		console.error(`FAIL — ${report.dead.length} dead pointer(s):`);
		for (const p of report.dead) {
			console.error(`  - ${p}`);
		}
	}
	if (report.versionClaims.length > 0) {
		console.error(`FAIL — ${report.versionClaims.length} hand-copied version claim(s):`);
		for (const v of report.versionClaims) {
			console.error(
				v.problem === "mismatch"
					? `  - line ${v.line}: says ${v.claim}, package.json says ${v.actual} — replace the literal with a pointer to package.json/changelog`
					: `  - line ${v.line}: says ${v.claim}, but package.json has no version to check it against — replace the literal with a pointer to package.json/changelog`,
			);
		}
	}
	process.exitCode = 1;
}
