import { existsSync, readFileSync } from "node:fs";

/**
 * Every record in a JSONL file InDusk keeps — the highlights queue, the
 * processed list — in order. No file reads as none; a malformed line is
 * skipped, as it always was by each reader this replaces, since one torn
 * append must not hide the rest of the log.
 */
export function readJsonl(path: string): Record<string, unknown>[] {
	if (!existsSync(path)) return [];
	const rows: Record<string, unknown>[] = [];
	for (const line of readFileSync(path, "utf-8").split("\n")) {
		if (line.trim() === "") continue;
		try {
			const parsed: unknown = JSON.parse(line);
			if (parsed && typeof parsed === "object") rows.push(parsed as Record<string, unknown>);
		} catch {
			// skip a malformed line
		}
	}
	return rows;
}
