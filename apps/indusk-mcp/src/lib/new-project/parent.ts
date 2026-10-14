import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { induskHome } from "../telemetry/status.js";

/**
 * The parent directory (new-project-flow, ADR decision 6): the one place a new
 * project may be made, set by the person with `indusk new-project parent
 * <dir>`. It is read from nowhere else and guessed from nothing - a wrong
 * guess writes somewhere the person did not choose.
 *
 * Kept in `<home>/new-projects.json`, not in `admin-ui.json`: that file is the
 * daemon's own record, overwritten when it starts and removed when it stops,
 * and a setting kept in it would be lost by `indusk ui stop`.
 *
 * The guard compares real paths, not text: a symbolic link inside the parent
 * that leads out of it puts a location outside it, and macOS spells the same
 * directory two ways (`/tmp` and `/private/tmp`). The location usually does
 * not exist yet, so its nearest existing ancestor is resolved and the rest
 * joined back on. A location inside an existing git repository under the
 * parent is refused too (`repositoryAround`): a project made there would
 * become part of that repository's working tree.
 *
 * promise: a-new-project-is-written-only-under-its-parent
 */

const settingsPath = (home: string): string => join(home, "new-projects.json");

/** The configured parent directory, or null when none is set. */
export function readParent(home: string = induskHome()): string | null {
	try {
		const raw = JSON.parse(readFileSync(settingsPath(home), "utf-8")) as { parent?: unknown };
		return typeof raw.parent === "string" && raw.parent !== "" ? raw.parent : null;
	} catch {
		return null;
	}
}

/** Where the parent was set: the command, or the admin's start page. Read by the creation span. */
export type ParentSetBy = "cli" | "admin";

/** Where the saved parent was set, or null when none is. */
export function parentSetBy(home: string = induskHome()): ParentSetBy | null {
	try {
		const raw = JSON.parse(readFileSync(settingsPath(home), "utf-8")) as { setBy?: unknown };
		return raw.setBy === "admin" ? "admin" : "cli";
	} catch {
		return null;
	}
}

/** `~` and relative paths made absolute; the directory is made if it is not there. */
export function setParent(
	dir: string,
	home: string = induskHome(),
	setBy: ParentSetBy = "cli",
): string {
	const absolute = resolve(dir.startsWith("~") ? join(homedir(), dir.slice(1)) : dir);
	mkdirSync(absolute, { recursive: true });
	mkdirSync(home, { recursive: true });
	writeFileSync(settingsPath(home), `${JSON.stringify({ parent: absolute, setBy }, null, 2)}\n`);
	return absolute;
}

/** The real path of `path`: its nearest existing ancestor resolved, the missing rest joined back on. */
export function realPathOf(path: string): string {
	let existing = resolve(path);
	while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
	const rest = relative(existing, resolve(path));
	let real = existing;
	try {
		real = realpathSync(existing);
	} catch {
		// unreadable: compare the text, the stricter-by-nothing fallback
	}
	return rest === "" ? real : join(real, rest);
}

/** Whether `location` is strictly inside the configured parent, by real path - the guard creation applies. */
export function isUnderParent(location: string, parent: string): boolean {
	const inside = realPathOf(location);
	const root = realPathOf(parent);
	return inside !== root && inside.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
}

/**
 * The existing git working tree `location` would land inside: the first
 * directory holding `.git`, walking from the location's nearest existing
 * ancestor up to (not including) the parent. Null when there is none.
 */
export function repositoryAround(location: string, parent: string): string | null {
	const root = realPathOf(parent);
	let dir = realPathOf(location);
	while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
	while (dir !== root && dir.startsWith(`${root}${sep}`)) {
		if (existsSync(join(dir, ".git"))) return dir;
		dir = dirname(dir);
	}
	return null;
}
