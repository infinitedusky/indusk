/**
 * Evaluator runner — spawns a background `claude --print` process that evaluates
 * a commit and writes results to the eval log.
 *
 * The evaluator is a detached child process so the calling hook can exit immediately.
 * Results appear asynchronously in `.indusk/eval/results.log`.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

import { getProjectGroupId } from "../config.js";
import { ingestScorecard } from "./findings.js";
import { EvalLogWriter } from "./log-writer.js";
import { initEvalOtel, shutdownEvalOtel, withSpan } from "./otel.js";
import { buildEvaluatorPrompt } from "./prompt-builder.js";
import { V1_RUBRIC } from "./rubric.js";
import type { EvalErrorEntry, EvalScorecard } from "./types.js";

export interface EvaluatorRunOptions {
	projectRoot: string;
	changeId: string;
	transcriptPath: string;
	mode: "eval" | "baseline";
	evalEndpoint?: string;
}

function getEvalLogPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "results.log");
}

async function postTelemetry(endpoint: string, scorecard: EvalScorecard): Promise<void> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(scorecard),
			signal: controller.signal,
		});
		clearTimeout(timeout);
	} catch {
		// fire-and-forget — silently ignore errors
	}
}

/**
 * Run the evaluator as a detached background process.
 *
 * Spawns `claude --print` with the evaluator prompt and allowed tools whitelist.
 * Collects stdout, parses the scorecard JSON, and appends to the eval log.
 * If anything fails, logs an error entry instead of silently dropping.
 */
export function runEvaluatorBackground(opts: EvaluatorRunOptions): void {
	const projectGroup = getProjectGroupId(opts.projectRoot);

	const prompt = buildEvaluatorPrompt({
		rubric: V1_RUBRIC,
		changeId: opts.changeId,
		transcriptPath: opts.transcriptPath,
		mode: opts.mode,
		projectGroup,
	});

	const allowedTools = [
		"Read",
		"Grep",
		"Glob",
		"Bash(jj:*)",
		"Bash(git:*)",
		"mcp__graphiti__*",
		"mcp__indusk__*",
		"mcp__codegraphcontext__*",
	];

	const args = [
		"--print",
		"--output-format",
		"json",
		"--model",
		"opus",
		"--permission-mode",
		"acceptEdits",
		"--mcp-config",
		".mcp.json",
		"--allowed-tools",
		allowedTools.join(","),
	];

	// Not detached — the eval-trigger hook already spawns this in a separate
	// node process. Detaching + unref causes the close handler to never fire.
	const child = spawn("claude", args, {
		cwd: opts.projectRoot,
		stdio: ["pipe", "pipe", "pipe"],
		env: { ...process.env },
	});

	// Pipe the prompt via stdin (too large for CLI arg)
	child.stdin?.write(prompt);
	child.stdin?.end();

	let stdout = "";
	let stderr = "";

	child.stdout?.on("data", (chunk: Buffer) => {
		stdout += chunk.toString();
	});

	child.stderr?.on("data", (chunk: Buffer) => {
		stderr += chunk.toString();
	});

	child.on("close", async (code) => {
		const logWriter = new EvalLogWriter(getEvalLogPath(opts.projectRoot));

		try {
			if (code !== 0) {
				throw new Error(`claude exited with code ${code}: ${stderr.slice(0, 500)}`);
			}

			// --output-format json wraps the result; extract the text content and usage
			let scorecardText = stdout;
			let usage: import("./types.js").EvalUsage | undefined;
			try {
				const jsonOutput = JSON.parse(stdout);
				scorecardText = jsonOutput.result ?? jsonOutput.text ?? jsonOutput.content ?? stdout;
				// Capture usage data from claude --print output
				if (jsonOutput.total_cost_usd !== undefined || jsonOutput.usage) {
					const u = jsonOutput.usage ?? {};
					usage = {
						costUsd: jsonOutput.total_cost_usd ?? 0,
						inputTokens: u.input_tokens ?? 0,
						outputTokens: u.output_tokens ?? 0,
						cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
						cacheReadTokens: u.cache_read_input_tokens ?? 0,
						durationMs: jsonOutput.duration_ms ?? 0,
					};
				}
			} catch {
				// stdout might be raw JSON scorecard already
			}

			// Extract JSON from possible markdown code fences
			const jsonMatch = scorecardText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
			if (jsonMatch?.[1]) {
				scorecardText = jsonMatch[1];
			}

			const scorecard = JSON.parse(scorecardText.trim()) as EvalScorecard;
			if (usage) scorecard.usage = usage;
			scorecard.telemetryPosted = false;

			if (opts.evalEndpoint) {
				await postTelemetry(opts.evalEndpoint, scorecard);
				scorecard.telemetryPosted = true;
			}

			await logWriter.append(scorecard);
			ingestScorecard(opts.projectRoot, scorecard);
		} catch (err) {
			const errorEntry: EvalErrorEntry = {
				version: 1,
				timestamp: new Date().toISOString(),
				mode: opts.mode,
				changeId: opts.changeId,
				error: true,
				message: err instanceof Error ? err.message : String(err),
			};
			await logWriter.append(errorEntry);
		}
	});
}

/**
 * Run the evaluator synchronously (for testing and manual invocation).
 * Returns the scorecard or error entry.
 */
export async function runEvaluatorSync(
	opts: EvaluatorRunOptions,
): Promise<EvalScorecard | EvalErrorEntry> {
	const tracer = initEvalOtel(opts.projectRoot);
	const source = process.env.INDUSK_EVAL_SOURCE ?? "commit";
	const projectGroup = getProjectGroupId(opts.projectRoot);

	const result = await withSpan(
		tracer,
		"eval.run",
		{
			changeId: opts.changeId,
			source,
			mode: opts.mode,
			projectGroup,
			entrypoint: "runEvaluatorSync",
		},
		() => runEvaluatorSyncInner(opts, projectGroup),
	);

	await shutdownEvalOtel();
	return result;
}

async function runEvaluatorSyncInner(
	opts: EvaluatorRunOptions,
	projectGroup: string,
): Promise<EvalScorecard | EvalErrorEntry> {
	const prompt = buildEvaluatorPrompt({
		rubric: V1_RUBRIC,
		changeId: opts.changeId,
		transcriptPath: opts.transcriptPath,
		mode: opts.mode,
		projectGroup,
	});

	const allowedTools = [
		"Read",
		"Grep",
		"Glob",
		"Bash(jj:*)",
		"Bash(git:*)",
		"mcp__graphiti__*",
		"mcp__indusk__*",
		"mcp__codegraphcontext__*",
	];

	const args = [
		"--print",
		"--output-format",
		"json",
		"--model",
		"opus",
		"--permission-mode",
		"acceptEdits",
		"--mcp-config",
		".mcp.json",
		"--allowed-tools",
		allowedTools.join(","),
	];

	return new Promise((resolve) => {
		const child = spawn("claude", args, {
			cwd: opts.projectRoot,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env },
		});

		child.stdin?.write(prompt);
		child.stdin?.end();

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on("close", async (code) => {
			const logWriter = new EvalLogWriter(getEvalLogPath(opts.projectRoot));

			try {
				if (code !== 0) {
					throw new Error(`claude exited with code ${code}: ${stderr.slice(0, 500)}`);
				}

				let scorecardText = stdout;
				let syncUsage: import("./types.js").EvalUsage | undefined;
				try {
					const jsonOutput = JSON.parse(stdout);
					scorecardText = jsonOutput.result ?? jsonOutput.text ?? jsonOutput.content ?? stdout;
					if (jsonOutput.total_cost_usd !== undefined || jsonOutput.usage) {
						const u = jsonOutput.usage ?? {};
						syncUsage = {
							costUsd: jsonOutput.total_cost_usd ?? 0,
							inputTokens: u.input_tokens ?? 0,
							outputTokens: u.output_tokens ?? 0,
							cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
							cacheReadTokens: u.cache_read_input_tokens ?? 0,
							durationMs: jsonOutput.duration_ms ?? 0,
						};
					}
				} catch {
					// raw JSON
				}

				const jsonMatch = scorecardText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
				if (jsonMatch?.[1]) {
					scorecardText = jsonMatch[1];
				}

				const scorecard = JSON.parse(scorecardText.trim()) as EvalScorecard;
				if (syncUsage) scorecard.usage = syncUsage;
				scorecard.telemetryPosted = false;

				if (opts.evalEndpoint) {
					await postTelemetry(opts.evalEndpoint, scorecard);
					scorecard.telemetryPosted = true;
				}

				await logWriter.append(scorecard);
				ingestScorecard(opts.projectRoot, scorecard);
				resolve(scorecard);
			} catch (err) {
				const errorEntry: EvalErrorEntry = {
					version: 1,
					timestamp: new Date().toISOString(),
					mode: opts.mode,
					changeId: opts.changeId,
					error: true,
					message: err instanceof Error ? err.message : String(err),
				};
				await logWriter.append(errorEntry);
				resolve(errorEntry);
			}
		});
	});
}
