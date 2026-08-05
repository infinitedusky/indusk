import { resolveImplPath } from "../../lib/impl-parser.js";
import { type PhaseReport, runLoop } from "../../lib/run/loop.js";
import { resolveModel, resolveProviderKey } from "../../lib/run/registry.js";

export interface RunOptions {
	/** `--model <name>` — an alias (claude/gpt/gemini/grok), bare provider name, or raw model id. */
	model?: string;
	/** `--max-steps <n>` — per-phase step budget for the one honest attempt. */
	maxSteps?: number;
}

/** Default driver when `--model` is omitted — Claude is the first driver (ADR Decision 4). */
const DEFAULT_MODEL = "claude";

function usageSuffix(report: PhaseReport): string {
	const { inputTokens, outputTokens } = report.usage ?? {};
	if (inputTokens === undefined && outputTokens === undefined) return "";
	return ` (${inputTokens ?? "?"} in / ${outputTokens ?? "?"} out tokens)`;
}

/** One human line per tool call for the live ticker: name(path-or-command). */
function describeToolCall(call: { toolName: string; input: unknown }): string {
	const input = call.input as Record<string, unknown> | null | undefined;
	const arg =
		typeof input?.path === "string"
			? input.path
			: typeof input?.file_path === "string"
				? input.file_path
				: typeof input?.command === "string"
					? input.command
					: "";
	const short = arg.length > 64 ? `${arg.slice(0, 61)}...` : arg;
	return short ? `${call.toolName}(${short})` : call.toolName;
}

/**
 * `indusk run <plan> --model <name>` — the external orchestrator entry point.
 *
 * Runs the plan's remaining phases through the model-agnostic gated loop
 * (`src/lib/run/loop.ts`): per-phase scope, advance-on-green via a deliberate
 * check-gates probe, goalpost guard, pause-at-human-gate. Exit codes: 0 =
 * impl-complete, 3 = paused at a human gate, 1 = stopped (red gate or moved
 * goalposts) or bad invocation.
 */
export async function run(
	projectRoot: string,
	plan: string,
	options: RunOptions = {},
): Promise<void> {
	const modelName = options.model ?? DEFAULT_MODEL;

	// Validate the step budget BEFORE anything spends a token (T16). NaN is the
	// dangerous one: `stepCountIs(NaN)` never fires, silently removing the run's
	// only cost bound — the failure mode is an unbounded bill, not an error.
	if (options.maxSteps !== undefined) {
		if (!Number.isFinite(options.maxSteps) || options.maxSteps < 1) {
			console.error(
				`--max-steps must be a positive whole number (got "${options.maxSteps}"). It bounds the per-phase attempt; a non-numeric value would leave the run unbounded.`,
			);
			process.exitCode = 1;
			return;
		}
	}

	let driver: ReturnType<typeof resolveModel>;
	try {
		driver = resolveModel(modelName);
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
		return;
	}

	const implPath = resolveImplPath(projectRoot, plan);
	if (!implPath) {
		console.error(
			`Plan "${plan}" not found — expected an impl.md path, a directory containing impl.md, or a plan under .indusk/planning/.`,
		);
		process.exitCode = 1;
		return;
	}

	if (!resolveProviderKey(driver)) {
		const names = driver.apiKeyEnvs.map((env) => `$${env}`).join(" or ");
		console.error(
			`${names} is not set — the ${driver.provider} driver authenticates with a direct provider key (no gateway).`,
		);
		process.exitCode = 1;
		return;
	}

	console.info(`Plan:   ${implPath}`);
	console.info(`Model:  ${modelName} → provider ${driver.provider} (${driver.model})`);

	const result = await runLoop({
		worktree: projectRoot,
		implPath,
		driver,
		maxStepsPerPhase: options.maxSteps,
		onPhaseStart: (phase, name) => console.info(`— Phase ${phase}: ${name}`),
		onStep: (step) => {
			const calls = step.toolCalls.map(describeToolCall).join(", ");
			console.info(
				`  · step ${step.index + 1}: ${calls || "(no tool call — model text/thinking)"}`,
			);
		},
	});

	for (const report of result.phases) {
		console.info(
			`  Phase ${report.phase} closed green — ${report.steps} steps, ${report.toolCalls} tool calls${usageSuffix(report)}`,
		);
	}

	switch (result.status) {
		case "complete":
			console.info(
				"Impl complete — every phase closed on a green check-gates probe. Hand back to a human for /falsify: the loop never runs the close-out rituals.",
			);
			break;
		case "paused-human-gate":
			console.info(`PAUSED at a human gate — ${result.reason}`);
			process.exitCode = 3;
			break;
		case "stopped-goalpost":
			console.error(
				`STOPPED LOUD — the Test Trajectory drifted during Phase ${result.phase} (a gamed gate, not a passed one):\n${result.violations.map((v) => `  - ${v}`).join("\n")}`,
			);
			process.exitCode = 1;
			break;
		case "stopped-red":
			if (result.attempt) {
				console.error(
					`  attempt cost — ${result.attempt.steps} steps, ${result.attempt.toolCalls} tool calls${usageSuffix(result.attempt)}`,
				);
			}
			console.error(
				`STOPPED LOUD — Phase ${result.phase} did not close green (no auto-retry; a red phase is a human decision):\n${result.reason}`,
			);
			process.exitCode = 1;
			break;
	}
}
