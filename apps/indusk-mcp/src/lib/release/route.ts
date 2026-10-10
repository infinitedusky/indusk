import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { planFolders } from "../promises/plan-folder.js";
import { readImpl } from "../promises/rows.js";

/**
 * Where a failing slow test goes (release-records-its-failures D6): every
 * impl, active and archived, is read through the trajectory parser, and the
 * rows whose `Test` cell names the file are collected. The promises those
 * rows' `For` cells name are the file's claimants; a file no row's promise
 * claims is unclaimed — a bugfix plan's, not an incident's.
 *
 * Reads plan documents only. An impl that cannot be read is named, never
 * skipped: "no row names it" must not be what a broken impl looks like.
 *
 * promise: a-failing-slow-test-breaks-its-promise
 */

/** A row naming the failing file, and the plan whose impl holds it. */
export interface RoutingRow {
	plan: string;
	archived: boolean;
	id: string;
	/** The promises the row's `For` names; empty for a row that names none. */
	promises: string[];
}

export interface Route {
	/** Each promise any naming row claims, once, in row order. */
	promises: string[];
	/** Every row whose `Test` cell names the file. */
	rows: RoutingRow[];
	/** Plans whose impl could not be read. */
	unreadable: string[];
}

/** A test path as a row and a JUnit report both spell it: repo-relative, no `./`. */
function normalise(path: string): string {
	return posix.normalize(path.trim()).replace(/^\.\//, "");
}

export function routeFailure(root: string, file: string): Route {
	const want = normalise(file);
	const rows: RoutingRow[] = [];
	const unreadable: string[] = [];
	for (const folder of planFolders(root)) {
		const implPath = join(folder.dir, "impl.md");
		if (!existsSync(implPath)) continue;
		const impl = readImpl(readFileSync(implPath, "utf-8"));
		if (!impl.ok) {
			unreadable.push(folder.plan);
			continue;
		}
		for (const row of impl.trajectory.rows) {
			if (!(row.test ?? []).some((t) => normalise(t) === want)) continue;
			rows.push({
				plan: folder.plan,
				archived: folder.archived,
				id: row.id,
				promises: row.purpose?.promises ?? [],
			});
		}
	}
	return { promises: [...new Set(rows.flatMap((r) => r.promises))], rows, unreadable };
}
