// promise: a-click-and-its-server-work-share-a-trace
//
// browser-telemetry-leftovers, Test Phase 1: A1, A2, A3 — what the shipped
// browser template (instrumentation.web.ts) does with a click that makes
// requests. Runs in headless Chromium (vitest.templates.config.ts).
//
// How it observes: `window.fetch` is replaced by a recorder BEFORE the template
// is imported, so the template's FetchInstrumentation wraps the recorder and the
// recorder sees the headers the instrumentation injected. An in-memory exporter
// on a provider registered first reads the click span back. Requests are
// recorded, never sent.
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const exporter = new InMemorySpanExporter();
// The test runner talks to its own server over fetch; only the page's requests
// under test are recorded, everything for the runner goes to the real thing.
const realFetch = window.fetch.bind(window);
const isRunnerRequest = (url: string) => /__vitest|\/@(vite|fs|id)\b|\.vite\//.test(url);

type Recorded = { url: string; traceparent: string | null };
let recorded: Recorded[] = [];
let imports = 0;

beforeAll(() => {
	// Registered before the template so it is the global provider; the template's
	// own `provider.register()` then no-ops, and its instrumentations trace into
	// this exporter. Same defaults the template gets (stack context manager, W3C).
	new WebTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();

	// TEMPORARY SHIM, remove when the template stops calling it. The template calls
	// `provider.addSpanProcessor(...)`, which sdk-trace-web 2.x (the version its own
	// install line fetches) no longer has: imported unshimmed it throws
	// "provider.addSpanProcessor is not a function" before any assertion runs.
	// A no-op here lets the template load so A1-A3 assert on propagation, not on
	// that crash. Build Phase 1 owns the template fix (pass `spanProcessors` to the
	// constructor) and deletes this shim with it.
	const proto = WebTracerProvider.prototype as unknown as Record<string, unknown>;
	proto.addSpanProcessor ??= () => {};
});

beforeEach(() => {
	exporter.reset();
	recorded = [];
	// Next's bundler inlines process.env.NEXT_PUBLIC_*; a Vite page has no `process`.
	vi.stubGlobal("process", { env: {} });
	window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input);
		if (isRunnerRequest(url)) return realFetch(input, init);
		const headers = new Headers(
			init?.headers ?? (input instanceof Request ? input.headers : undefined),
		);
		recorded.push({ url, traceparent: headers.get("traceparent") });
		return new Response("ok");
	}) as typeof window.fetch;
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	document.body.innerHTML = "";
});

/** Import the template fresh, click a button whose handler fetches `urls`, return what was sent. */
async function clickAndFetch(
	urls: string[],
): Promise<{ sent: Recorded[]; clickTraceIds: string[] }> {
	await import(/* @vite-ignore */ `./instrumentation.web.ts?fresh=${++imports}`);
	const button = document.createElement("button");
	document.body.append(button);
	// All fetches start synchronously inside the handler: the stack context manager
	// does not follow an await, and propagation from a click is about the call made
	// while the click is the active span.
	button.addEventListener("click", () => {
		for (const url of urls) void fetch(url);
	});
	button.click();
	await vi.waitFor(() => expect(recorded.length).toBe(urls.length));
	await vi.waitFor(() =>
		expect(exporter.getFinishedSpans().some((s) => s.name === "click")).toBe(true),
	);
	const clickTraceIds = exporter
		.getFinishedSpans()
		.filter((s) => s.name === "click")
		.map((s) => s.spanContext().traceId);
	return { sent: recorded, clickTraceIds };
}

const traceIdOf = (traceparent: string | null) => traceparent?.split("-")[1];

describe("instrumentation.web template", () => {
	it("A1: a same-origin request from a click carries a traceparent in the click's trace", async () => {
		const { sent, clickTraceIds } = await clickAndFetch([`${location.origin}/api/ping`]);
		expect(sent[0].traceparent, "same-origin request has a traceparent").not.toBeNull();
		expect(clickTraceIds).toContain(traceIdOf(sent[0].traceparent));
	});

	it("A2: VITE_OTEL_PROPAGATE_TO names an origin: that origin gets the click's trace, a third party does not", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "http://localhost:3000");
		const { sent, clickTraceIds } = await clickAndFetch([
			"http://localhost:3000/api/seats",
			"https://api.thirdparty.example/v1/x",
		]);
		const named = sent.find((r) => r.url.startsWith("http://localhost:3000"));
		const third = sent.find((r) => r.url.startsWith("https://api.thirdparty.example"));
		expect(named?.traceparent, "named origin carries traceparent").not.toBeNull();
		expect(clickTraceIds).toContain(traceIdOf(named?.traceparent ?? null));
		expect(third?.traceparent, "third party carries no traceparent").toBeNull();
	});

	it("A3: a * pattern matches sibling subdomains and not a lookalike host", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "https://*.dev.example.com");
		const { sent, clickTraceIds } = await clickAndFetch([
			"https://plan-a.dev.example.com/api",
			"https://plan-b.dev.example.com/api",
			"https://dev.example.com.evil.test/api",
		]);
		const by = (host: string) => sent.find((r) => r.url.startsWith(`https://${host}/`));
		for (const host of ["plan-a.dev.example.com", "plan-b.dev.example.com"]) {
			const tp = by(host)?.traceparent ?? null;
			expect(tp, `${host} carries traceparent`).not.toBeNull();
			expect(clickTraceIds).toContain(traceIdOf(tp));
		}
		expect(by("dev.example.com.evil.test")?.traceparent, "lookalike carries none").toBeNull();
	});
});
