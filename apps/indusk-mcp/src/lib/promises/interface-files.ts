import { join } from "node:path";
import { fencedLineMask } from "../impl-headings.js";
import { isTestFile } from "../looks/components.js";
import { MOCKUPS_DIR, readJsonSync } from "../looks/mockups.js";
import { listApps } from "../looks/overview.js";
import type { BriefLooks } from "./brief-contract.js";

/**
 * Which files are an app's interface, and whether a brief has answered for
 * them (brief-as-the-contract ADR D2).
 *
 * An app's interface is the `sources` its `.indusk/mockups/<app>/screens.json`
 * declares — the same paths the look check already trusts, read here and not
 * declared a second time. A plan that changes a file there changes how
 * something looks, so its brief lists the look or says why there is none.
 */

export interface InterfaceFile {
	app: string;
	path: string;
}

/** Every app's declared `sources`, as `{app, source}` pairs, from the checkout at `root`. */
export function interfaceSources(root: string): Array<{ app: string; source: string }> {
	return listApps(root).flatMap((app) => {
		const declared = readJsonSync<{ sources?: string[] }>(
			join(root, MOCKUPS_DIR, app, "screens.json"),
			{},
		);
		return (declared.sources ?? []).map((source) => ({ app, source: source.replace(/\/+$/, "") }));
	});
}

/** The paths under a declared interface among `paths`, each with the app whose interface holds it. */
export function interfaceFilesAmong(root: string, paths: readonly string[]): InterfaceFile[] {
	const sources = interfaceSources(root);
	const out: InterfaceFile[] = [];
	for (const path of paths) {
		// A test changes no look. A story is still interface: it renders an approved snapshot.
		if (isTestFile(path)) continue;
		const hit = sources.find(
			({ source }) => source !== "" && (path === source || path.startsWith(`${source}/`)),
		);
		if (hit) out.push({ app: hit.app, path });
	}
	return out;
}

const NOT_A_PATH = /^(file|path|change|-+)$/i;

/**
 * The paths one cell names, each read on its own: every backticked span, or —
 * when the cell has none — each comma- or "and"-separated piece with a
 * parenthesised note dropped. A piece with a space left in it is prose, not a
 * path, and is skipped.
 */
function pathsInCell(cell: string): string[] {
	const ticked = [...cell.matchAll(/`+([^`]+)`+/g)].map((m) => m[1]);
	const pieces =
		ticked.length > 0 ? ticked : cell.replace(/\([^)]*\)/g, "").split(/\s*(?:,|&|\band\b)\s*/);
	return pieces
		.map((piece) => piece.trim().replace(/^\.\//, "").replace(/\/+$/, ""))
		.filter((path) => path !== "" && !NOT_A_PATH.test(path) && !/\s/.test(path));
}

/**
 * The paths an impl's `## Files Affected` names: every path in the first cell
 * of each table row (a note after one, or several, are read path by path), or
 * a bulleted path. A trailing slash and
 * `./` are dropped so a directory entry matches a source by prefix.
 */
export function filesAffectedOf(implText: string): string[] {
	const lines = implText.split("\n");
	const fenced = fencedLineMask(lines);
	const start = lines.findIndex((l, i) => !fenced[i] && /^##\s+Files Affected\s*$/i.test(l));
	if (start === -1) return [];
	const out: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i];
		if (!fenced[i] && /^#{1,2}\s/.test(line)) break;
		const cell = /^\s*\|\s*([^|]+?)\s*\|/.exec(line)?.[1] ?? /^\s*[-*]\s+(.+?)\s*$/.exec(line)?.[1];
		if (cell === undefined) continue;
		out.push(...pathsInCell(cell));
	}
	return out;
}

/** Whether a Looks section lists at least one look. */
export function listsALook(looks: BriefLooks | null): boolean {
	return (
		looks !== null &&
		looks.makes.length + looks.mustNotBreak.length + looks.changes.length + looks.replaces.length >
			0
	);
}

/** The files, one per line, grouped under their app, for a refusal. */
export function describeInterfaceFiles(files: readonly InterfaceFile[]): string {
	return files.map((f) => `${f.path} (${f.app}'s interface)`).join(", ");
}
