import { randomBytes } from "node:crypto";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { generateText, stepCountIs } from "ai";
import { createGatedWorktreeTools, createGateToolApproval } from "./gate.js";
import { type DriverConfig, resolveModel, resolveProviderKey } from "./registry.js";
import { createWorktreeTools } from "./tools.js";

/**
 * The rented agentic loop (ADR Decision 1): Vercel AI SDK `generateText` as a
 * multi-step tool loop, driving the worktree-bound tool set. Claude is the
 * first driver; the provider is a one-line swap behind the registry.
 *
 * Phase 1 scope: NO gates. The Phase 2 gate adapter owns the edit tool's
 * execute path; this loop is deliberately enforcement-free.
 *
 * The model client is injectable so tests drive the loop with a scripted
 * mock (`ai/test`) — the default is the real `@ai-sdk/anthropic` factory
 * built from the registry's driver config.
 */

export interface RunDriverOptions {
	/** Absolute path to the worktree the tools are bound to. */
	worktree: string;
	/** The task prompt for the model. */
	prompt: string;
	/** Optional system prompt. */
	system?: string;
	/**
	 * Resolved provider config (registry). Defaults to the Claude driver.
	 * Ignored when `model` is injected.
	 */
	driver?: DriverConfig;
	/**
	 * Injectable model client — tests pass a mock; production omits it and
	 * gets the real provider built from `driver`.
	 */
	model?: LanguageModel;
	/** Max model steps before the loop stops. Default 16. */
	maxSteps?: number;
	/**
	 * Live progress: called after every model step with the step's tool calls.
	 * The CLI uses this to print a ticker — a multi-minute run must never be
	 * silent (Sandy's staging feedback, 2026-07-27).
	 */
	onStep?: (step: { index: number; toolCalls: DriverToolCall[] }) => void;
	/**
	 * Tier-1 gate wiring (Phase 2). When set, the edit/writeFile tools are
	 * gate-owned (primary, own-the-execute) AND the SDK-native `toolApproval`
	 * layer runs the same gate scripts above the provider swap (secondary,
	 * defense-in-depth) with HMAC-signed approvals. Omit for a gate-free loop.
	 */
	gate?: RunGateOptions;
}

export interface RunGateOptions {
	/**
	 * Absolute paths to the gate scripts, run in order. Injectable for tests;
	 * defaults to resolving from the target project's `.claude/hooks/`.
	 */
	scripts?: string[];
	/**
	 * Secret for `experimental_toolApprovalSecret` HMAC signing so a forged or
	 * tampered approval is rejected before execution. Default: a random
	 * per-run secret.
	 */
	approvalSecret?: string | Uint8Array;
}

export interface DriverToolCall {
	toolName: string;
	input: unknown;
}

export interface DriverRunResult {
	/** Final text the model produced. */
	text: string;
	/** Number of model steps the loop took. */
	steps: number;
	/** Every tool call the loop executed, in order. */
	toolCalls: DriverToolCall[];
	/** The loop's final finish reason (e.g. "stop"). */
	finishReason: string;
	/** Aggregated token usage across the run — the cost-to-done raw datum. */
	usage: { inputTokens?: number; outputTokens?: number };
}

const DEFAULT_MAX_STEPS = 16;

const DEFAULT_SYSTEM = [
	"You are a coding agent operating on a git worktree.",
	"Use the tools (readFile, writeFile, edit, bash, list) to complete the task.",
	"All paths are relative to the worktree root; you cannot touch anything outside it.",
	"When the task is complete, reply with a short summary instead of calling a tool.",
].join(" ");

/**
 * Build the real provider model from a registry driver config — the
 * provider-agnostic factory (one `@ai-sdk/*` line per provider, ADR Decision
 * 1). The API key resolves through the registry's key-env bridge and is
 * passed explicitly, so alternate conventional env names work without
 * touching the SDK's own env lookup.
 */
export function createDriverModel(driver: DriverConfig): LanguageModel {
	const apiKey = resolveProviderKey(driver);
	switch (driver.provider) {
		case "anthropic":
			return createAnthropic({ apiKey })(driver.model);
		case "google":
			return createGoogleGenerativeAI({ apiKey })(driver.model);
		default:
			throw new Error(
				`Provider "${driver.provider}" has no driver yet — anthropic (Phase 1) and google (Phase 4) are wired.`,
			);
	}
}

/**
 * Run the multi-step tool loop against a worktree. Resolves when the model
 * finishes (no more tool calls) or the step cap is hit.
 */
export async function runDriver(options: RunDriverOptions): Promise<DriverRunResult> {
	const driver = options.driver ?? resolveModel("claude");
	const model = options.model ?? createDriverModel(driver);
	const tools = options.gate
		? createGatedWorktreeTools(options.worktree, { scripts: options.gate.scripts })
		: createWorktreeTools(options.worktree);

	const result = await generateText({
		model,
		tools,
		system: options.system ?? DEFAULT_SYSTEM,
		prompt: options.prompt,
		stopWhen: stepCountIs(options.maxSteps ?? DEFAULT_MAX_STEPS),
		onStepFinish: (() => {
			let index = 0;
			return (step: { toolCalls: ReadonlyArray<{ toolName: string; input: unknown }> }) => {
				options.onStep?.({
					index: index++,
					toolCalls: step.toolCalls.map((call) => ({
						toolName: call.toolName,
						input: call.input,
					})),
				});
			};
		})(),
		...(options.gate
			? {
					toolApproval: createGateToolApproval(options.worktree, {
						scripts: options.gate.scripts,
					}),
					experimental_toolApprovalSecret: options.gate.approvalSecret ?? randomBytes(32),
				}
			: {}),
	});

	return {
		text: result.text,
		steps: result.steps.length,
		toolCalls: result.steps.flatMap((step) =>
			step.toolCalls.map((call) => ({
				toolName: call.toolName,
				input: call.input,
			})),
		),
		finishReason: result.finishReason,
		usage: {
			inputTokens: result.totalUsage.inputTokens,
			outputTokens: result.totalUsage.outputTokens,
		},
	};
}
