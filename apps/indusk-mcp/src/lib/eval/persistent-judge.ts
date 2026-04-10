/**
 * Persistent judge session management.
 *
 * First eval spawns a new session with full catchup. Subsequent evals resume
 * the same session — no catchup cost, just "evaluate this change."
 *
 * Session state stored in `.indusk/eval/judge-session.json`.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { getProjectGroupId } from "../config.js";
import { ingestScorecard } from "./findings.js";
import { EvalLogWriter } from "./log-writer.js";
import { buildJudgePrompt } from "./prompt-builder.js";
import { V1_RUBRIC } from "./rubric.js";
import type { EvalErrorEntry, EvalScorecard, EvalUsage } from "./types.js";

interface JudgeSession {
	sessionId: string;
	createdAt: string;
	lastEvalAt: string;
	evalCount: number;
}

function getSessionPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "judge-session.json");
}

function getEvalLogPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "results.log");
}

function readSession(projectRoot: string): JudgeSession | null {
	const path = getSessionPath(projectRoot);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

function writeSession(projectRoot: string, session: JudgeSession): void {
	const path = getSessionPath(projectRoot);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(session, null, 2)}\n`);
}

function clearSession(projectRoot: string): void {
	const path = getSessionPath(projectRoot);
	if (existsSync(path)) {
		const { unlinkSync } = require("node:fs") as typeof import("node:fs");
		unlinkSync(path);
	}
}

const ALLOWED_TOOLS = [
	"Read",
	"Grep",
	"Glob",
	"Bash(jj:*)",
	"Bash(git:*)",
	"mcp__graphiti__*",
	"mcp__indusk__*",
	"mcp__codegraphcontext__*",
];

function parseClaudeOutput(stdout: string): {
	scorecardText: string;
	usage?: EvalUsage;
	sessionId?: string;
} {
	let scorecardText = stdout;
	let usage: EvalUsage | undefined;
	let sessionId: string | undefined;

	try {
		const jsonOutput = JSON.parse(stdout);
		scorecardText = jsonOutput.result ?? jsonOutput.text ?? jsonOutput.content ?? stdout;
		sessionId = jsonOutput.session_id;
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
		// raw output
	}

	const jsonMatch = scorecardText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	if (jsonMatch?.[1]) {
		scorecardText = jsonMatch[1];
	}

	return { scorecardText, usage, sessionId };
}

async function spawnClaude(
	args: string[],
	prompt: string,
	cwd: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
	return new Promise((resolve) => {
		const child = spawn("claude", args, {
			cwd,
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

		child.on("close", (code) => {
			resolve({ stdout, stderr, code });
		});
	});
}

/**
 * Run eval using a persistent session. First call does catchup + eval.
 * Subsequent calls resume the session with just the new change.
 */
export async function runPersistentEval(opts: {
	projectRoot: string;
	changeId: string;
	transcriptPath: string;
	mode: "eval" | "baseline";
	evalEndpoint?: string;
}): Promise<EvalScorecard | EvalErrorEntry> {
	const logWriter = new EvalLogWriter(getEvalLogPath(opts.projectRoot));
	const session = readSession(opts.projectRoot);
	const projectGroup = getProjectGroupId(opts.projectRoot);

	try {
		let result: { stdout: string; stderr: string; code: number | null };

		if (session) {
			// Resume existing session — cheap eval, no catchup
			const resumePrompt = `Evaluate a new commit. Change ID: ${opts.changeId}

Run \`jj diff -r ${opts.changeId}\` to see what changed. Then answer the same evaluation questions as before. Read the changed files for full context.

Output ONLY the JSON scorecard as before — no commentary.`;

			result = await spawnClaude(
				[
					"--print",
					"--output-format",
					"json",
					"--resume",
					session.sessionId,
					"--allowed-tools",
					ALLOWED_TOOLS.join(","),
				],
				resumePrompt,
				opts.projectRoot,
			);
		} else {
			// First eval — full catchup + evaluation
			const fullPrompt = buildJudgePrompt({
				rubric: V1_RUBRIC,
				changeId: opts.changeId,
				transcriptPath: opts.transcriptPath,
				mode: opts.mode,
				projectGroup,
			});

			result = await spawnClaude(
				[
					"--print",
					"--output-format",
					"json",
					"--model",
					"opus",
					"--permission-mode",
					"acceptEdits",
					"--allowed-tools",
					ALLOWED_TOOLS.join(","),
				],
				fullPrompt,
				opts.projectRoot,
			);
		}

		if (result.code !== 0) {
			// If resuming failed, clear session and retry with full catchup
			if (session) {
				clearSession(opts.projectRoot);
				return runPersistentEval(opts);
			}
			throw new Error(`claude exited with code ${result.code}: ${result.stderr.slice(0, 500)}`);
		}

		const parsed = parseClaudeOutput(result.stdout);
		const scorecard = JSON.parse(parsed.scorecardText.trim()) as EvalScorecard;
		if (parsed.usage) scorecard.usage = parsed.usage;
		scorecard.telemetryPosted = false;

		// Update session state
		const newSession: JudgeSession = {
			sessionId: parsed.sessionId ?? session?.sessionId ?? "unknown",
			createdAt: session?.createdAt ?? new Date().toISOString(),
			lastEvalAt: new Date().toISOString(),
			evalCount: (session?.evalCount ?? 0) + 1,
		};
		writeSession(opts.projectRoot, newSession);

		await logWriter.append(scorecard);
		ingestScorecard(opts.projectRoot, scorecard);
		return scorecard;
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
		return errorEntry;
	}
}
