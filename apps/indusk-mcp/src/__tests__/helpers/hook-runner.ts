import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Drives the PreToolUse hooks as black boxes — spawn, feed a `{tool_name,
 * tool_input, cwd}` envelope on stdin, read the exit code and stderr.
 *
 * The hooks are the enforcement surface, and they are the *only* surface both
 * lanes share. Testing them through their real entry point rather than through
 * an imported function is what makes a test-phase assertion authorable before
 * any of this plan's code exists: nothing here imports a symbol the plan
 * creates, so nothing here is a compile error today.
 */

const HOOKS_DIR = new URL("../../../hooks/", import.meta.url).pathname;

export interface HookResult {
	exitCode: number;
	stderr: string;
}

export type HookName = "validate-impl-structure.js" | "check-gates.js" | "claude-md-budget.js";

export function runHook(hook: HookName, event: unknown): Promise<HookResult> {
	return spawnHook(hook, event);
}

function spawnHook(hook: string, event: unknown): Promise<HookResult> {
	return new Promise((resolve, reject) => {
		const child = spawn("node", [join(HOOKS_DIR, hook)], { stdio: ["pipe", "pipe", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ exitCode: code ?? 0, stderr }));
		child.stdin.end(JSON.stringify(event));
	});
}

/** A temp project directory holding one `impl.md`. Caller disposes. */
export interface ImplFixture {
	dir: string;
	implPath: string;
	dispose(): void;
}

/**
 * Lays out a temp project the way the hooks expect to find one: they resolve
 * config by walking up from the impl's directory, so a bare `impl.md` in a
 * temp dir gets the *default* project profile rather than this one — and the
 * default enables the OTel gate, which would fail every fixture here for a
 * reason that has nothing to do with what it asserts. `role: "library"` is
 * dusk's own setting.
 */
export function writeImpl(content: string, prefix = "impl-fixture-"): ImplFixture {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	const planDir = join(dir, ".indusk", "planning", "demo");
	mkdirSync(planDir, { recursive: true });
	writeFileSync(
		join(dir, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
		"utf8",
	);
	const implPath = join(planDir, "impl.md");
	writeFileSync(implPath, content, "utf8");
	return {
		dir,
		implPath,
		dispose: () => rmSync(dir, { recursive: true, force: true }),
	};
}

/**
 * Validate `content` as if it were being written to `impl.md`.
 *
 * The file need not exist — `validate-impl-structure` reads the content out of
 * the event, which is what makes it a *write-time* rule.
 */
export async function validateWrite(content: string): Promise<HookResult> {
	const fixture = writeImpl(content);
	try {
		return await spawnHook("validate-impl-structure.js", {
			tool_name: "Write",
			tool_input: { file_path: fixture.implPath, content },
			cwd: fixture.dir,
		});
	} finally {
		fixture.dispose();
	}
}

/**
 * Ask the gate hook to allow a transition from `before` to `after`.
 *
 * `before` lands on disk first: `check-gates` compares the incoming content
 * against the file to decide whether a box was newly checked, so a fixture that
 * skips the on-disk state is not testing a transition at all.
 */
export async function gateTransition(before: string, after: string): Promise<HookResult> {
	const fixture = writeImpl(before, "gate-fixture-");
	try {
		return await spawnHook("check-gates.js", {
			tool_name: "Write",
			tool_input: { file_path: fixture.implPath, content: after },
			cwd: fixture.dir,
		});
	} finally {
		fixture.dispose();
	}
}

/** Flip the first occurrence of `- [ ] {marker}` to checked. */
export function check(content: string, marker: string): string {
	const needle = `- [ ] ${marker}`;
	const at = content.indexOf(needle);
	if (at === -1) throw new Error(`fixture has no unchecked item matching: ${marker}`);
	return `${content.slice(0, at)}- [x] ${marker}${content.slice(at + needle.length)}`;
}
