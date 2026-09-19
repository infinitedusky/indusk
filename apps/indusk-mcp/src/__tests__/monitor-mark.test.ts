import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { REPO_ROOT, SHOULD_SKIP } from "./helpers/cli.js";
import {
	BAD_MODEL_MESSAGE,
	type CapturedSpan,
	fakeClaudeDir,
	type OtlpCapture,
	startOtlpCapture,
} from "./helpers/otlp-capture.js";
import { promiseProject } from "./helpers/promises-fixture.js";
import { headOf } from "./helpers/test-git.js";

/**
 * day-monitor — A2, A3: the evaluator marks `every-commit-evaluated`.
 *
 * The evaluator is reached the way the commit hook reaches it: the hook's CLI
 * mode spawns the detached evaluator, which calls `claude` from `PATH` — here
 * a fake — and exports whatever it exports to `OTEL_EXPORTER_OTLP_ENDPOINT`,
 * here a capture server. The assertions read the exported OTLP payload only:
 * "which promise broke" must be readable from the raw trace, without InDusk.
 *
 * Red today on its own assertion: the evaluator exports its `eval.*` spans,
 * but none carries `indusk.promise`. Green after Build Phase 1.
 */

const HOOK = join(REPO_ROOT, "apps/indusk-mcp/hooks/eval-trigger.js");
const PROMISE = "every-commit-evaluated";

function isMarked(s: CapturedSpan): boolean {
	return Object.keys(s.attributes).some((k) => k.startsWith("indusk.promise"));
}

/** Run one evaluation through the hook and return every span it exported. */
async function evaluate(mode: "bad-model" | "scorecard"): Promise<{
	spans: CapturedSpan[];
	results: string;
}> {
	const capture: OtlpCapture = await startOtlpCapture();
	const project = promiseProject({ domains: ["gates"] });
	const fake = fakeClaudeDir(mode);
	try {
		const sha = headOf(project.root);
		const env: NodeJS.ProcessEnv = {
			...process.env,
			PATH: `${fake}:${process.env.PATH}`,
			INDUSK_EVAL_OTEL: "1",
			OTEL_EXPORTER_OTLP_ENDPOINT: capture.endpoint,
			INDUSK_SKIP_UPDATE_CHECK: "1",
		};
		delete env.OTEL_EXPORTER_OTLP_HEADERS;
		delete env.DASH0_API_TOKEN;
		delete env.CLAUDE_TRANSCRIPT_PATH;
		const hook = spawnSync("node", [HOOK, "--source", "test", "--change-id", sha], {
			cwd: project.root,
			env,
			encoding: "utf-8",
		});
		if (hook.status !== 0) throw new Error(`eval hook exited ${hook.status}: ${hook.stderr}`);

		// The evaluator is detached: wait for its result, then for its root span.
		const resultsPath = join(project.root, ".indusk", "eval", "results.log");
		const deadline = Date.now() + 60_000;
		while (!existsSync(resultsPath) || readFileSync(resultsPath, "utf-8").trim() === "") {
			if (Date.now() > deadline) {
				const syslog = join(project.root, ".indusk", "eval", "system.log");
				throw new Error(
					`no evaluator result after 60s; system.log:\n${existsSync(syslog) ? readFileSync(syslog, "utf-8") : "(none)"}`,
				);
			}
			await new Promise((r) => setTimeout(r, 250));
		}
		await capture.waitForSpans(1, 30_000);
		// The batch processor flushes at shutdown, after results.log; give the last batch a beat.
		await new Promise((r) => setTimeout(r, 1_000));
		return { spans: capture.spans(), results: readFileSync(resultsPath, "utf-8") };
	} finally {
		await capture.close();
		rmSync(project.root, { recursive: true, force: true });
		rmSync(fake, { recursive: true, force: true });
	}
}

describe.skipIf(SHOULD_SKIP)("day-monitor — the evaluator's mark", () => {
	let failed: { spans: CapturedSpan[]; results: string };
	let scored: { spans: CapturedSpan[]; results: string };

	beforeAll(async () => {
		[failed, scored] = await Promise.all([evaluate("bad-model"), evaluate("scorecard")]);
	}, 120_000);

	it("preconditions: the failing run wrote an error, the scoring run a scorecard, and both exported spans", () => {
		expect(failed.results).toContain('"error":true');
		expect(scored.results).toContain("fixture scorecard");
		expect(failed.spans.length).toBeGreaterThan(0);
		expect(scored.spans.length).toBeGreaterThan(0);
	});

	it("A2 — a failing run's raw span says every-commit-evaluated was violated, and why", () => {
		const marked = failed.spans.filter((s) => s.attributes["indusk.promise"] === PROMISE);
		expect(marked, "a span carrying indusk.promise=every-commit-evaluated").toHaveLength(1);
		const [span] = marked;
		expect(span.attributes["indusk.promise.outcome"]).toBe("violated");
		const event = span.events.find((e) => e.name === "indusk.promise.violated");
		expect(event, "the indusk.promise.violated event").toBeDefined();
		expect(String(event?.attributes["indusk.promise.symptom"])).toContain(
			BAD_MODEL_MESSAGE.slice(0, 40),
		);
	});

	it("A3 — a run exports exactly one marked span; no other span carries the mark", () => {
		for (const run of [failed, scored]) {
			const marked = run.spans.filter(isMarked);
			expect(marked, "exactly one span names a promise").toHaveLength(1);
			expect(marked[0].attributes["indusk.promise"]).toBe(PROMISE);
		}
		const upheld = scored.spans.filter(isMarked)[0];
		expect(upheld.attributes["indusk.promise.outcome"]).toBe("upheld");
		expect(upheld.events.some((e) => e.name === "indusk.promise.violated")).toBe(false);
	});
});
