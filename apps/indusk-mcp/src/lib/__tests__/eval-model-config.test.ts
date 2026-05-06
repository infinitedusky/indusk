import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEvalModel, writeConfig } from "../config.js";

/**
 * `getEvalModel(projectRoot)` reads the `eval.model` field from
 * `.indusk/config.json` and defaults to `"sonnet"` when unset.
 *
 * Why default sonnet: empirical pricing on resume calls (which inherit
 * Claude Code's machine default and don't pass `--model`) shows ~5×
 * cheaper than Opus. Defaulting fresh-call to Sonnet matches that
 * behavior. Set `eval.model: "opus"` to opt back into Opus.
 */

let projectDir: string;

beforeEach(() => {
	projectDir = mkdtempSync(join(tmpdir(), "eval-model-config-"));
});

afterEach(() => {
	if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
});

describe("getEvalModel", () => {
	it("defaults to 'sonnet' when config doesn't exist", () => {
		expect(getEvalModel(projectDir)).toBe("sonnet");
	});

	it("defaults to 'sonnet' when config exists but eval.model is missing", () => {
		writeConfig(projectDir, { mode: "full", verify: {}, detected: {} });
		expect(getEvalModel(projectDir)).toBe("sonnet");
	});

	it("defaults to 'sonnet' when eval block exists but eval.model is missing", () => {
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			eval: { enabled: true },
		});
		expect(getEvalModel(projectDir)).toBe("sonnet");
	});

	it("returns 'opus' when eval.model is set to 'opus'", () => {
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			eval: { model: "opus" },
		});
		expect(getEvalModel(projectDir)).toBe("opus");
	});

	it("returns 'sonnet' when eval.model is set to 'sonnet'", () => {
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			eval: { model: "sonnet" },
		});
		expect(getEvalModel(projectDir)).toBe("sonnet");
	});

	it("returns full model IDs as-is (e.g., 'claude-sonnet-4-6')", () => {
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			eval: { model: "claude-sonnet-4-6" },
		});
		expect(getEvalModel(projectDir)).toBe("claude-sonnet-4-6");
	});

	it("treats empty string as missing and falls back to 'sonnet'", () => {
		writeConfig(projectDir, {
			mode: "full",
			verify: {},
			detected: {},
			eval: { model: "" },
		});
		expect(getEvalModel(projectDir)).toBe("sonnet");
	});

	it("treats non-string values as missing and falls back to 'sonnet'", () => {
		// Hand-write malformed JSON so getEvalModel handles unexpected types
		const fs = require("node:fs") as typeof import("node:fs");
		fs.mkdirSync(join(projectDir, ".indusk"), { recursive: true });
		fs.writeFileSync(
			join(projectDir, ".indusk/config.json"),
			JSON.stringify({ mode: "full", verify: {}, detected: {}, eval: { model: 42 } }),
		);
		expect(getEvalModel(projectDir)).toBe("sonnet");
	});
});
