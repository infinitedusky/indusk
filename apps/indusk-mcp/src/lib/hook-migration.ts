/**
 * Migration surface for retired hooks — the twin of `mcp-migration.ts`.
 *
 * Deleting a hook from the package source does nothing to consumers. The file
 * stays on disk in every `.claude/hooks/` that ever installed it, *and* stays
 * registered in `.claude/settings.json`, so it keeps being invoked forever —
 * or, once the file is finally removed by hand, the registration keeps
 * invoking something that no longer exists. `check-plan-order.js` was the live
 * instance: deleted from the package in the context-beam cleanup, still on disk
 * and still registered months later.
 *
 * Hooks discovery is `globSync` on both install sides, which means new hooks
 * arrive automatically and removed hooks never leave. This closes the other
 * half: `init` and `update` both call it, and future retirements extend
 * `LEGACY_HOOKS` rather than hand-rolling a removal loop in a command file.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Hooks retired from the package. Extend on future retirements. */
export const LEGACY_HOOKS: readonly string[] = ["check-plan-order.js"];

export interface RemoveLegacyHooksResult {
	/** Hook files deleted from `.claude/hooks/`. */
	filesRemoved: string[];
	/** Hooks whose `.claude/settings.json` registration was removed. */
	registrationsRemoved: string[];
}

export interface RemoveLegacyHooksOptions {
	/** Override the legacy list (tests). */
	hooks?: readonly string[];
}

interface HookCommand {
	type?: string;
	command?: string;
	[k: string]: unknown;
}
interface HookMatcher {
	matcher?: string;
	hooks?: HookCommand[];
	[k: string]: unknown;
}

/**
 * Remove every retired hook's file and its settings registration.
 *
 * Both halves matter and they fail differently: an orphaned *file* is dead
 * weight that still runs, an orphaned *registration* makes Claude Code invoke a
 * missing script on every matching tool call. Absent state is not an error —
 * a missing hooks dir, missing settings file, or unparseable settings means
 * nothing to do, never a throw, because this runs inside `init`/`update` where
 * a migration must not be able to fail the command.
 *
 * A matcher entry whose `hooks` array empties out is dropped entirely rather
 * than left as an empty shell that matches tool calls and runs nothing.
 */
export function removeLegacyHooks(
	projectRoot: string,
	opts: RemoveLegacyHooksOptions = {},
): RemoveLegacyHooksResult {
	const legacy = opts.hooks ?? LEGACY_HOOKS;
	const result: RemoveLegacyHooksResult = { filesRemoved: [], registrationsRemoved: [] };

	for (const name of legacy) {
		const hookPath = join(projectRoot, ".claude/hooks", name);
		if (existsSync(hookPath)) {
			try {
				rmSync(hookPath, { force: true });
				result.filesRemoved.push(name);
			} catch {
				// Leave it rather than fail the migration; the registration removal
				// below still stops it being invoked.
			}
		}
	}

	const settingsPath = join(projectRoot, ".claude/settings.json");
	if (!existsSync(settingsPath)) return result;

	let settings: { hooks?: Record<string, HookMatcher[]> };
	try {
		settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
	} catch {
		return result;
	}
	if (!settings.hooks) return result;

	let changed = false;
	for (const [event, entries] of Object.entries(settings.hooks)) {
		if (!Array.isArray(entries)) continue;
		const keptEntries: HookMatcher[] = [];
		for (const entry of entries) {
			const commands = Array.isArray(entry.hooks) ? entry.hooks : [];
			const kept = commands.filter((c) => {
				const cmd = String(c.command ?? "");
				const hit = legacy.find((name) => cmd.includes(name));
				if (hit) {
					if (!result.registrationsRemoved.includes(hit)) result.registrationsRemoved.push(hit);
					changed = true;
					return false;
				}
				return true;
			});
			// An entry that had commands and now has none would match tool calls and
			// run nothing — drop it instead.
			if (commands.length > 0 && kept.length === 0) continue;
			keptEntries.push(kept.length === commands.length ? entry : { ...entry, hooks: kept });
		}
		if (keptEntries.length === 0) delete settings.hooks[event];
		else settings.hooks[event] = keptEntries;
	}

	if (changed) writeFileSync(settingsPath, `${JSON.stringify(settings, null, "\t")}\n`);
	return result;
}
