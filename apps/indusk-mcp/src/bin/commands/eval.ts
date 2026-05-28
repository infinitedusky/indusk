/**
 * CLI commands for the eval system.
 *
 * `indusk eval summary` — aggregate scores and trends
 * `indusk eval baseline` — run baseline evaluation with vanilla agent
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { getAllFindings, getUnresolvedFindings, markFinding } from "../../lib/eval/findings.js";
import { readAllEntries } from "../../lib/eval/log-reader.js";
import { type EvalScorecard, isScorecard } from "../../lib/eval/types.js";

function getEvalLogPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "results.log");
}

export async function evalSummary(
	projectRoot: string,
	opts: { mode?: string; since?: string; json?: boolean },
): Promise<void> {
	const logPath = getEvalLogPath(projectRoot);

	if (!existsSync(logPath)) {
		console.info(
			"No eval results yet. Results appear after a commit (jj describe / git commit) triggers the eval hook.",
		);
		return;
	}

	const filterOpts: { mode?: "eval" | "baseline"; since?: Date } = {};
	if (opts.mode === "eval" || opts.mode === "baseline") filterOpts.mode = opts.mode;
	if (opts.since) filterOpts.since = new Date(opts.since);

	const entries = await readAllEntries(logPath, filterOpts);
	const scorecards = entries.filter(isScorecard);
	const errors = entries.filter((e) => !isScorecard(e));

	if (entries.length === 0) {
		console.info("No eval results match the filter criteria.");
		return;
	}

	if (opts.json) {
		console.info(
			JSON.stringify({ scorecards, errors, summary: computeSummary(scorecards) }, null, 2),
		);
		return;
	}

	// Text output
	const summary = computeSummary(scorecards);

	console.info(`\n📊 Eval Summary`);
	console.info(`${"─".repeat(50)}`);
	console.info(
		`Total evaluations: ${entries.length} (${scorecards.length} scorecards, ${errors.length} errors)`,
	);

	if (scorecards.length > 0) {
		console.info(`\nMode breakdown:`);
		console.info(`  eval:     ${summary.evalCount}`);
		console.info(`  baseline: ${summary.baselineCount}`);

		console.info(`\nPer-question pass rates:`);
		for (const [id, rate] of Object.entries(summary.passRates)) {
			const bar = "█".repeat(Math.round(rate * 20)) + "░".repeat(20 - Math.round(rate * 20));
			console.info(`  ${id.padEnd(20)} ${bar} ${(rate * 100).toFixed(0)}%`);
		}

		console.info(`\nGraphiti writes: ${summary.totalGraphitiWrites}`);

		if (summary.totalCostUsd > 0) {
			console.info(`\nCost:`);
			console.info(`  total:   $${summary.totalCostUsd.toFixed(2)}`);
			console.info(`  per eval: $${(summary.totalCostUsd / scorecards.length).toFixed(2)}`);
			console.info(
				`  tokens:  ${summary.totalInputTokens.toLocaleString()} in / ${summary.totalOutputTokens.toLocaleString()} out`,
			);
		}

		if (summary.evalCount >= 10) {
			console.info(`\nTrend (last 10 vs previous 10):`);
			for (const [id, delta] of Object.entries(summary.trend)) {
				const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
				console.info(
					`  ${id.padEnd(20)} ${arrow} ${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`,
				);
			}
		}
	}

	console.info("");
}

interface EvalSummaryStats {
	evalCount: number;
	baselineCount: number;
	passRates: Record<string, number>;
	totalGraphitiWrites: number;
	totalCostUsd: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	trend: Record<string, number>;
}

function computeSummary(scorecards: EvalScorecard[]): EvalSummaryStats {
	const evalCards = scorecards.filter((s) => s.mode === "eval");
	const baselineCards = scorecards.filter((s) => s.mode === "baseline");

	// Pass rates per question
	const passRates: Record<string, number> = {};
	const questionCounts: Record<string, { pass: number; total: number }> = {};

	for (const card of scorecards) {
		for (const q of card.questions) {
			if (!questionCounts[q.id]) questionCounts[q.id] = { pass: 0, total: 0 };
			questionCounts[q.id].total++;
			if (q.answer === "yes") questionCounts[q.id].pass++;
		}
	}

	for (const [id, counts] of Object.entries(questionCounts)) {
		passRates[id] = counts.total > 0 ? counts.pass / counts.total : 0;
	}

	// Trend: compare last 10 eval scorecards vs previous 10
	const trend: Record<string, number> = {};
	if (evalCards.length >= 10) {
		const recent = evalCards.slice(-10);
		const previous = evalCards.slice(-20, -10);

		if (previous.length >= 5) {
			const recentRates = computePassRates(recent);
			const previousRates = computePassRates(previous);

			for (const id of Object.keys(recentRates)) {
				trend[id] = (recentRates[id] ?? 0) - (previousRates[id] ?? 0);
			}
		}
	}

	return {
		evalCount: evalCards.length,
		baselineCount: baselineCards.length,
		passRates,
		totalGraphitiWrites: scorecards.reduce((sum, s) => sum + s.graphitiWrites, 0),
		totalCostUsd: scorecards.reduce((sum, s) => sum + (s.usage?.costUsd ?? 0), 0),
		totalInputTokens: scorecards.reduce(
			(sum, s) => sum + (s.usage?.inputTokens ?? 0) + (s.usage?.cacheReadTokens ?? 0),
			0,
		),
		totalOutputTokens: scorecards.reduce((sum, s) => sum + (s.usage?.outputTokens ?? 0), 0),
		trend,
	};
}

export async function evalFindings(projectRoot: string, opts: { all?: boolean }): Promise<void> {
	const findings = opts.all ? getAllFindings(projectRoot) : getUnresolvedFindings(projectRoot);

	if (findings.length === 0) {
		console.info(opts.all ? "No eval findings." : "No unresolved findings.");
		return;
	}

	console.info(`\n${opts.all ? "All" : "Unresolved"} eval findings (${findings.length}):\n`);
	for (const f of findings) {
		const icon = f.state === "fixed" ? "✓" : f.state === "ignored" ? "–" : "●";
		console.info(`  ${icon} [${f.severity}] ${f.questionId}: ${f.finding}`);
		console.info(`    key: ${f.key}  change: ${f.changeId.slice(0, 8)}  state: ${f.state}`);
	}
	console.info("");
}

export async function evalMark(
	projectRoot: string,
	key: string,
	state: "fixed" | "ignored",
): Promise<void> {
	const success = markFinding(projectRoot, key, state);
	if (success) {
		console.info(`Marked ${key} as ${state}`);
	} else {
		console.error(`Finding not found: ${key}`);
		process.exit(1);
	}
}

function computePassRates(cards: EvalScorecard[]): Record<string, number> {
	const counts: Record<string, { pass: number; total: number }> = {};
	for (const card of cards) {
		for (const q of card.questions) {
			if (!counts[q.id]) counts[q.id] = { pass: 0, total: 0 };
			counts[q.id].total++;
			if (q.answer === "yes") counts[q.id].pass++;
		}
	}
	const rates: Record<string, number> = {};
	for (const [id, c] of Object.entries(counts)) {
		rates[id] = c.total > 0 ? c.pass / c.total : 0;
	}
	return rates;
}

export async function evalBaseline(
	projectRoot: string,
	opts: { task: string; keep?: boolean },
): Promise<void> {
	const { execSync, spawnSync } = await import("node:child_process");
	const { rmSync, writeFileSync } = await import("node:fs");
	const { basename } = await import("node:path");

	const taskPath = opts.task;
	if (!existsSync(taskPath)) {
		console.error(`Task file not found: ${taskPath}`);
		process.exit(1);
	}

	const { readFileSync } = await import("node:fs");
	const taskPrompt = readFileSync(taskPath, "utf-8");
	const taskName = basename(taskPath, ".md").replace(/\s+/g, "-");

	const worktreePath = join(projectRoot, ".indusk", "eval", "baseline-worktree");

	console.info("Setting up baseline worktree...");

	// Create worktree from current HEAD
	try {
		execSync(`git worktree add "${worktreePath}" HEAD --detach`, {
			cwd: projectRoot,
			stdio: "pipe",
		});
	} catch {
		// Worktree may already exist
		if (existsSync(worktreePath)) {
			console.info("Baseline worktree already exists, reusing...");
		} else {
			console.error("Failed to create baseline worktree");
			process.exit(1);
		}
	}

	// Strip the worktree for vanilla agent
	console.info("Stripping worktree for baseline agent...");
	const skillsPath = join(worktreePath, ".claude", "skills");
	if (existsSync(skillsPath)) {
		rmSync(skillsPath, { recursive: true, force: true });
	}

	// Write minimal CLAUDE.md
	const projectName = basename(projectRoot);
	writeFileSync(
		join(worktreePath, "CLAUDE.md"),
		`# ${projectName}\n\nThis is a software project. No special instructions.\n`,
	);

	// Write empty .mcp.json
	writeFileSync(join(worktreePath, ".mcp.json"), JSON.stringify({ mcpServers: {} }, null, 2));

	console.info(`Running baseline agent with task: ${taskName}...`);

	// Spawn vanilla claude --print in the baseline worktree
	const result = spawnSync("claude", ["--print", "--model", "opus", taskPrompt], {
		cwd: worktreePath,
		stdio: "inherit",
		timeout: 10 * 60 * 1000, // 10 minutes
		env: { ...process.env },
	});

	if (result.status !== 0) {
		console.error(`Baseline agent exited with code ${result.status}`);
	}

	// Commit the baseline work — SCM-aware. The worktree inherits the
	// project's `scm` field via the same .indusk/config.json copy, so we
	// branch on that rather than re-detecting per worktree.
	console.info("Committing baseline work...");
	const { getScm } = await import("../../lib/scm/detect.js");
	const scm = getScm(projectRoot);
	try {
		if (scm === "git") {
			execSync(`git commit --allow-empty -m "baseline: ${taskName}"`, {
				cwd: worktreePath,
				stdio: "pipe",
			});
		} else {
			execSync("jj new", { cwd: worktreePath, stdio: "pipe" });
			execSync(`jj describe -m "baseline: ${taskName}"`, {
				cwd: worktreePath,
				stdio: "pipe",
			});
		}
	} catch {
		console.info(`Note: ${scm} commit may have failed — evaluating current state anyway`);
	}

	// Run the smart evaluator against the baseline
	console.info("Running smart evaluator against baseline...");
	const { runEvaluatorSync } = await import("../../lib/eval/evaluator-runner.js");

	let changeId: string;
	try {
		if (scm === "git") {
			changeId = execSync("git rev-parse --short HEAD", {
				cwd: worktreePath,
				encoding: "utf8",
			}).trim();
		} else {
			changeId = execSync("jj log -r @ --no-graph -T change_id", {
				cwd: worktreePath,
				encoding: "utf8",
			}).trim();
		}
	} catch {
		changeId = "baseline-unknown";
	}

	const evalResult = await runEvaluatorSync({
		projectRoot: worktreePath,
		changeId,
		transcriptPath: "(baseline — no transcript)",
		mode: "baseline",
	});

	if ("error" in evalResult) {
		console.error(`Eval failed: ${evalResult.message}`);
	} else {
		console.info(`\nBaseline scorecard for ${taskName}:`);
		console.info(`  Summary: ${evalResult.summary}`);
		for (const q of evalResult.questions) {
			const icon = q.answer === "yes" ? "✓" : q.answer === "no" ? "✗" : "~";
			console.info(`  ${icon} ${q.id}: ${q.finding}`);
		}
	}

	// Cleanup
	if (!opts.keep) {
		console.info("Cleaning up baseline worktree...");
		try {
			execSync(`git worktree remove "${worktreePath}" --force`, {
				cwd: projectRoot,
				stdio: "pipe",
			});
		} catch {
			console.info("Note: worktree cleanup may need manual removal");
		}
	} else {
		console.info(`Baseline worktree kept at: ${worktreePath}`);
	}
}
