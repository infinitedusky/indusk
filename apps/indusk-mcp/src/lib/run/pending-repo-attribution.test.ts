import { execFile } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
	oneRepoAtPath,
	type VersionedWorkbench,
} from "../../__tests__/helpers/versioned-workbench.js";
import { hooksDir } from "./harness.test-support.js";
import type { PendingEvalRecord } from "./pending-evals.js";

/**
 * dawn-workbench-execution — A12.
 *
 * The loop knows which repository each commit landed in. Today the queued
 * record does not say, so the drain's evaluator resolves a git root by walking
 * up from the workbench and attributing by newer HEAD — a guess where a fact
 * was available. A record that carries `repo` must reach the evaluator as its
 * git root; a record without one must drain exactly as before.
 *
 * Driven through the installed hook path (`eval-trigger.js --drain-pending`)
 * with the evaluator replaced by a stub that records what it was handed.
 */

const execFileAsync = promisify(execFile);

let wb: VersionedWorkbench | null = null;
afterEach(() => {
	wb?.cleanup();
	wb = null;
});

describe("A12 — queued evals name their repo, and the drain honours it", () => {
	it("passes a record's repo to the evaluator; a record without one gets nothing extra", async () => {
		wb = oneRepoAtPath("nested", { extraConfig: { eval: { enabled: true } } });
		const codeRepo = realpathSync(wb.repos[0].dir);

		mkdirSync(join(wb.root, ".claude"), { recursive: true });
		cpSync(hooksDir, join(wb.root, ".claude", "hooks"), { recursive: true });

		const withRepo = {
			sha: "a".repeat(40),
			plan: "semver",
			phase: 1,
			source: "atdawn",
			timestamp: new Date().toISOString(),
			repo: codeRepo,
		};
		const legacy: PendingEvalRecord = {
			sha: "b".repeat(40),
			plan: "semver",
			phase: 1,
			source: "atdawn",
			timestamp: new Date().toISOString(),
		};
		const evalDir = join(wb.root, ".indusk", "eval");
		mkdirSync(evalDir, { recursive: true });
		writeFileSync(
			join(evalDir, "pending.jsonl"),
			`${JSON.stringify(withRepo)}\n${JSON.stringify(legacy)}\n`,
		);

		// The stub records argv and cwd per invocation, one JSON line each.
		const log = join(wb.root, "stub.log");
		const stub = join(wb.root, "stub-eval.mjs");
		writeFileSync(
			stub,
			[
				'import { appendFileSync } from "node:fs";',
				`appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }) + "\\n");`,
			].join("\n"),
		);

		await execFileAsync(
			process.execPath,
			["--no-warnings", join(wb.root, ".claude", "hooks", "eval-trigger.js"), "--drain-pending"],
			{
				cwd: wb.root,
				env: { ...process.env, INDUSK_EVAL_CMD: `${process.execPath} ${stub}` },
			},
		);

		const calls = readFileSync(log, "utf-8")
			.trim()
			.split("\n")
			.map((l) => JSON.parse(l) as { argv: string[]; cwd: string });
		const bySha = new Map(calls.map((c) => [c.argv[0], c]));

		const first = bySha.get(withRepo.sha);
		expect(first, "the record with a repo was not evaluated").toBeDefined();
		expect(first?.argv).toEqual([withRepo.sha, "atdawn", codeRepo]);

		const second = bySha.get(legacy.sha);
		expect(second, "the legacy record was not evaluated").toBeDefined();
		expect(second?.argv).toEqual([legacy.sha, "atdawn"]);
	}, 60_000);
});
