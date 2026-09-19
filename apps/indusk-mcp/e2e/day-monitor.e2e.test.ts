import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLI_BIN, REPO_ROOT, runCli } from "../src/__tests__/helpers/cli.js";
import { type LocalJaeger, startLocalJaeger } from "../src/__tests__/helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "../src/__tests__/helpers/promises-fixture.js";
import { headOf } from "../src/__tests__/helpers/test-git.js";

/**
 * day-monitor — A24, end to end (ADR D10).
 *
 * The whole loop, with nothing stubbed: a scratch project whose registry is
 * green points `eval.model` at a model that does not exist; the commit hook's
 * CLI mode runs the **real** evaluator with the **real** `claude` CLI, which
 * fails; the evaluator marks `every-commit-evaluated` violated and exports it
 * to the local-telemetry extension's daemon — found through `$INDUSK_HOME`,
 * with no exporter configured by hand; `indusk promises watch` reads it back
 * from Jaeger, opens an incident with source `local`, and reopens the owning
 * plan with a Maintenance phase.
 *
 * The daemon is started in a home this test owns, so a deliberate violation
 * never lands in the developer's own Jaeger. Needs the `claude` CLI on PATH
 * and the platform's telemetry binaries; run with `pnpm e2e`.
 */

const PROMISE = "every-commit-evaluated";
const OWNER = "evaluator-origin";
const BAD_MODEL = "claude-does-not-exist-9";
const HOOK = join(REPO_ROOT, "apps/indusk-mcp/hooks/eval-trigger.js");

const OWNER_IMPL = `---
title: "${OWNER}"
status: completed
---

# ${OWNER}

## Checklist

### Phase 1: Evaluate every commit

- [x] The commit hook spawns the evaluator

#### Phase 1 Verification

- [x] The evaluator writes a scorecard for a commit

#### Phase 1 Context

- [x] Noted

#### Phase 1 Document

- [x] The evaluator page
`;

function claudeOnPath(): boolean {
	return spawnSync("claude", ["--version"], { encoding: "utf-8" }).status === 0;
}

async function until<T>(what: string, ms: number, probe: () => T | null): Promise<T> {
	const deadline = Date.now() + ms;
	for (;;) {
		const v = probe();
		if (v !== null) return v;
		if (Date.now() > deadline) throw new Error(`timed out after ${ms}ms waiting for ${what}`);
		await new Promise((r) => setTimeout(r, 500));
	}
}

describe("A24 — a broken evaluator is found from telemetry and reopens its owner", () => {
	let jaeger: LocalJaeger;
	let scratch: PromiseProject;

	beforeAll(async () => {
		if (!existsSync(CLI_BIN)) throw new Error(`the CLI is not built at ${CLI_BIN} — run pnpm e2e`);
		if (!claudeOnPath()) throw new Error("the `claude` CLI is not on PATH — this test runs the real one");
		jaeger = await startLocalJaeger();
		scratch = promiseProject({
			domains: ["gates"],
			landed: { [OWNER]: daysAgo(30) },
			planFiles: { [`archive/${OWNER}/impl.md`]: OWNER_IMPL },
			promises: [
				{
					name: PROMISE,
					kind: "behaviour",
					state: "enforced",
					domain: "gates",
					owner: OWNER,
					statement: "Every commit the evaluator is asked to score is scored.",
					sites: ["src/evaluator.ts"],
					tests: ["src/evaluator.test.ts"],
				},
			],
			files: {
				"src/evaluator.ts": siteFile(PROMISE),
				"src/evaluator.test.ts": testFile(PROMISE),
				// The evaluator passes `--mcp-config .mcp.json`; without one the
				// CLI fails on that first, and this test breaks on the model.
				".mcp.json": '{ "mcpServers": {} }\n',
			},
			extraConfig: { eval: { model: BAD_MODEL } },
		});
	}, 120_000);

	afterAll(() => {
		jaeger?.stop();
		for (const dir of [jaeger?.home, scratch?.root]) {
			if (dir) rmSync(dir, { recursive: true, force: true });
		}
	});

	it("runs the loop: green registry → failed evaluation → violated mark in Jaeger → incident (local) → Maintenance phase", async () => {
		const home = { INDUSK_HOME: jaeger.home };

		// 1. The suite is green before the break.
		const before = runCli(scratch.root, ["promises", "check"], home);
		expect(before.code, before.stderr).toBe(0);

		// 2. A commit, evaluated by the real evaluator with a model that does not exist.
		execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "a commit to evaluate"], {
			cwd: scratch.root,
			env: {
				...process.env,
				GIT_AUTHOR_NAME: "e2e",
				GIT_AUTHOR_EMAIL: "e2e@test.local",
				GIT_COMMITTER_NAME: "e2e",
				GIT_COMMITTER_EMAIL: "e2e@test.local",
			},
		});
		const env: NodeJS.ProcessEnv = { ...process.env, ...home, INDUSK_SKIP_UPDATE_CHECK: "1" };
		// Nothing configures an exporter: the mark must reach the daemon by default.
		delete env.OTEL_EXPORTER_OTLP_ENDPOINT;
		delete env.OTEL_EXPORTER_OTLP_HEADERS;
		delete env.INDUSK_EVAL_OTEL;
		const hook = spawnSync(
			"node",
			[HOOK, "--source", "e2e", "--change-id", headOf(scratch.root)],
			{ cwd: scratch.root, env, encoding: "utf-8" },
		);
		expect(hook.status, hook.stderr).toBe(0);

		const results = join(scratch.root, ".indusk", "eval", "results.log");
		const failure = await until("the evaluator's result", 120_000, () =>
			existsSync(results) && readFileSync(results, "utf-8").trim() !== ""
				? readFileSync(results, "utf-8")
				: null,
		);
		expect(failure).toContain('"error":true');
		expect(failure).toContain("issue with the selected model");

		// 3. The violation is in Jaeger, under this project.
		const status = await until("the violation in Jaeger", 60_000, () => {
			const r = runCli(scratch.root, ["promises", "status"], home);
			return r.code === 0 && /1 violation\b/.test(r.stdout) ? r.stdout : null;
		});
		expect(status).toContain("issue with the selected model");

		// 4. One monitor pass.
		const watch = runCli(scratch.root, ["promises", "watch"], home);
		expect(watch.code, watch.stderr).toBe(0);

		const dir = join(scratch.root, ".indusk", "promises", "incidents");
		const incidents = readdirSync(dir).filter((n) => n.includes(PROMISE));
		expect(incidents).toHaveLength(1);
		const incident = matter(readFileSync(join(dir, incidents[0]), "utf-8"));
		expect(incident.data.source).toBe("local");
		expect(incident.data.status).toBe("open");
		expect(incident.content).toContain("issue with the selected model");

		const impl = readFileSync(
			join(scratch.root, ".indusk", "planning", "archive", OWNER, "impl.md"),
			"utf-8",
		);
		expect(impl).toMatch(
			new RegExp(`^### Build Phase 2: Maintenance — ${incidents[0].replace(/\.md$/, "")}$`, "m"),
		);

		// The registry still passes, now carrying the incident.
		const after = runCli(scratch.root, ["promises", "check"], home);
		expect(after.code, after.stderr).toBe(0);
	});
});
