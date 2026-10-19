import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * `.indusk/scaffold.json` — what InDusk wrote into a project's apps: each scaffolded
 * file's path from the project root, mapped to the hash of the content written. It is how
 * `update` tells a file nobody touched (refreshed) from one a person edited (left, with
 * the newer version beside it). In a workbench it sits at the workbench root.
 */

export const RECORD_REL = ".indusk/scaffold.json";

export interface ScaffoldRecord {
	files: Record<string, string>;
}

/** The record; none yet reads as empty. A file that is there and unreadable refuses, by name. */
export function readRecord(projectRoot: string): ScaffoldRecord {
	const path = join(projectRoot, RECORD_REL);
	if (!existsSync(path)) return { files: {} };
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf-8"));
	} catch (err) {
		throw new Error(
			`${RECORD_REL} is not readable JSON (${(err as Error).message}); fix or delete it`,
		);
	}
	const files = (parsed as { files?: unknown })?.files;
	if (typeof files !== "object" || files === null || Array.isArray(files)) {
		throw new Error(`${RECORD_REL} has no "files" map; fix or delete it`);
	}
	return { files: files as Record<string, string> };
}

export function writeRecord(projectRoot: string, record: ScaffoldRecord): void {
	const path = join(projectRoot, RECORD_REL);
	mkdirSync(dirname(path), { recursive: true });
	const sorted = Object.fromEntries(
		Object.entries(record.files).sort(([a], [b]) => a.localeCompare(b)),
	);
	writeFileSync(path, `${JSON.stringify({ files: sorted }, null, 2)}\n`);
}
