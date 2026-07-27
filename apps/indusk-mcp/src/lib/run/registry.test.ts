import { describe, expect, it } from "vitest";
import { PROVIDER_REGISTRY, resolveModel } from "./registry.js";

describe("provider registry", () => {
	it("exposes the four direct providers with an apiKeyEnv + defaultModel", () => {
		for (const provider of ["anthropic", "openai", "google", "xai"] as const) {
			const cfg = PROVIDER_REGISTRY[provider];
			expect(cfg.apiKeyEnv).toMatch(/\S/);
			expect(cfg.defaultModel).toMatch(/\S/);
		}
	});
});

describe("resolveModel — --model name → driver config", () => {
	it("resolves `claude` to the anthropic driver config (the T0 assertion)", () => {
		const driver = resolveModel("claude");
		expect(driver.provider).toBe("anthropic");
		expect(driver.apiKeyEnv).toBe("ANTHROPIC_API_KEY");
		expect(driver.model).toBe(PROVIDER_REGISTRY.anthropic.defaultModel);
	});

	it("resolves the model aliases for the other three targets", () => {
		expect(resolveModel("gpt").provider).toBe("openai");
		expect(resolveModel("gemini").provider).toBe("google");
		expect(resolveModel("grok").provider).toBe("xai");
	});

	it("resolves the bare provider names directly", () => {
		expect(resolveModel("anthropic").provider).toBe("anthropic");
		expect(resolveModel("openai").provider).toBe("openai");
		expect(resolveModel("google").provider).toBe("google");
		expect(resolveModel("xai").provider).toBe("xai");
	});

	it("is case-insensitive and trims surrounding whitespace", () => {
		expect(resolveModel("  Claude ").provider).toBe("anthropic");
		expect(resolveModel("GROK").provider).toBe("xai");
	});

	it("carries the provider's own key env onto the driver config", () => {
		expect(resolveModel("gpt").apiKeyEnv).toBe("OPENAI_API_KEY");
	});

	it("throws on an unknown model name", () => {
		expect(() => resolveModel("llama")).toThrow(/unknown model/i);
		expect(() => resolveModel("")).toThrow(/unknown model/i);
	});
});
