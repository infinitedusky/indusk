import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T4 regression suite: every failure path in the evaluator pipeline writes
 * an identifiable entry to `results.log` — no silent exits.
 *
 * Source files under audit:
 *  - apps/indusk-mcp/hooks/eval-trigger.js (the spawned inline script)
 *  - apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts (main evaluator)
 *  - apps/indusk-mcp/src/lib/eval/evaluator-runner.ts (sync/background variants)
 *
 * The test is grep-based and source-level: it asserts the shape of catch
 * handlers in each file. Runtime behavior is covered by the hook regression
 * suite and the persistent-evaluator unit tests.
 */

const HOOK_PATH = resolve(__dirname, "../../hooks/eval-trigger.js");
const PERSISTENT_PATH = resolve(__dirname, "../lib/eval/persistent-evaluator.ts");
const RUNNER_PATH = resolve(__dirname, "../lib/eval/evaluator-runner.ts");

describe("T4: silent-exits-become-loud hardening", () => {
	it("hook script registers a process-level uncaughtException handler", () => {
		const body = readFileSync(HOOK_PATH, "utf-8");
		expect(body).toMatch(/process\.on\(\s*["']uncaughtException["']/);
	});

	it("hook script registers a process-level unhandledRejection handler", () => {
		const body = readFileSync(HOOK_PATH, "utf-8");
		expect(body).toMatch(/process\.on\(\s*["']unhandledRejection["']/);
	});

	it("hook script's uncaughtException/unhandledRejection handlers write to results.log via writeErrorResult", () => {
		const body = readFileSync(HOOK_PATH, "utf-8");
		expect(body).toMatch(/function\s+writeErrorResult/);
		expect(body).toMatch(/writeErrorResult\([^)]*uncaughtException/);
		expect(body).toMatch(/writeErrorResult\([^)]*unhandledRejection/);
	});

	it("hook script's .catch() terminal handler also writes to results.log", () => {
		const body = readFileSync(HOOK_PATH, "utf-8");
		// The final .catch in the inline script's import(...).then().then().catch chain
		// must route through writeErrorResult, not just log-and-exit.
		expect(body).toMatch(/evaluator crashed[\s\S]{0,300}writeErrorResult/);
	});

	it("persistent-evaluator outer try/catch writes an EvalErrorEntry to the log writer", () => {
		const body = readFileSync(PERSISTENT_PATH, "utf-8");
		// The top-level eval work is wrapped in a try/catch that builds an
		// EvalErrorEntry and calls logWriter.append(errorEntry).
		expect(body).toMatch(
			/catch\s*\(err\)[\s\S]{0,600}EvalErrorEntry[\s\S]{0,200}logWriter\.append\(errorEntry\)/,
		);
	});

	it("evaluator-runner close-handler catch writes an EvalErrorEntry", () => {
		const body = readFileSync(RUNNER_PATH, "utf-8");
		// Both runEvaluatorBackground and runEvaluatorSync have a close handler
		// with a catch that writes an error entry.
		const errorAppends = body.match(/logWriter\.append\(errorEntry\)/g) ?? [];
		expect(errorAppends.length).toBeGreaterThanOrEqual(2);
	});

	it("no bare `} catch {}` with no body exists inside main run paths (empty catches are limited to intentionally-silent fallbacks)", () => {
		// The dangerous pattern is `} catch { }` (or `} catch {\n}`) with no
		// body at all in a main execution path. Parse fallbacks and
		// fire-and-forget telemetry catches are OK (they have a comment
		// explaining the silence). Grep-assert those comments exist.
		for (const p of [PERSISTENT_PATH, RUNNER_PATH]) {
			const body = readFileSync(p, "utf-8");
			// Every empty catch block must be immediately followed within 200 chars
			// by an explanatory comment (e.g., "// fire-and-forget", "// raw output").
			const emptyCatches = [...body.matchAll(/\}\s*catch\s*\{\s*(?:\/\/[^\n]*)?\s*\}/g)];
			for (const m of emptyCatches) {
				const surrounding = body.slice(m.index ?? 0, (m.index ?? 0) + 200);
				// Either the catch has an inline comment or nothing between braces
				// (which is the dangerous case). Flag any empty catch whose body is
				// truly empty with no explanation.
				const body_between = m[0].match(/\{([\s\S]*?)\}/)?.[1] ?? "";
				if (body_between.trim() === "") {
					// Fully empty. Must have an inline-before comment within the same line.
					const beforeStart = (m.index ?? 0) - 200;
					const before = body.slice(Math.max(0, beforeStart), m.index ?? 0);
					expect(
						before.includes("//") || surrounding.includes("//"),
						`Empty catch block at offset ${m.index} in ${p} has no explanatory comment — silent swallow`,
					).toBe(true);
				}
			}
		}
	});
});
