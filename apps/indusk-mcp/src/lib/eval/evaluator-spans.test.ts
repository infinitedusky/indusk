import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import {
	InMemoryLogRecordExporter,
	LoggerProvider,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// NB: we mock node:child_process before importing the module under test so the
// evaluator never actually spawns a Claude subprocess.
vi.mock("node:child_process", async () => {
	const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");

	type Handler = (code: number | null) => void;
	const make = () => {
		const handlers: {
			close: Handler[];
			data_stdout: ((b: Buffer) => void)[];
			data_stderr: ((b: Buffer) => void)[];
		} = {
			close: [],
			data_stdout: [],
			data_stderr: [],
		};
		const fake = {
			stdin: { write: vi.fn(), end: vi.fn() },
			stdout: {
				on: (event: string, cb: (b: Buffer) => void) => {
					if (event === "data") handlers.data_stdout.push(cb);
				},
			},
			stderr: {
				on: (event: string, cb: (b: Buffer) => void) => {
					if (event === "data") handlers.data_stderr.push(cb);
				},
			},
			on: (event: string, cb: Handler) => {
				if (event === "close") handlers.close.push(cb);
			},
		};

		// Synthesize a successful Claude run with a valid scorecard JSON
		const scorecard = {
			version: 1,
			timestamp: "2026-04-17T20:00:00.000Z",
			mode: "eval",
			changeId: "testchange1",
			projectGroup: "test-project",
			questions: [],
			summary: "test scorecard",
			graphitiWrites: 0,
			telemetryPosted: false,
		};
		const claudeJson = JSON.stringify({
			result: JSON.stringify(scorecard),
			session_id: "test-session-id",
			total_cost_usd: 0.1,
			usage: {
				input_tokens: 100,
				output_tokens: 50,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
			},
			duration_ms: 1000,
		});

		// Fire events asynchronously on next tick
		setImmediate(() => {
			for (const cb of handlers.data_stdout) cb(Buffer.from(claudeJson));
			for (const cb of handlers.close) cb(0);
		});

		return fake;
	};

	return {
		...actual,
		spawn: vi.fn(() => make()),
	};
});

let projectRoot: string;
let exporter: InMemorySpanExporter;
let provider: NodeTracerProvider;
let logExporter: InMemoryLogRecordExporter;
let logProvider: LoggerProvider;

const ENV_KEYS = ["INDUSK_EVAL_OTEL", "OTEL_EXPORTER_OTLP_ENDPOINT", "INDUSK_EVAL_SOURCE"];
let savedEnv: Record<string, string | undefined>;

beforeEach(async () => {
	projectRoot = join(tmpdir(), `eval-spans-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(join(projectRoot, ".indusk", "eval"), { recursive: true });

	savedEnv = {};
	for (const k of ENV_KEYS) {
		savedEnv[k] = process.env[k];
		delete process.env[k];
	}

	// Set up in-memory exporters that our code discovers via the global OTel
	// API. Registered here BEFORE the evaluator is dynamically imported, so
	// `initEvalOtel` / `initEvalOtelLogs`'s "already-registered" short-circuit
	// returns our tracer + logger.
	trace.disable();
	logs.disable();
	exporter = new InMemorySpanExporter();
	provider = new NodeTracerProvider({
		spanProcessors: [new SimpleSpanProcessor(exporter)],
	});
	provider.register();
	logExporter = new InMemoryLogRecordExporter();
	logProvider = new LoggerProvider({
		processors: [new SimpleLogRecordProcessor(logExporter)],
	});
	logs.setGlobalLoggerProvider(logProvider);
});

afterEach(async () => {
	await provider.shutdown().catch(() => {});
	await logProvider.shutdown().catch(() => {});
	trace.disable();
	logs.disable();
	rmSync(projectRoot, { recursive: true, force: true });

	for (const k of ENV_KEYS) {
		if (savedEnv[k] === undefined) delete process.env[k];
		else process.env[k] = savedEnv[k];
	}
});

function writeConfigEnabled(): void {
	writeFileSync(
		join(projectRoot, ".indusk", "config.json"),
		JSON.stringify({ eval: { otel: { enabled: true } } }),
	);
}

function spansByName(spans: ReadableSpan[]): Record<string, ReadableSpan[]> {
	const byName: Record<string, ReadableSpan[]> = {};
	for (const s of spans) {
		if (!byName[s.name]) byName[s.name] = [];
		byName[s.name].push(s);
	}
	return byName;
}

describe("T8: evaluator run emits a root span `eval.run` with changeId/source/mode/projectGroup attributes", () => {
	it("root span exists with the expected attributes (runPersistentEval, INDUSK_EVAL_SOURCE override)", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
		process.env.INDUSK_EVAL_SOURCE = "handoff";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "testchange1",
			transcriptPath: "/tmp/transcript.jsonl",
			mode: "eval",
		});

		const spans = exporter.getFinishedSpans();
		const runSpans = spans.filter((s) => s.name === "eval.run");
		expect(runSpans.length).toBe(1);
		const root = runSpans[0];
		expect(root.attributes.changeId).toBe("testchange1");
		expect(root.attributes.source).toBe("handoff");
		expect(root.attributes.mode).toBe("eval");
		expect(root.attributes.projectGroup).toBeDefined();
	});

	it("root span defaults source to 'commit' when INDUSK_EVAL_SOURCE is unset", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-default",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const root = exporter.getFinishedSpans().find((s) => s.name === "eval.run");
		expect(root?.attributes.source).toBe("commit");
	});
});

describe("T9: root span has wrapper-level child spans in roughly chronological order", () => {
	it("runPersistentEval emits read_session, build_prompt, spawn_claude, parse_output, update_session, write_scorecard", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "testchange1",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const byName = spansByName(exporter.getFinishedSpans());
		expect(byName["eval.run"]).toHaveLength(1);
		expect(byName["eval.read_session"]).toHaveLength(1);
		expect(byName["eval.build_prompt"]).toHaveLength(1);
		expect(byName["eval.spawn_claude"]).toHaveLength(1);
		expect(byName["eval.parse_output"]).toHaveLength(1);
		expect(byName["eval.update_session"]).toHaveLength(1);
		expect(byName["eval.write_scorecard"]).toHaveLength(1);
	});

	it("child spans are parented under eval.run", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-parent",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const spans = exporter.getFinishedSpans();
		const root = spans.find((s) => s.name === "eval.run");
		expect(root).toBeDefined();
		const rootId = root?.spanContext().spanId;
		const children = spans.filter((s) => s.name.startsWith("eval.") && s.name !== "eval.run");
		for (const c of children) {
			expect(c.parentSpanContext?.spanId ?? c.parentSpanContext?.spanId).toBe(rootId);
		}
	});

	it("spawn_claude span has exit.code attribute", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-spawn",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const spawn = exporter.getFinishedSpans().find((s) => s.name === "eval.spawn_claude");
		expect(spawn?.attributes["exit.code"]).toBe(0);
	});

	it("parse_output span captures cost + tokens + session_id", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-parse",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const parse = exporter.getFinishedSpans().find((s) => s.name === "eval.parse_output");
		expect(parse?.attributes.session_id).toBe("test-session-id");
		expect(parse?.attributes.cost_usd).toBe(0.1);
		expect(parse?.attributes.input_tokens).toBe(100);
		expect(parse?.attributes.output_tokens).toBe(50);
	});

	it("root span status is OK on success (not ERROR)", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-ok",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const root = exporter.getFinishedSpans().find((s) => s.name === "eval.run");
		expect(root?.status.code).not.toBe(SpanStatusCode.ERROR);
	});
});

describe("T10: root span carries highlights.unprocessed_count attribute", () => {
	it("zero when no highlights exist", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-nohighlights",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const root = exporter.getFinishedSpans().find((s) => s.name === "eval.run");
		expect(root?.attributes["highlights.unprocessed_count"]).toBe(0);
	});

	it("counts unprocessed highlights when queue is non-empty", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { writeHighlight } = await import("../highlights/highlights.js");
		writeHighlight(projectRoot, { tag: "observation", note: "one", level: "note" });
		writeHighlight(projectRoot, { tag: "correction", note: "two", level: "important" });
		writeHighlight(projectRoot, { tag: "brief-accepted", note: "three", level: "critical" });

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-withhighlights",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const root = exporter.getFinishedSpans().find((s) => s.name === "eval.run");
		expect(root?.attributes["highlights.unprocessed_count"]).toBe(3);
	});
});

describe("T12: OTel logs emit content at prompt / claude.stdout / scorecard emission points", () => {
	it("emits log records for prompt + claude.stdout + scorecard with body populated", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-logs",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const records = logExporter.getFinishedLogRecords();
		const byEvent: Record<string, number> = {};
		for (const r of records) {
			const evt = r.attributes?.["eval.event"];
			if (typeof evt === "string") byEvent[evt] = (byEvent[evt] ?? 0) + 1;
		}
		expect(byEvent.prompt).toBeGreaterThanOrEqual(1);
		expect(byEvent["claude.stdout"]).toBeGreaterThanOrEqual(1);
		expect(byEvent.scorecard).toBeGreaterThanOrEqual(1);

		// Each log record has a non-empty body
		for (const r of records) {
			const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
			expect(body.length).toBeGreaterThan(0);
		}
	});

	it("scorecard log carries question_count attribute", async () => {
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const { runPersistentEval } = await import("./persistent-evaluator.js");
		await runPersistentEval({
			projectRoot,
			changeId: "cid-logs-attrs",
			transcriptPath: "/tmp/t.jsonl",
			mode: "eval",
		});

		const scorecardLog = logExporter
			.getFinishedLogRecords()
			.find((r) => r.attributes?.["eval.event"] === "scorecard");
		expect(scorecardLog).toBeDefined();
		expect(scorecardLog?.attributes?.["scorecard.question_count"]).toBeDefined();
	});
});

describe("T11: thrown exceptions are recorded on the span and set root status to ERROR", () => {
	it("withSpan records exception + sets ERROR status", async () => {
		const { initEvalOtel, withSpan } = await import("./otel.js");
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const tracer = initEvalOtel(projectRoot);

		await expect(
			withSpan(tracer, "test.span", undefined, () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");

		const spans = exporter.getFinishedSpans();
		const errored = spans.find((s) => s.name === "test.span");
		expect(errored).toBeDefined();
		expect(errored?.status.code).toBe(SpanStatusCode.ERROR);
		// recordException adds an exception event to the span
		expect(errored?.events.some((e) => e.name === "exception")).toBe(true);
	});

	it("when withSpan children throw, exception propagates and wrapping span goes ERROR", async () => {
		const { initEvalOtel, withSpan } = await import("./otel.js");
		writeConfigEnabled();
		process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

		const tracer = initEvalOtel(projectRoot);

		await expect(
			withSpan(tracer, "outer", undefined, async () => {
				await withSpan(tracer, "inner", undefined, () => {
					throw new Error("inner-boom");
				});
			}),
		).rejects.toThrow("inner-boom");

		const spans = exporter.getFinishedSpans();
		const outer = spans.find((s) => s.name === "outer");
		const inner = spans.find((s) => s.name === "inner");
		expect(inner?.status.code).toBe(SpanStatusCode.ERROR);
		expect(outer?.status.code).toBe(SpanStatusCode.ERROR);
	});
});
