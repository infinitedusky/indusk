import { basename, dirname } from "node:path";
import { type EnsureResult, ensureConfigBlock, readConfig, sanitizeGroupId } from "../config.js";
import { gitCommonDirOf } from "../worktree/layout.js";

/**
 * Ensure the `promises` block exists, keyed on block PRESENCE, never on its
 * contents, so a project that already declares domains is never touched
 * (day-promises ADR D5). Domains are decided in planning; `update` only makes
 * the key exist so there is one place to declare them. One of the three
 * callers of the shared ensure (A32).
 */
export function ensurePromisesConfig(projectRoot: string): EnsureResult {
	return ensureConfigBlock(projectRoot, "promises", { domains: [] });
}

export const DEFAULT_QUIET_WINDOW_DAYS = 7;

/**
 * `promises.quiet_window_days`: how long a closed plan's behaviour promises
 * must stay quiet before it leaves `monitor`, and the window `promises status`
 * reports over (day-monitor, ADR D5, D8). Default 7; anything but a positive
 * number reads as the default. Malformed config JSON reads as the default
 * too — this is a display window, and the check that owns config validity is
 * elsewhere.
 */
export function getQuietWindowDays(projectRoot: string): number {
	let v: unknown;
	try {
		v = readConfig(projectRoot)?.promises?.quiet_window_days;
	} catch {
		return DEFAULT_QUIET_WINDOW_DAYS;
	}
	return typeof v === "number" && v > 0 ? v : DEFAULT_QUIET_WINDOW_DAYS;
}

/**
 * The project a promise mark belongs to (`indusk.project`): the configured
 * group id when there is one, else the name of the **main checkout** — the
 * folder holding the repository's shared git directory — so the trunk and
 * every plan worktree agree (day-monitor A28). A worktree's own folder is
 * named after its plan; tagging marks with it made the trunk drop every
 * evaluation of plan work. One function: the evaluator writes it, `status`,
 * `watch` and the admin read with it.
 */
export function markProjectId(root: string): string {
	let configured: unknown;
	try {
		configured = readConfig(root)?.graphiti?.groupId;
	} catch {
		configured = undefined;
	}
	if (typeof configured === "string" && configured !== "") return configured;
	const common = gitCommonDirOf(root);
	return sanitizeGroupId(basename(common ? dirname(common) : root));
}
