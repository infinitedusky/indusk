/**
 * The one definition of a hook's registered command.
 *
 * Claude Code runs hook commands in the session's *current* directory, and
 * that directory moves with every Bash call that ends in a `cd`. A command
 * registered as `node .claude/hooks/<name>.js` therefore names a file that
 * exists only while the cwd is the project root; from `apps/indusk-mcp` node
 * exits 1 with module-not-found, which the host treats as a non-blocking
 * error, and the gate is silently off. Observed on eight checkoffs
 * (workbench-trust-fixes' retrospective).
 *
 * `${CLAUDE_PROJECT_DIR}` is the host's own variable — "the project root
 * where the session started" — set in every hook command's environment and
 * documented for exactly this purpose. It is quoted because project paths
 * carry spaces.
 *
 * `init` and `update` both import `hookCommand`, so the form is written down
 * once; `absolutizeHookCommands` is `update`'s migration for projects that
 * already carry the relative form.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The registered command for a hook file in `.claude/hooks/`. */
export function hookCommand(name: string): string {
	return `node "\${CLAUDE_PROJECT_DIR}"/.claude/hooks/${name}`;
}

/**
 * The form every project registered before 1.45: exactly `node
 * .claude/hooks/<name>.js`, nothing before or after. A command with arguments
 * or a different path is someone's deliberate edit and is never rewritten —
 * a silent change to a customized command is the class of failure this
 * module exists to close, not to add to.
 */
export const LEGACY_HOOK_COMMAND = /^node \.claude\/hooks\/([\w.-]+\.js)$/;

export interface AbsolutizeResult {
	/** Hook file names whose command was rewritten, in document order. */
	rewritten: string[];
}

interface HookEntryCommand {
	command?: unknown;
	[k: string]: unknown;
}
interface HookMatcherEntry {
	hooks?: HookEntryCommand[];
	[k: string]: unknown;
}

/**
 * Rewrite every command exactly equal to the legacy relative form into the
 * `hookCommand` form, in `.claude/settings.json`, and write the file only when
 * something changed.
 *
 * Absent state is nothing to do, never a throw: a missing settings file, an
 * unparseable one, or one with no `hooks` key returns an empty result, because
 * this runs inside `update` where a migration must not be able to fail the
 * command. Everything but the matched commands is left byte-for-byte as the
 * serializer found it — the migration's whole claim is that it touches
 * nothing else.
 */
export function absolutizeHookCommands(projectRoot: string): AbsolutizeResult {
	const result: AbsolutizeResult = { rewritten: [] };
	const settingsPath = join(projectRoot, ".claude/settings.json");
	if (!existsSync(settingsPath)) return result;

	const raw = readFileSync(settingsPath, "utf-8");
	let settings: { hooks?: Record<string, HookMatcherEntry[]> };
	try {
		settings = JSON.parse(raw);
	} catch {
		return result;
	}
	if (!settings || typeof settings !== "object" || !settings.hooks) return result;

	for (const entries of Object.values(settings.hooks)) {
		if (!Array.isArray(entries)) continue;
		for (const entry of entries) {
			if (!entry || !Array.isArray(entry.hooks)) continue;
			for (const hook of entry.hooks) {
				if (!hook || typeof hook.command !== "string") continue;
				const match = hook.command.match(LEGACY_HOOK_COMMAND);
				if (!match) continue;
				hook.command = hookCommand(match[1]);
				result.rewritten.push(match[1]);
			}
		}
	}

	if (result.rewritten.length > 0) {
		writeFileSync(settingsPath, `${JSON.stringify(settings, null, indentOf(raw))}\n`);
	}
	return result;
}

/**
 * The indentation the file already uses, so a rewrite does not reformat a
 * tab-indented file into spaces or vice versa. Defaults to two spaces, which
 * is what `init` writes.
 */
function indentOf(raw: string): string {
	const m = raw.match(/^(\t| +)"/m);
	return m ? m[1] : "  ";
}
