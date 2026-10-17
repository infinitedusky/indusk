// clause: a-new-project-reports-from-its-first-run/the-spans-reach-the-daemon
// clause: a-new-project-reports-from-its-first-run/every-span-says-where-it-ran
// clause: an-app-writes-its-signal-from-a-helper-it-owns/a-test-run-says-so
//
// a-new-project-starts-instrumented, Build Phase 1: T5, T8, T15 (its settings half) - the
// settings file every scaffolded app carries (`templates/telemetry-settings.ts`), read as
// a plain function from the environment and the rendered values to where the app sends,
// the service it names and what its spans' resource says; and the scaffold's renderer,
// which fills the rendered values with the daemon's stored address, else InDusk's block.
import { describe, expect, it } from "vitest";
import { telemetrySettings } from "../../templates/telemetry-settings.js";
import { settingsValues } from "../lib/scaffold/render.js";
import { PORT_BLOCK } from "../lib/telemetry/daemon-address.js";

const RENDERED = {
	service: "homework-gate",
	project: "homework_gate_workbench",
	traces: "http://localhost:24318",
	logs: "http://localhost:24319",
};

describe("where a scaffolded app sends", () => {
	it("T5: with nothing set, traces and logs go to the daemon's stored address", () => {
		const s = telemetrySettings({}, RENDERED);
		expect(s.tracesUrl).toBe("http://localhost:24318/v1/traces");
		expect(s.logsUrl).toBe("http://localhost:24319/v1/logs");
	});
	it("T5: a set endpoint wins, the signal-specific one over the general one", () => {
		const general = { OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.example" };
		expect(telemetrySettings(general, RENDERED).tracesUrl).toBe(
			"https://collector.example/v1/traces",
		);
		expect(telemetrySettings(general, RENDERED).logsUrl).toBe("https://collector.example/v1/logs");
		const traces = {
			...general,
			OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://t.example/v1/traces",
		};
		expect(telemetrySettings(traces, RENDERED).tracesUrl).toBe("https://t.example/v1/traces");
	});
	it("T5: rendered with no stored address, the default is InDusk's block", () => {
		const v = settingsValues({ service: "app", project: "app", address: null });
		expect(v.traces).toBe(`http://localhost:${PORT_BLOCK.traces}`);
		expect(v.logs).toBe(`http://localhost:${PORT_BLOCK.logs}`);
	});
});

describe("where a scaffolded app's spans say they ran", () => {
	it("T8: development unless set; the set environment wins; the project is the InDusk id", () => {
		expect(telemetrySettings({}, RENDERED).resource).toMatchObject({
			"service.name": "homework-gate",
			"indusk.project": "homework_gate_workbench",
			"deployment.environment": "development",
		});
		const set = { OTEL_RESOURCE_ATTRIBUTES: "deployment.environment=production,team=a" };
		expect(telemetrySettings(set, RENDERED).resource["deployment.environment"]).toBe("production");
		expect(
			telemetrySettings({ OTEL_SERVICE_NAME: "other" }, RENDERED).resource["service.name"],
		).toBe("other");
	});
});

describe("a test run says so", () => {
	it.each([
		[{ VITEST: "true" }, true],
		[{ JEST_WORKER_ID: "1" }, true],
		[{ MODE: "test" }, true],
		[{ NODE_ENV: "test" }, true],
		[{}, false],
		[{ NODE_ENV: "production" }, false],
	])("T15: %j marks a test run: %s", (env, marked) => {
		const s = telemetrySettings(env, RENDERED);
		expect(s.testRun).toBe(marked);
		expect(s.resource["indusk.run"]).toBe(marked ? "test" : undefined);
	});
});
