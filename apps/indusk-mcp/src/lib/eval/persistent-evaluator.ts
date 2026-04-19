/**
 * Persistent evaluator session management.
 *
 * First eval spawns a new session with full catchup. Subsequent evals resume
 * the same session — no catchup cost, just "evaluate this change."
 *
 * Session state stored in `.indusk/eval/evaluator-session.json`.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { getProjectGroupId } from "../config.js";
import { readUnprocessedHighlights } from "../highlights/highlights.js";
import { ingestScorecard } from "./findings.js";
import { EvalLogWriter } from "./log-writer.js";
import {
	initEvalOtel,
	initEvalOtelLogs,
	logEvalContent,
	shutdownEvalOtel,
	withSpan,
} from "./otel.js";
import { buildEvaluatorPrompt } from "./prompt-builder.js";
import { V1_RUBRIC } from "./rubric.js";
import {
	extractScorecardJson,
	formatParseError,
	getScorecardQuestions,
} from "./scorecard-extractor.js";
import type { EvalErrorEntry, EvalScorecard, EvalUsage } from "./types.js";

interface EvaluatorSession {
	sessionId: string;
	createdAt: string;
	lastEvalAt: string;
	evalCount: number;
}

function getSessionPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "evaluator-session.json");
}

function getEvalLogPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "results.log");
}

function readSession(projectRoot: string): EvaluatorSession | null {
	const path = getSessionPath(projectRoot);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

function writeSession(projectRoot: string, session: EvaluatorSession): void {
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

	// Tolerantly extract the scorecard JSON — handles pure JSON, fenced JSON,
	// and prose-prefixed/wrapped JSON. Falls through to the raw text if no
	// balanced object exists, letting the caller's JSON.parse surface a
	// recognizable error (which the catch enriches with a stdout snippet).
	const extracted = extractScorecardJson(scorecardText);
	if (extracted !== null) {
		scorecardText = extracted;
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
	const tracer = initEvalOtel(opts.projectRoot);
	initEvalOtelLogs(opts.projectRoot);
	const source = process.env.INDUSK_EVAL_SOURCE ?? "commit";
	const projectGroup = getProjectGroupId(opts.projectRoot);

	// Peek at the highlights queue before spawning — gives us observability
	// into how much work the Claude subprocess will do without having to
	// span per-highlight (which would require Claude-Code-internal OTel).
	let unprocessedCount = 0;
	try {
		unprocessedCount = readUnprocessedHighlights(opts.projectRoot).length;
	} catch {
		// reading the queue is best-effort — never block the evaluator
	}

	const result = await withSpan(
		tracer,
		"eval.run",
		{
			changeId: opts.changeId,
			source,
			mode: opts.mode,
			projectGroup,
			"highlights.unprocessed_count": unprocessedCount,
		},
		async (rootSpan) => {
			const logWriter = new EvalLogWriter(getEvalLogPath(opts.projectRoot));

			const session = await withSpan(tracer, "eval.read_session", undefined, () =>
				readSession(opts.projectRoot),
			);

			rootSpan.setAttribute("resumed", session !== null);

			// Capture raw stdout so the catch can include a snippet in the error
			// message — preserves debuggability when JSON parsing fails on the
			// extracted scorecard text.
			let rawClaudeStdout = "";

			try {
				const { args, prompt } = await withSpan(
					tracer,
					"eval.build_prompt",
					{ resumed: session !== null },
					(span) => {
						const built = buildArgsAndPrompt();
						span.setAttribute("prompt.length", built.prompt.length);
						span.setAttribute("prompt.kind", session ? "resume" : "full");
						logEvalContent("prompt", built.prompt, {
							"prompt.length": built.prompt.length,
							"prompt.kind": session ? "resume" : "full",
						});
						return built;
					},
				);

				function buildArgsAndPrompt(): { args: string[]; prompt: string } {
					if (session) {
						const resumePrompt = `Evaluate a new commit. Change ID: ${opts.changeId}

Run \`jj diff -r ${opts.changeId}\` to see what changed. Then answer the same evaluation questions as before. Read the changed files for full context.

Output ONLY the JSON scorecard as before — no commentary.`;

						return {
							args: [
								"--print",
								"--output-format",
								"json",
								"--resume",
								session.sessionId,
								"--mcp-config",
								".mcp.json",
								"--permission-mode",
								"bypassPermissions",
								"--allowed-tools",
								ALLOWED_TOOLS.join(","),
							],
							prompt: resumePrompt,
						};
					}
					return {
						args: [
							"--print",
							"--output-format",
							"json",
							"--model",
							"opus",
							"--permission-mode",
							"bypassPermissions",
							"--mcp-config",
							".mcp.json",
							"--allowed-tools",
							ALLOWED_TOOLS.join(","),
						],
						prompt: buildEvaluatorPrompt({
							rubric: V1_RUBRIC,
							changeId: opts.changeId,
							transcriptPath: opts.transcriptPath,
							mode: opts.mode,
							projectGroup,
						}),
					};
				}

				const claudeResult = await withSpan(
					tracer,
					"eval.spawn_claude",
					{
						"args.resumed": session !== null,
						"args.model": session ? "(resumed)" : "opus",
					},
					async (span) => {
						const spawned = await spawnClaude(args, prompt, opts.projectRoot);
						span.setAttribute("exit.code", spawned.code ?? -1);
						span.setAttribute("stdout.length", spawned.stdout.length);
						if (spawned.code !== 0) {
							span.setAttribute("exit.stderr_tail", spawned.stderr.slice(-500));
							logEvalContent("claude.error", spawned.stderr, {
								"exit.code": spawned.code ?? -1,
							});
						}
						logEvalContent("claude.stdout", spawned.stdout, {
							"stdout.length": spawned.stdout.length,
							"exit.code": spawned.code ?? -1,
						});
						return spawned;
					},
				);
				rawClaudeStdout = claudeResult.stdout;

				if (claudeResult.code !== 0) {
					if (session) {
						await withSpan(tracer, "eval.clear_stale_session", undefined, () =>
							clearSession(opts.projectRoot),
						);
						// Recurse — the retry produces its own root span
						return runPersistentEval(opts);
					}
					throw new Error(
						`claude exited with code ${claudeResult.code}: ${claudeResult.stderr.slice(0, 500)}`,
					);
				}

				const parsed = await withSpan(tracer, "eval.parse_output", undefined, (span) => {
					const out = parseClaudeOutput(claudeResult.stdout);
					if (out.sessionId) span.setAttribute("session_id", out.sessionId);
					if (out.usage) {
						span.setAttribute("cost_usd", out.usage.costUsd);
						span.setAttribute("input_tokens", out.usage.inputTokens);
						span.setAttribute("output_tokens", out.usage.outputTokens);
					}
					return out;
				});

				const scorecard = JSON.parse(parsed.scorecardText.trim()) as EvalScorecard;
				// Override the model-supplied timestamp with actual completion time.
				// The model doesn't know the real current time and tends to round to
				// 5-minute marks (e.g. 18:25:00). Use Date.now() so timestamps are
				// accurate to the second.
				scorecard.timestamp = new Date().toISOString();
				if (parsed.usage) scorecard.usage = parsed.usage;
				scorecard.telemetryPosted = false;

				// Carry scorecard-level content onto the root span for at-a-glance debugging in Dash0
				rootSpan.setAttribute("scorecard.status", "ok");
				rootSpan.setAttribute("scorecard.question_count", scorecard.questions?.length ?? 0);
				if (scorecard.summary) {
					rootSpan.setAttribute("scorecard.summary", scorecard.summary.slice(0, 500));
				}
				if (scorecard.usage) {
					rootSpan.setAttribute("scorecard.cost_usd", scorecard.usage.costUsd);
					rootSpan.setAttribute("scorecard.duration_ms", scorecard.usage.durationMs);
					rootSpan.setAttribute("scorecard.input_tokens", scorecard.usage.inputTokens);
					rootSpan.setAttribute("scorecard.output_tokens", scorecard.usage.outputTokens);
				}
				const answerCounts = { yes: 0, no: 0, partial: 0 };
				// Use the central guard from scorecard-extractor — `?? []` here was
				// the bug: it only catches null/undefined, not non-array shapes like
				// `{}` (which the model has been observed to return — e.g. on Numero
				// 2026-04-19 19:54 with `questions: { conventions: {...} }` keyed by id).
				for (const q of getScorecardQuestions<(typeof scorecard.questions)[number]>(scorecard)) {
					if (q.answer in answerCounts) answerCounts[q.answer as keyof typeof answerCounts]++;
				}
				rootSpan.setAttribute("scorecard.answers.yes", answerCounts.yes);
				rootSpan.setAttribute("scorecard.answers.no", answerCounts.no);
				rootSpan.setAttribute("scorecard.answers.partial", answerCounts.partial);

				await withSpan(tracer, "eval.update_session", undefined, () => {
					const newSession: EvaluatorSession = {
						sessionId: parsed.sessionId ?? session?.sessionId ?? "unknown",
						createdAt: session?.createdAt ?? new Date().toISOString(),
						lastEvalAt: new Date().toISOString(),
						evalCount: (session?.evalCount ?? 0) + 1,
					};
					writeSession(opts.projectRoot, newSession);
				});

				await withSpan(tracer, "eval.write_scorecard", undefined, async () => {
					await logWriter.append(scorecard);
					ingestScorecard(opts.projectRoot, scorecard);
					logEvalContent("scorecard", JSON.stringify(scorecard), {
						"scorecard.question_count": scorecard.questions?.length ?? 0,
						"scorecard.summary_length": scorecard.summary?.length ?? 0,
					});
				});

				return scorecard;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				const stack = err instanceof Error ? (err.stack ?? "") : "";
				const enrichedMessage = rawClaudeStdout
					? formatParseError(err, rawClaudeStdout)
					: msg;
				rootSpan.setAttribute("scorecard.status", "error");
				rootSpan.setAttribute("error.message", msg.slice(0, 500));
				logEvalContent("error", stack || enrichedMessage, {
					"error.message": msg.slice(0, 500),
				});
				const errorEntry: EvalErrorEntry = {
					version: 1,
					timestamp: new Date().toISOString(),
					mode: opts.mode,
					changeId: opts.changeId,
					error: true,
					message: enrichedMessage,
				};
				await logWriter.append(errorEntry);
				return errorEntry;
			}
		},
	);

	// Flush OTel so batched spans ship before the detached process exits.
	await shutdownEvalOtel();

	return result;
}
