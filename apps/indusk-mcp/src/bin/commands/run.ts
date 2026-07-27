import { resolveModel } from "../../lib/run/registry.js";

export interface RunOptions {
	/** `--model <name>` — an alias (claude/gpt/gemini/grok) or bare provider name. */
	model?: string;
}

/** Default driver when `--model` is omitted — Claude is the first driver (ADR Decision 4). */
const DEFAULT_MODEL = "claude";

/**
 * `indusk run <plan> --model <name>` — the external orchestrator entry point.
 *
 * Phase 0 scaffold: parse the plan name + resolve `--model` through the provider
 * registry into a driver config, and report it. The agentic tool-loop (Vercel AI
 * SDK) + the gate adapter land in later phases — this command intentionally does
 * NOT drive any edits yet.
 */
export async function run(
	_projectRoot: string,
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

	console.info(`Plan:   ${plan}`);
	console.info(
		`Model:  ${modelName} → provider ${driver.provider} (${driver.model}), key from $${driver.apiKeyEnv}`,
	);
	console.info("Agentic loop not yet wired — Phase 0 scaffold. The rented loop lands in Phase 1.");
}
