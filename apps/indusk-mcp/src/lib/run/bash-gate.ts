import { readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { ToolSet } from "ai";
import { type GateResult, runGateScripts } from "./gate.js";

/**
 * The `bash` write surface (T10/T11) — post-hoc gating and escape refusal.
 *
 * Extracted from `gate.ts` (Phase 7): adapting an edit call into an envelope
 * and spawning the scripts is *pre-flight* enforcement; watching a shell
 * command's effects and undoing them is *post-hoc surveillance*. Same
 * discipline, different mechanism, its own file.
 *
 * `bash` is the hole falsification found: the gate wrapped `edit`/`writeFile`
 * while a shell command could rewrite the very same bytes untouched — and
 * `sed -i` on a checkbox is exactly what a blocked model reaches for. Two
 * defenses, both deliberately modest about what they are:
 *
 *   1. **Escape refusal (T11)** — the command is scanned for absolute paths
 *      that resolve outside the root and refused before running. This is
 *      BEST-EFFORT, not isolation: `cwd` is a starting directory, and a
 *      command can still reach outside through indirection the scanner cannot
 *      see (a variable, a tool's own config path, `pnpm` writing to its global
 *      store). Real confinement needs a sandboxed run cell. Never describe
 *      this guard as a sandbox.
 *   2. **Post-hoc gating (T10)** — gate-relevant files (`impl.md`) are read
 *      before the command and re-checked after. A mutation is replayed through
 *      the SAME gate envelope the edit tool uses; if the gate refuses, the file
 *      is restored and the block message becomes the tool result. The gate
 *      still decides; only the moment of asking moves.
 */

type ToolExecuteFn = (input: unknown, executionOptions: unknown) => unknown;

/** Wrap the worktree `bash` tool so its file effects answer to the gate. */
export function gateBashTool(
	baseBash: ToolSet[string],
	root: string,
	scripts: string[],
	timeoutMs: number | undefined,
): ToolSet[string] {
	const originalExecute = (baseBash as { execute?: ToolExecuteFn }).execute;
	if (!originalExecute) throw new Error('Worktree tool "bash" has no execute to gate.');

	return {
		...baseBash,
		execute: async (input: unknown, executionOptions: unknown) => {
			const command = (input as { command?: string })?.command ?? "";

			const escaping = findEscapingPaths(command, root);
			if (escaping.length > 0) {
				return (
					`Refused: this bash command references ${escaping.join(", ")}, outside the worktree root ${root}. ` +
					"Commands must operate inside the worktree."
				);
			}

			const before = await snapshotGateRelevantFiles(root);
			const result = await originalExecute(input, executionOptions);
			const after = await snapshotGateRelevantFiles(root);

			for (const [file, previous] of before) {
				const current = after.get(file);
				if (current === undefined || current === previous) continue;

				const gate: GateResult = await runGateScripts(
					{
						tool_name: "Write",
						tool_input: { file_path: file, content: current },
						cwd: root,
					},
					scripts,
					{ timeoutMs },
				);
				if (!gate.allowed) {
					await writeFile(file, previous, "utf8");
					return (
						`Gate blocked this bash command's change to ${relative(root, file)} — it was REVERTED. ` +
						`A shell command is gated exactly like an edit.\n${gate.blockMessage}`
					);
				}
			}

			return result;
		},
	} as ToolSet[string];
}

/** Files the gate scripts have opinions about — cheap to read, worth watching. */
const GATE_RELEVANT_FILE = "impl.md";
const SNAPSHOT_SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "coverage"]);

/** Absolute paths in a command that land outside the worktree root. */
export function findEscapingPaths(command: string, worktreeRoot: string): string[] {
	const root = resolve(worktreeRoot);
	const escaping = new Set<string>();
	// Tokens that look like filesystem paths: absolute, or home-relative.
	for (const rawToken of command.split(/[\s;|&<>()"']+/)) {
		const token = rawToken.trim();
		if (!token.startsWith("/") && !token.startsWith("~")) continue;
		const candidate = token.startsWith("~") ? join(homedir(), token.slice(1)) : token;
		const abs = resolve(candidate);
		const rel = relative(root, abs);
		if (rel.startsWith("..") || resolve(root, rel) !== abs) escaping.add(token);
	}
	return [...escaping];
}

/** Content snapshot of every gate-relevant file under the root. */
async function snapshotGateRelevantFiles(root: string): Promise<Map<string, string>> {
	const found = new Map<string, string>();
	const walk = async (dir: string, depth: number): Promise<void> => {
		if (depth > 8) return;
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (SNAPSHOT_SKIP_DIRS.has(entry.name)) continue;
				await walk(full, depth + 1);
			} else if (entry.name === GATE_RELEVANT_FILE) {
				try {
					found.set(full, await readFile(full, "utf8"));
				} catch {
					// unreadable — nothing to compare against later
				}
			}
		}
	};
	await walk(root, 0);
	return found;
}
