import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared test harness for the `run` suite (Phase 7).
 *
 * Extracted because four test files — gate, falsification, loop, swap — each
 * redeclared the same constants and three repeated the same temp-worktree
 * setup verbatim. Rule of three, exceeded.
 *
 * Named `*.test-support.ts` rather than `*.test.ts` so vitest's `include`
 * glob does not try to run a file with no tests in it.
 */

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root — four levels up from `src/lib/run/`. */
export const repoRoot = resolve(here, "../../../../..");

/** This repo's installed hooks — the REAL gate scripts, never mocked. */
export const hooksDir = join(repoRoot, ".claude/hooks");

/** Validator first, then gates — the PreToolUse chain order. */
export const realGateScripts = [
	join(hooksDir, "validate-impl-structure.js"),
	join(hooksDir, "check-gates.js"),
];

/** The guinea-pig reference plan every end-to-end test runs against. */
export const fixtureDir = resolve(here, "../../../fixtures/guinea-pig-semver");

/** Minimal stand-in for the AI SDK's ToolExecutionOptions second argument. */
export const execOptions = { toolCallId: "call-1", messages: [] };

export type Exec = (input: unknown, options: unknown) => Promise<unknown>;

/** Pull a tool's `execute` out of a ToolSet, failing loudly if absent. */
export function executeOf(toolSet: Record<string, unknown>, name: string): Exec {
	const candidate = (toolSet[name] as { execute?: Exec } | undefined)?.execute;
	if (!candidate) throw new Error(`tool ${name} has no execute`);
	return candidate;
}

export interface TempWorktree {
	/** Absolute path to the worktree root. */
	root: string;
	/** Remove the worktree — call from `afterEach`. */
	cleanup: () => Promise<void>;
}

/**
 * A temp worktree carrying the real `.claude/hooks` and a pristine copy of the
 * guinea-pig fixture, so `resolveGateScripts` finds real scripts and the gate
 * has a real impl to have opinions about.
 *
 * @param prefix mkdtemp prefix, so a leaked directory names its own test
 * @param options.fixtureAt where the fixture lands: a subdirectory name, or
 *   `"root"` to copy it directly into the worktree root
 */
export async function makeGatedWorktree(
	prefix: string,
	options: { fixtureAt?: string | "root" } = {},
): Promise<TempWorktree> {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await mkdir(join(root, ".claude"), { recursive: true });
	await cp(hooksDir, join(root, ".claude/hooks"), { recursive: true });

	const fixtureAt = options.fixtureAt ?? "guinea-pig";
	await cp(fixtureDir, fixtureAt === "root" ? root : join(root, fixtureAt), { recursive: true });

	return {
		root,
		cleanup: () => rm(root, { recursive: true, force: true }),
	};
}
