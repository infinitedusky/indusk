/**
 * Provider registry for the external orchestrator (`indusk run`).
 *
 * ADR Decision 5: direct per-provider API keys behind a thin registry — NO
 * commercial gateway. Each provider is hit directly with your own key so
 * per-provider credit arbitrage is preserved. This file is *config*, not a
 * dependency: `--model <name>` selects an entry, and the resolved driver
 * config is what the (Phase 1) Vercel AI SDK loop instantiates a provider from.
 *
 * The `defaultModel` strings are the registry's opinion of each provider's
 * current workhorse model; they are confirmed against the installed
 * `@ai-sdk/*` provider packages when those land in Phase 1. `--model` selecting
 * a specific model id (rather than a provider/alias) is a later concern — Phase
 * 0 only needs provider selection.
 */

export interface ProviderConfig {
	/** Environment variable the provider's own API key is read from. */
	apiKeyEnv: string;
	/** Default model id used when `--model` names the provider, not a model. */
	defaultModel: string;
}

/** provider → { apiKeyEnv, defaultModel } — the four MVP targets. */
export const PROVIDER_REGISTRY = {
	anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-5" },
	openai: { apiKeyEnv: "OPENAI_API_KEY", defaultModel: "gpt-5" },
	google: { apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY", defaultModel: "gemini-2.5-pro" },
	xai: { apiKeyEnv: "XAI_API_KEY", defaultModel: "grok-4" },
} as const satisfies Record<string, ProviderConfig>;

export type ProviderName = keyof typeof PROVIDER_REGISTRY;

/**
 * Friendly `--model` aliases (from the brief: `claude|gpt|gemini|grok`) plus the
 * bare provider names, all mapping to a provider. Case-insensitive; the resolver
 * lowercases and trims before lookup.
 */
const MODEL_ALIASES: Record<string, ProviderName> = {
	claude: "anthropic",
	anthropic: "anthropic",
	gpt: "openai",
	openai: "openai",
	gemini: "google",
	google: "google",
	grok: "xai",
	xai: "xai",
};

/** A resolved driver config: which provider, its key env, and the model id. */
export interface DriverConfig {
	provider: ProviderName;
	apiKeyEnv: string;
	model: string;
}

/**
 * Resolve a `--model <name>` value into a {@link DriverConfig}. Accepts a
 * friendly alias (`claude`, `gpt`, `gemini`, `grok`) or a bare provider name
 * (`anthropic`, `openai`, `google`, `xai`), case-insensitively. Throws on an
 * unknown name — the caller surfaces the message and exits non-zero.
 */
export function resolveModel(name: string): DriverConfig {
	const key = name.toLowerCase().trim();
	const provider = MODEL_ALIASES[key];
	if (!provider) {
		const known = Object.keys(MODEL_ALIASES).sort().join(", ");
		throw new Error(`Unknown model "${name}". Known models: ${known}.`);
	}
	const cfg = PROVIDER_REGISTRY[provider];
	return { provider, apiKeyEnv: cfg.apiKeyEnv, model: cfg.defaultModel };
}
