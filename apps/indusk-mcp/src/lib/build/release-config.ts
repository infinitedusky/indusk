import { readConfig } from "../config.js";

/**
 * `release.auto_accept` (admin-plan-authoring, ADR D7): a project that sets
 * it has a built plan accepted by its workflow at review, and the release
 * runs without the person. Absent or anything but `true` is no.
 */
export function autoAccepts(projectRoot: string): boolean {
	const config = readConfig(projectRoot) as { release?: { auto_accept?: unknown } } | null;
	return config?.release?.auto_accept === true;
}
