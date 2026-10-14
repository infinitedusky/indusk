import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
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

/** `~` and relative paths made absolute; the directory is made if it is not there. */
export function setParent(dir: string, home: string = induskHome()): string {
	const absolute = resolve(dir.startsWith("~") ? join(homedir(), dir.slice(1)) : dir);
	mkdirSync(absolute, { recursive: true });
	mkdirSync(home, { recursive: true });
	writeFileSync(settingsPath(home), `${JSON.stringify({ parent: absolute }, null, 2)}\n`);
	return absolute;
}

/** Whether `location` is strictly inside the configured parent - the guard creation applies. */
export function isUnderParent(location: string, parent: string): boolean {
	const inside = resolve(location);
	const root = resolve(parent);
	return inside !== root && inside.startsWith(root.endsWith("/") ? root : `${root}/`);
}
