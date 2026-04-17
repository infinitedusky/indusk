import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SpanStatusCode, trace } from "@opentelemetry/api";
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

	// Set up an in-memory exporter that our code will discover via the global
	// OTel API. We register it here and import the evaluator dynamically AFTER,
	// so `initEvalOtel`'s "already-registered" short-circuit returns our tracer.
	trace.disable();
	exporter = new InMemorySpanExporter();
	provider = new NodeTracerProvider({
		spanProcessors: [new SimpleSpanProcessor(exporter)],
	});
	provider.register();
});

afterEach(async () => {
	await provider.shutdown().catch(() => {});
	trace.disable();
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
