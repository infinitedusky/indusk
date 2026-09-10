import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import {
	commitFile,
	oneRepoAtPath,
	twoRepos,
	type VersionedWorkbench,
} from "./helpers/versioned-workbench.js";

/**
 * workbench-trust-fixes A7 + A8 — the evaluator never scores the workbench
 * repository, and says so in the session when it must refuse.
 *
 * `eval-trigger.js` finds the repo to score by walking up from the session's
 * cwd to the nearest git root. In a versioned workbench the nearest root IS
 * the workbench, whose history holds plan documents and no code. The
 * multi-repo refusal written for the pre-1.37 shape is unreachable now, and
 * `declaredReposAt`, the helper that would name the candidates, has never
 * been called.
 *
 * The evaluator spawn is a detached `node` child that looks for `claude` on
 * PATH. The cases that reach it run with a PATH holding only node and the
 * system bins, so the spawn logs a failure instead of launching an evaluator
 * against a temp directory.
 */

function commitEvent(cwd: string) {
	return {
		cwd,
		tool_name: "Bash",
		tool_input: { command: 'git commit -m "test"' },
		tool_response: { exit_code: 0 },
	};
}

const QUIET_PATH = `${dirname(process.execPath)}:/usr/bin:/bin`;

function systemLog(wb: VersionedWorkbench): string {
	const path = join(wb.root, ".indusk", "eval", "system.log");
	expect(existsSync(path), "system.log was not written under the workbench root").toBe(true);
	return readFileSync(path, "utf-8");
}

describe("A7 — a commit from a cwd at the workbench root", () => {
	let wb: VersionedWorkbench;
	afterEach(() => wb?.cleanup());

	it("one declared repo: resolves gitPath to that repo at its declared path, never the root", async () => {
		wb = oneRepoAtPath("nested", { extraConfig: { eval: { enabled: false } } });
		commitFile(wb.repos[0].dir, "src/a.ts", "export const a = 1;\n", "feat: a");

		const r = await runHook("eval-trigger.js", commitEvent(wb.root), { cwd: wb.root });
		expect(r.exitCode).toBe(0);

		const log = systemLog(wb);
		const line = log.split("\n").find((l) => l.includes("gitPath:"));
		expect(line, `no gitPath line in system.log:\n${log}`).toBeDefined();
		const codeRepo = realpathSync(wb.repos[0].dir);
		expect(line).toContain(`gitPath: ${codeRepo}`);
		expect(line).not.toContain(`gitPath: ${realpathSync(wb.root)},`);
	});

	it("two declared repos: refuses to pick, naming both, and does not attribute to the root", async () => {
		wb = twoRepos("nested", { extraConfig: { eval: { enabled: true } } });

		const r = await runHook("eval-trigger.js", commitEvent(wb.root), {
			cwd: wb.root,
			env: { PATH: QUIET_PATH },
		});
		expect(r.exitCode).toBe(0);

		const log = systemLog(wb);
		expect(log).not.toContain(`gitPath: ${realpathSync(wb.root)},`);
		expect(log).toMatch(/refus/i);
		expect(log).toContain("alpha");
		expect(log).toContain("beta");
	});
});

describe("A8 — the refusal reaches the session, not only system.log", () => {
	let wb: VersionedWorkbench;
	afterEach(() => wb?.cleanup());

	it("stdout carries a PostToolUse envelope whose additionalContext names both repos", async () => {
		wb = twoRepos("nested", { extraConfig: { eval: { enabled: true } } });

		const r = await runHook("eval-trigger.js", commitEvent(wb.root), {
			cwd: wb.root,
			env: { PATH: QUIET_PATH },
		});
		expect(r.exitCode).toBe(0);
		expect(r.stdout.trim(), "the hook wrote nothing to stdout").not.toBe("");
		const parsed = JSON.parse(r.stdout) as {
			hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
		};
		const ctx = parsed.hookSpecificOutput?.additionalContext ?? "";
		expect(parsed.hookSpecificOutput?.hookEventName).toBe("PostToolUse");
		expect(ctx).toContain("alpha");
		expect(ctx).toContain("beta");
	});
});
