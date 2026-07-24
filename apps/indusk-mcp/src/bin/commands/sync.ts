import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getHubLessonsDir, promoteLesson, pullLessons } from "../../lib/sync/hub.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * `indusk sync promote <lesson>` — push a proven-general project lesson into
 * the machine-global hub channel (`$INDUSK_HOME/hub/lessons/`).
 */
export function syncPromote(projectRoot: string, name: string): void {
	const result = promoteLesson(projectRoot, name);
	switch (result.status) {
		case "promoted":
			console.info(`Promoted → ${result.hubPath} (hub v${result.hubVersion})`);
			console.info("Other projects receive it on their next `indusk sync pull` / catchup.");
			break;
		case "already-promoted":
			console.info(`Already promoted (identical content): ${result.hubPath}`);
			break;
		case "conflict":
			console.error(`Conflict: ${result.detail}\n  hub copy: ${result.hubPath}`);
			process.exitCode = 1;
			break;
		case "not-found":
			console.error(`Not found: ${result.detail}`);
			process.exitCode = 1;
			break;
	}
}

/**
 * `indusk sync pull` — merge the hub channel + the package's bundled
 * community lessons into this project's `.claude/lessons/`. Additive-only.
 */
export function syncPull(projectRoot: string): void {
	const result = pullLessons(projectRoot, join(packageRoot, "lessons/community"));
	if (result.pulled.length > 0) {
		console.info(`Pulled ${result.pulled.length} new rule(s):`);
		for (const f of result.pulled) console.info(`  + ${f}`);
	} else {
		console.info("No new rules — lessons are current.");
	}
	if (result.conflicts.length > 0) {
		console.info("Kept local versions (differ from channel — local wins):");
		for (const f of result.conflicts) console.info(`  = ${f}`);
	}
	const version = result.hubVersion === null ? "(no hub yet)" : `v${result.hubVersion}`;
	console.info(`Hub: ${getHubLessonsDir()} ${version}`);
}
