import { spawn } from "node:child_process";
import { resolve } from "node:path";
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
}

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
export function resolveGateScripts(_worktreeRoot: string): string[] {
	throw new Error("not implemented (Phase 2)");
}

/**
 * Spawn each gate script in order, writing the envelope to stdin. Exit 2
 * blocks (stderr is the block message); any other exit allows — PreToolUse
 * parity, where non-2 non-zero is a non-blocking script error.
 */
export async function runGateScripts(
	envelope: GateEnvelope,
	scripts: string[],
): Promise<GateResult> {
	const payload = JSON.stringify(envelope);
	for (const script of scripts) {
		const { exitCode, stderr } = await spawnGateScript(script, payload, envelope.cwd);
		if (exitCode === 2) {
			return {
				allowed: false,
				blockMessage: stderr.trim() || `Blocked by gate script ${script} (exit 2).`,
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
): Promise<{ exitCode: number | null; stderr: string }> {
	return new Promise((resolvePromise, rejectPromise) => {
		// --no-warnings keeps Node module-type warnings out of the block message
		// (the hooks are ESM .js files whose consumer package.json may not set
		// "type": "module" — Node 22 detects the syntax but warns on stderr).
		const child = spawn(process.execPath, ["--no-warnings", script], {
			cwd,
			stdio: ["pipe", "ignore", "pipe"],
			timeout: 30_000,
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
				const gate = await runGateScripts(envelope, scripts);
				if (!gate.allowed) {
					// The block message IS the tool result — the model reads it and
					// corrects course. The edit was never applied.
					return `Gate blocked this ${name} — the change was NOT applied.\n${gate.blockMessage}`;
				}
				return originalExecute(input, executionOptions);
			},
		} as ToolSet[string];
	}

	return gated;
}

const GATED_TOOL_NAMES: readonly GatedToolName[] = ["edit", "writeFile"];

type ToolExecuteFn = (input: unknown, executionOptions: unknown) => unknown;

/**
 * SECONDARY enforcement: an AI SDK `toolApproval` configuration that runs the
 * same gate chain above the provider swap and denies blocked calls.
 */
export function createGateToolApproval(
	_worktreeRoot: string,
	_options: GateOptions = {},
): Record<GatedToolName, (input: unknown, approvalOptions: unknown) => Promise<ToolApprovalStatus>> {
	throw new Error("not implemented (Phase 2)");
}
