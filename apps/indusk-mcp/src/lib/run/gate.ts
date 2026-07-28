import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import type { ToolApprovalStatus, ToolSet } from "ai";
import { createWorktreeTools, resolveInWorktree } from "./tools.js";

/**
 * Tier-1 gate adapter + invoker (ADR Decision 2/3).
 *
 * The discipline lives in the SHARED gate scripts (`validate-impl-structure.js`,
 * `check-gates.js`) — pure Node programs reading a `{ tool_name, tool_input,
 * cwd }` JSON envelope on stdin, exit 0 = allow / exit 2 = block (stderr is
 * the block message). This module is a THIN invoker: it adapts the AI SDK
 * tool-call shape to that envelope and spawns the scripts. NO rule content
 * lives here — change the rules by changing the scripts, never this file.
 *
 * Two enforcement layers, both invoking the same scripts:
 *   - PRIMARY (own-the-execute): `createGatedWorktreeTools` wraps the
 *     edit/writeFile execute — gate first, apply only on allow, return the
 *     block message as the tool result on exit 2.
 *   - SECONDARY (SDK-native): `createGateToolApproval` is a `toolApproval`
 *     configuration that denies the call above the provider swap
 *     (defense-in-depth; wired with `experimental_toolApprovalSecret`).
 */

/** The stdin JSON envelope the InDusk PreToolUse gate scripts consume. */
export interface GateEnvelope {
	tool_name: "Edit" | "Write";
	tool_input:
		| { file_path: string; old_string: string; new_string: string }
		| { file_path: string; content: string };
	cwd: string;
}

/** Outcome of running the gate script chain against one envelope. */
export interface GateResult {
	allowed: boolean;
	/** The blocking script's stderr — present when `allowed` is false. */
	blockMessage?: string;
}

/** The worktree tools whose execute path is gated. */
export type GatedToolName = "edit" | "writeFile";

export interface GateOptions {
	/**
	 * Absolute paths to the gate scripts, run in order. Injectable for tests;
	 * defaults to `resolveGateScripts(worktreeRoot)`.
	 */
	scripts?: string[];
	/** Per-script spawn timeout. Default 30s. A timeout BLOCKS (see T15). */
	timeoutMs?: number;
}

/** Default per-script spawn timeout — a killed script blocks, never allows. */
const DEFAULT_GATE_TIMEOUT_MS = 30_000;

/** Input shape of the worktree `edit` tool. */
export interface EditToolInput {
	path: string;
	old_string: string;
	new_string: string;
}

/** Input shape of the worktree `writeFile` tool. */
export interface WriteToolInput {
	path: string;
	content: string;
}

/**
 * Adapt an AI SDK edit/writeFile tool-call into the gate scripts'
 * `{ tool_name, tool_input, cwd }` envelope.
 */
export function toGateEnvelope(
	worktreeRoot: string,
	toolName: GatedToolName,
	input: EditToolInput | WriteToolInput,
): GateEnvelope {
	const root = resolve(worktreeRoot);
	const filePath = resolveInWorktree(root, input.path);
	if (toolName === "edit") {
		const { old_string, new_string } = input as EditToolInput;
		return {
			tool_name: "Edit",
			tool_input: { file_path: filePath, old_string, new_string },
			cwd: root,
		};
	}
	const { content } = input as WriteToolInput;
	return {
		tool_name: "Write",
		tool_input: { file_path: filePath, content },
		cwd: root,
	};
}

/**
 * Resolve the gate scripts the way `indusk run` finds them in a consumer
 * project: from the target project's `.claude/hooks/`, walking up from the
 * worktree root. Throws (loud, never silently vacuous) when absent.
 */
export function resolveGateScripts(worktreeRoot: string): string[] {
	let current = resolve(worktreeRoot);
	// Walk up (hard-capped like the hooks' own findStatePath) — the worktree
	// may carry .claude/hooks itself, or the project/workbench root above it
	// does. First ancestor with BOTH scripts wins.
	for (let i = 0; i < 40; i++) {
		const hooksDir = join(current, ".claude", "hooks");
		const candidates = GATE_SCRIPT_NAMES.map((name) => join(hooksDir, name));
		if (candidates.every((p) => existsSync(p))) {
			return candidates;
		}
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	throw new Error(
		`Gate scripts not found: no ancestor of ${resolve(worktreeRoot)} has .claude/hooks/ containing ${GATE_SCRIPT_NAMES.join(
			" + ",
		)}. The target project needs the InDusk hooks installed (indusk init/update), or pass explicit script paths.`,
	);
}

/** Validator first, then gates — mirrors the PreToolUse hook chain. */
const GATE_SCRIPT_NAMES = ["validate-impl-structure.js", "check-gates.js"] as const;

/**
 * Spawn each gate script in order, writing the envelope to stdin.
 *
 * **Fail-loud, not fail-open (T14/T15).** Exit 2 blocks with the script's
 * stderr as the message. Exit 0 allows. EVERYTHING ELSE ALSO BLOCKS: a crash,
 * a malformed impl the script can't parse, or a timeout kill (`null` exit
 * code) means the gate did not answer, and an unattended loop must not read
 * silence as permission. Claude Code's PreToolUse treats non-2 as
 * non-blocking because a human is watching the session; here nobody is, so a
 * disarmed gate would silently void the whole discipline for the rest of the
 * run.
 */
export async function runGateScripts(
	envelope: GateEnvelope,
	scripts: string[],
	options: Pick<GateOptions, "timeoutMs"> = {},
): Promise<GateResult> {
	const payload = JSON.stringify(envelope);
	const timeoutMs = options.timeoutMs ?? DEFAULT_GATE_TIMEOUT_MS;
	for (const script of scripts) {
		const { exitCode, stderr } = await spawnGateScript(script, payload, envelope.cwd, timeoutMs);
		if (exitCode === 2) {
			return {
				allowed: false,
				blockMessage: stderr.trim() || `Blocked by gate script ${script} (exit 2).`,
			};
		}
		if (exitCode === null) {
			return {
				allowed: false,
				blockMessage:
					`Gate script ${script} timed out after ${timeoutMs}ms (killed before it answered) — refusing the edit. ` +
					"A gate that cannot answer is not permission." +
					(stderr.trim() ? `\n${stderr.trim()}` : ""),
			};
		}
		if (exitCode !== 0) {
			return {
				allowed: false,
				blockMessage:
					`Gate script ${script} exited ${exitCode} (not 0/2) — refusing the edit rather than treating a broken gate as allow.` +
					(stderr.trim() ? `\n${stderr.trim()}` : ""),
			};
		}
	}
	return { allowed: true };
}

/** Spawn one gate script, write the envelope to stdin, collect exit + stderr. */
function spawnGateScript(
	script: string,
	payload: string,
	cwd: string,
	timeoutMs: number,
): Promise<{ exitCode: number | null; stderr: string }> {
	return new Promise((resolvePromise, rejectPromise) => {
		// --no-warnings keeps Node module-type warnings out of the block message
		// (the hooks are ESM .js files whose consumer package.json may not set
		// "type": "module" — Node 22 detects the syntax but warns on stderr).
		const child = spawn(process.execPath, ["--no-warnings", script], {
			cwd,
			stdio: ["pipe", "ignore", "pipe"],
			timeout: timeoutMs,
		});
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", rejectPromise);
		child.on("close", (code) => {
			resolvePromise({ exitCode: code, stderr });
		});
		child.stdin.on("error", () => {
			// Script exited before reading stdin (e.g. fast-path allow) — EPIPE
			// here is fine; the close handler still resolves with the exit code.
		});
		child.stdin.write(payload);
		child.stdin.end();
	});
}

/**
 * PRIMARY enforcement: the worktree tool set with edit/writeFile execute
 * owned by the gate — spawn scripts, apply on exit 0, refuse (returning the
 * block message as the tool result) on exit 2.
 */
export function createGatedWorktreeTools(worktreeRoot: string, options: GateOptions = {}): ToolSet {
	const root = resolve(worktreeRoot);
	const scripts = options.scripts ?? resolveGateScripts(root);
	const timeoutMs = options.timeoutMs;
	const base = createWorktreeTools(root);
	const gated: ToolSet = { ...base };

	for (const name of GATED_TOOL_NAMES) {
		const original = base[name];
		const originalExecute = (original as { execute?: ToolExecuteFn }).execute;
		if (!originalExecute) {
			throw new Error(`Worktree tool "${name}" has no execute to gate.`);
		}
		gated[name] = {
			...original,
			execute: async (input: unknown, executionOptions: unknown) => {
				const envelope = toGateEnvelope(root, name, input as EditToolInput | WriteToolInput);
				const gate = await runGateScripts(envelope, scripts, { timeoutMs });
				if (!gate.allowed) {
					// The block message IS the tool result — the model reads it and
					// corrects course. The edit was never applied.
					return `Gate blocked this ${name} — the change was NOT applied.\n${gate.blockMessage}`;
				}
				return originalExecute(input, executionOptions);
			},
		} as ToolSet[string];
	}

	gated.bash = gateBashTool(base.bash, root, scripts, timeoutMs);

	return gated;
}

/**
 * Gate the `bash` write surface (T10/T11).
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
 *      store). Real confinement needs the sandboxed run cell (roadmap). Never
 *      describe this guard as a sandbox.
 *   2. **Post-hoc gating (T10)** — gate-relevant files (`impl.md`) are hashed
 *      before the command and re-checked after. A mutation is replayed through
 *      the SAME gate envelope the edit tool uses; if the gate refuses, the file
 *      is restored and the block message becomes the tool result. The gate
 *      still decides; only the moment of asking moves.
 */
function gateBashTool(
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

				const gate = await runGateScripts(
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

/** Files the gate scripts have opinions about — cheap to hash, worth watching. */
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

/** Hash-free content snapshot of every gate-relevant file under the root. */
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

const GATED_TOOL_NAMES: readonly GatedToolName[] = ["edit", "writeFile"];

type ToolExecuteFn = (input: unknown, executionOptions: unknown) => unknown;

/**
 * SECONDARY enforcement: an AI SDK `toolApproval` configuration that runs the
 * same gate chain above the provider swap and denies blocked calls.
 */
export function createGateToolApproval(
	worktreeRoot: string,
	options: GateOptions = {},
): Record<
	GatedToolName,
	(input: unknown, approvalOptions: unknown) => Promise<ToolApprovalStatus>
> {
	const root = resolve(worktreeRoot);
	const scripts = options.scripts ?? resolveGateScripts(root);

	const approvalFor =
		(name: GatedToolName) =>
		async (input: unknown, _approvalOptions: unknown): Promise<ToolApprovalStatus> => {
			const envelope = toGateEnvelope(root, name, input as EditToolInput | WriteToolInput);
			const gate = await runGateScripts(envelope, scripts);
			if (!gate.allowed) {
				return { type: "denied", reason: gate.blockMessage };
			}
			return "approved";
		};

	return {
		edit: approvalFor("edit"),
		writeFile: approvalFor("writeFile"),
	};
}
