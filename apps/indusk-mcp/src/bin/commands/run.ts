import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

/**
 * Resolve `<plan>` to an impl.md: an explicit impl.md path, a directory
 * containing one, or a plan name under `.indusk/planning/`.
 */
function resolveImplPath(projectRoot: string, plan: string): string | null {
	const candidates = plan.endsWith("impl.md")
		? [resolve(projectRoot, plan)]
		: [
				resolve(projectRoot, plan, "impl.md"),
				resolve(projectRoot, ".indusk", "planning", plan, "impl.md"),
			];
	return candidates.find((p) => existsSync(p)) ?? null;
}

function usageSuffix(report: PhaseReport): string {
	const { inputTokens, outputTokens } = report.usage ?? {};
	if (inputTokens === undefined && outputTokens === undefined) return "";
	return ` (${inputTokens ?? "?"} in / ${outputTokens ?? "?"} out tokens)`;
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
			console.error(
				`STOPPED LOUD — Phase ${result.phase} did not close green (no auto-retry; a red phase is a human decision):\n${result.reason}`,
			);
			process.exitCode = 1;
			break;
	}
}
