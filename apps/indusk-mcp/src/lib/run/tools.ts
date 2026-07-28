import { execFile } from "node:child_process";
import { mkdirSync, realpathSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

const execFileAsync = promisify(execFile);

/**
 * Minimal coding-agent tool set for the external orchestrator, bound to a
 * worktree root (ADR: "tool definitions (read/edit/bash bound to a worktree)").
 *
 * Every path argument resolves INSIDE the worktree root; escapes (`..`,
 * absolute paths outside the root) are rejected with an error the model can
 * read and correct. Tool errors are thrown — the AI SDK loop converts them
 * into error tool-results fed back to the model, so a bad call never kills
 * the run.
 *
 * NO gates here — the Phase 2 gate adapter wraps the edit/write execute path;
 * this file is deliberately gate-free loop plumbing.
 */

/**
 * Resolve `p` inside `root`, throwing if the result escapes the root.
 *
 * Textual containment is checked first, then the REAL path (T12): `resolve()`
 * only normalizes `..` lexically, so a symlink living inside the root but
 * pointing outside it passes a purely textual check while the subsequent
 * read/write lands wherever the link points. Both the target and its nearest
 * existing ancestor (for files being created) are realpath-ed, and the root
 * itself is realpath-ed so a symlinked root — e.g. macOS `/tmp` →
 * `/private/tmp`, or a workbench trunk symlink — doesn't false-positive.
 */
export function resolveInWorktree(root: string, p: string): string {
	const absRoot = resolve(root);
	const abs = resolve(absRoot, p);
	const rel = relative(absRoot, abs);
	if (rel.startsWith("..") || resolve(absRoot, rel) !== abs) {
		throw new Error(
			`Path "${p}" escapes the worktree root — all paths must stay inside ${absRoot}.`,
		);
	}

	// Both sides resolve the same way — realpath-ing only one of them makes a
	// not-yet-created root under a symlinked parent (macOS `/tmp` →
	// `/private/tmp`) look like an escape.
	const realRoot = realpathOfNearestExisting(absRoot);
	const realTarget = realpathOfNearestExisting(abs);
	const realRel = relative(realRoot, realTarget);
	if (realRel.startsWith("..") || resolve(realRoot, realRel) !== realTarget) {
		throw new Error(
			`Path "${p}" escapes the worktree root through a symlink — it resolves to ${realTarget}, outside ${realRoot}.`,
		);
	}

	return abs;
}

/**
 * realpath of `p` if it exists; otherwise realpath of its nearest existing
 * ancestor with the not-yet-created remainder appended — so a write to a new
 * file under a symlinked directory is still checked against the real location.
 */
function realpathOfNearestExisting(p: string): string {
	let current = p;
	const trailing: string[] = [];
	for (let i = 0; i < 64; i++) {
		try {
			return resolve(realpathSync(current), ...trailing.reverse());
		} catch {
			const parent = dirname(current);
			if (parent === current) return p;
			trailing.push(basename(current));
			current = parent;
		}
	}
	return p;
}

/** Bash output cap — keeps a runaway command from flooding the model context. */
const MAX_BASH_OUTPUT = 16_000;

function truncate(s: string): string {
	return s.length > MAX_BASH_OUTPUT ? `${s.slice(0, MAX_BASH_OUTPUT)}\n… [truncated]` : s;
}

/**
 * Build the worktree-bound tool set: readFile, writeFile, edit, bash, list.
 * The returned object plugs straight into `generateText({ tools })`.
 */
export function createWorktreeTools(worktreeRoot: string): ToolSet {
	const root = resolve(worktreeRoot);

	return {
		readFile: tool({
			description: "Read a UTF-8 text file from the worktree.",
			inputSchema: z.object({
				path: z.string().describe("File path relative to the worktree root."),
			}),
			execute: async ({ path }) => {
				const abs = resolveInWorktree(root, path);
				return await readFile(abs, "utf8");
			},
		}),

		writeFile: tool({
			description:
				"Create or overwrite a UTF-8 text file in the worktree. Parent directories are created as needed.",
			inputSchema: z.object({
				path: z.string().describe("File path relative to the worktree root."),
				content: z.string().describe("Full file content to write."),
			}),
			execute: async ({ path, content }) => {
				const abs = resolveInWorktree(root, path);
				mkdirSync(dirname(abs), { recursive: true });
				await writeFile(abs, content, "utf8");
				return `Wrote ${content.length} chars to ${path}.`;
			},
		}),

		edit: tool({
			description:
				"Edit a file by exact string replacement. old_string must occur exactly once in the file.",
			inputSchema: z.object({
				path: z.string().describe("File path relative to the worktree root."),
				old_string: z.string().describe("Exact text to replace — must be unique in the file."),
				new_string: z.string().describe("Replacement text."),
			}),
			execute: async ({ path, old_string, new_string }) => {
				const abs = resolveInWorktree(root, path);
				const current = await readFile(abs, "utf8");
				const first = current.indexOf(old_string);
				if (first === -1) {
					throw new Error(`old_string not found in ${path}.`);
				}
				if (current.indexOf(old_string, first + 1) !== -1) {
					throw new Error(`old_string occurs more than once in ${path} — provide a unique anchor.`);
				}
				const next =
					current.slice(0, first) + new_string + current.slice(first + old_string.length);
				await writeFile(abs, next, "utf8");
				return `Edited ${path}.`;
			},
		}),

		bash: tool({
			description:
				"Run a bash command with the worktree root as the working directory. Returns stdout, stderr, and the exit code.",
			inputSchema: z.object({
				command: z.string().describe("The bash command to run."),
			}),
			execute: async ({ command }) => {
				try {
					const { stdout, stderr } = await execFileAsync("bash", ["-c", command], {
						cwd: root,
						timeout: 120_000,
						maxBuffer: 10 * 1024 * 1024,
					});
					return {
						exitCode: 0,
						stdout: truncate(stdout),
						stderr: truncate(stderr),
					};
				} catch (err) {
					const e = err as {
						code?: number;
						stdout?: string;
						stderr?: string;
						message?: string;
					};
					return {
						exitCode: typeof e.code === "number" ? e.code : 1,
						stdout: truncate(e.stdout ?? ""),
						stderr: truncate(e.stderr ?? e.message ?? "command failed"),
					};
				}
			},
		}),

		list: tool({
			description:
				"List a directory in the worktree. Entries end with '/' when they are directories.",
			inputSchema: z.object({
				path: z.string().default(".").describe("Directory path relative to the worktree root."),
			}),
			execute: async ({ path }) => {
				const abs = resolveInWorktree(root, path);
				const entries = await readdir(abs, { withFileTypes: true });
				return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort();
			},
		}),
	};
}

export type WorktreeTools = ReturnType<typeof createWorktreeTools>;
