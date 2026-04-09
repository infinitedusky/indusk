/**
 * Judge runner — spawns a background `claude --print` process that evaluates
 * a commit and writes results to the eval log.
 *
 * The judge is a detached child process so the calling hook can exit immediately.
 * Results appear asynchronously in `.indusk/eval/results.log`.
 */

import { execSync, spawn } from "node:child_process";
import { join } from "node:path";

import { getProjectGroupId } from "../config.js";
import { EvalLogWriter } from "./log-writer.js";
import { buildJudgePrompt } from "./prompt-builder.js";
import { V1_RUBRIC } from "./rubric.js";
import type { EvalErrorEntry, EvalScorecard } from "./types.js";

export interface JudgeRunOptions {
	projectRoot: string;
	changeId: string;
	transcriptPath: string;
	mode: "eval" | "baseline";
	evalEndpoint?: string;
}

function getEvalLogPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "results.log");
}

function getDiff(changeId: string): string {
	try {
		return execSync(`jj diff -r ${changeId}`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
	} catch {
		return "(diff unavailable)";
	}
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
 * Run the judge as a detached background process.
 *
 * Spawns `claude --print` with the judge prompt and allowed tools whitelist.
 * Collects stdout, parses the scorecard JSON, and appends to the eval log.
 * If anything fails, logs an error entry instead of silently dropping.
 */
export function runJudgeBackground(opts: JudgeRunOptions): void {
	const diff = getDiff(opts.changeId);
	const projectGroup = getProjectGroupId(opts.projectRoot);

	const prompt = buildJudgePrompt({
		rubric: V1_RUBRIC,
		changeId: opts.changeId,
		transcriptPath: opts.transcriptPath,
		diff,
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

			// --output-format json wraps the result; extract the text content
			let scorecardText = stdout;
			try {
				const jsonOutput = JSON.parse(stdout);
				// claude --print --output-format json returns { result: string } or similar
				scorecardText = jsonOutput.result ?? jsonOutput.text ?? jsonOutput.content ?? stdout;
			} catch {
				// stdout might be raw JSON scorecard already
			}

			// Extract JSON from possible markdown code fences
			const jsonMatch = scorecardText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
			if (jsonMatch?.[1]) {
				scorecardText = jsonMatch[1];
			}

			const scorecard = JSON.parse(scorecardText.trim()) as EvalScorecard;
			scorecard.telemetryPosted = false;

			if (opts.evalEndpoint) {
				await postTelemetry(opts.evalEndpoint, scorecard);
				scorecard.telemetryPosted = true;
			}

			await logWriter.append(scorecard);
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
 * Run the judge synchronously (for testing and manual invocation).
 * Returns the scorecard or error entry.
 */
export async function runJudgeSync(opts: JudgeRunOptions): Promise<EvalScorecard | EvalErrorEntry> {
	const diff = getDiff(opts.changeId);
	const projectGroup = getProjectGroupId(opts.projectRoot);

	const prompt = buildJudgePrompt({
		rubric: V1_RUBRIC,
		changeId: opts.changeId,
		transcriptPath: opts.transcriptPath,
		diff,
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
				try {
					const jsonOutput = JSON.parse(stdout);
					scorecardText = jsonOutput.result ?? jsonOutput.text ?? jsonOutput.content ?? stdout;
				} catch {
					// raw JSON
				}

				const jsonMatch = scorecardText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
				if (jsonMatch?.[1]) {
					scorecardText = jsonMatch[1];
				}

				const scorecard = JSON.parse(scorecardText.trim()) as EvalScorecard;
				scorecard.telemetryPosted = false;

				if (opts.evalEndpoint) {
					await postTelemetry(opts.evalEndpoint, scorecard);
					scorecard.telemetryPosted = true;
				}

				await logWriter.append(scorecard);
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
