import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetEvalOtelForTests, initEvalOtel, isEvalOtelEnabled } from "./otel.js";

let projectRoot: string;

const ENV_KEYS = ["INDUSK_EVAL_OTEL", "OTEL_EXPORTER_OTLP_ENDPOINT", "INDUSK_EVAL_OTEL_DATASET"];
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
	projectRoot = join(tmpdir(), `eval-otel-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });

	// Save env, then clear our keys so each test starts from a known state
	savedEnv = {};
	for (const k of ENV_KEYS) {
		savedEnv[k] = process.env[k];
		delete process.env[k];
	}

	__resetEvalOtelForTests();
});

afterEach(() => {
	rmSync(projectRoot, { recursive: true, force: true });

	// Restore env
	for (const k of ENV_KEYS) {
		if (savedEnv[k] === undefined) {
			delete process.env[k];
		} else {
			process.env[k] = savedEnv[k];
		}
	}
});

function writeConfig(body: Record<string, unknown>): void {
	writeFileSync(join(projectRoot, ".indusk", "config.json"), JSON.stringify(body));
}

describe("T4: initEvalOtel returns a no-op tracer when eval.otel.enabled is unset and INDUSK_EVAL_OTEL is unset", () => {
	it("no config + no env → not enabled, no endpoint, default dataset 'agent'", () => {
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.enabled).toBe(false);
		expect(state.endpoint).toBeNull();
		expect(state.dataset).toBe("agent");
	});

	it("initEvalOtel returns a tracer without initializing a provider when disabled", () => {
		const tracer = initEvalOtel(projectRoot);
		expect(tracer).toBeDefined();
		// No-op tracer: startSpan returns a span whose isRecording() is false
		const span = tracer.startSpan("test-span");
		expect(span.isRecording()).toBe(false);
		span.end();
	});

	it("no system.log entry is produced when disabled (nothing to log)", () => {
		initEvalOtel(projectRoot);
		const logPath = join(projectRoot, ".indusk", "eval", "system.log");
		expect(existsSync(logPath)).toBe(false);
	});
});

describe("T5: initEvalOtel returns a real tracer when eval.otel.enabled: true AND OTEL_EXPORTER_OTLP_ENDPOINT is set", () => {
	it("config enabled + endpoint set → real tracer (isRecording = true)", () => {
		writeConfig({ eval: { otel: { enabled: true } } });
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const tracer = initEvalOtel(projectRoot);
		const span = tracer.startSpan("real-span");
		expect(span.isRecording()).toBe(true);
		span.end();
	});

	it("isEvalOtelEnabled reflects the config + endpoint correctly", () => {
		writeConfig({ eval: { otel: { enabled: true } } });
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.enabled).toBe(true);
		expect(state.endpoint).toBe("http://localhost:4318");
	});

	it("system.log records the endpoint when initialized", () => {
		writeConfig({ eval: { otel: { enabled: true } } });
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		initEvalOtel(projectRoot);

		const logPath = join(projectRoot, ".indusk", "eval", "system.log");
		expect(existsSync(logPath)).toBe(true);
		const log = readFileSync(logPath, "utf-8");
		expect(log).toMatch(/eval\.otel initialized/);
		expect(log).toContain("http://localhost:4318");
	});
});

describe("T6: initEvalOtel returns a no-op tracer AND logs a warning when enabled but endpoint is missing", () => {
	it("config enabled + no endpoint → no-op tracer (does not throw)", () => {
		writeConfig({ eval: { otel: { enabled: true } } });
		// OTEL_EXPORTER_OTLP_ENDPOINT intentionally unset

		expect(() => initEvalOtel(projectRoot)).not.toThrow();
		const tracer = initEvalOtel(projectRoot);
		const span = tracer.startSpan("test-span");
		expect(span.isRecording()).toBe(false);
		span.end();
	});

	it("writes a warning line to system.log explaining the fallback", () => {
		writeConfig({ eval: { otel: { enabled: true } } });

		initEvalOtel(projectRoot);

		const logPath = join(projectRoot, ".indusk", "eval", "system.log");
		expect(existsSync(logPath)).toBe(true);
		const log = readFileSync(logPath, "utf-8");
		expect(log).toMatch(/eval\.otel\.enabled but OTEL_EXPORTER_OTLP_ENDPOINT is unset/);
		expect(log).toMatch(/falling back to no-op tracer/);
	});
});

describe("T7: INDUSK_EVAL_OTEL=1 env var overrides eval.otel.enabled: false in config", () => {
	it("env '1' with config disabled → enabled", () => {
		writeConfig({ eval: { otel: { enabled: false } } });
		process.env.INDUSK_EVAL_OTEL = "1";

		const state = isEvalOtelEnabled(projectRoot);
		expect(state.enabled).toBe(true);
	});

	it("env 'true' with no config → enabled", () => {
		process.env.INDUSK_EVAL_OTEL = "true";
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.enabled).toBe(true);
	});

	it("env '0' (falsy) with config enabled → still enabled (env '0' does NOT override enabled config)", () => {
		// Env var override is one-way — env forces enabled, but env=0 does not disable a config-enabled tracer
		writeConfig({ eval: { otel: { enabled: true } } });
		process.env.INDUSK_EVAL_OTEL = "0";

		const state = isEvalOtelEnabled(projectRoot);
		expect(state.enabled).toBe(true);
	});

	it("env 'false' with no config → not enabled (env is not truthy, config default is false)", () => {
		process.env.INDUSK_EVAL_OTEL = "false";
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.enabled).toBe(false);
	});
});

describe("eval.otel dataset resolution (Dash0-Dataset header)", () => {
	it("defaults to 'agent' when no config and no env var", () => {
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.dataset).toBe("agent");
	});

	it("reads eval.otel.dataset from config when no env var", () => {
		writeConfig({ eval: { otel: { enabled: true, dataset: "my-custom" } } });
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.dataset).toBe("my-custom");
	});

	it("INDUSK_EVAL_OTEL_DATASET env var overrides config", () => {
		writeConfig({ eval: { otel: { enabled: true, dataset: "from-config" } } });
		process.env.INDUSK_EVAL_OTEL_DATASET = "from-env";
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.dataset).toBe("from-env");
	});

	it("empty-string env var falls back to config or default", () => {
		writeConfig({ eval: { otel: { enabled: true, dataset: "from-config" } } });
		process.env.INDUSK_EVAL_OTEL_DATASET = "";
		const state = isEvalOtelEnabled(projectRoot);
		expect(state.dataset).toBe("from-config");
	});

	it("logs the dataset when initialized", () => {
		writeConfig({ eval: { otel: { enabled: true, dataset: "agent-custom" } } });
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		initEvalOtel(projectRoot);

		const logPath = join(projectRoot, ".indusk", "eval", "system.log");
		const log = readFileSync(logPath, "utf-8");
		expect(log).toContain("dataset: agent-custom");
	});
});
