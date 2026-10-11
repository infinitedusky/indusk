// promise: a-click-and-its-server-work-share-a-trace
// promise: a-propagation-entry-covers-what-it-names
//
// browser-telemetry-leftovers A1–A3 and A9–A13, browser-template-claims T1–T4 — what the shipped
// browser template (instrumentation.web.ts) does with a click that makes
// requests. Runs in headless Chromium (vitest.templates.config.ts).
//
// How it observes: `window.fetch` is replaced by a recorder BEFORE the template
// is imported, so the template's FetchInstrumentation wraps the recorder and the
// recorder sees the headers the instrumentation injected. The click's trace id is
// read from the active span inside the handler. Requests are recorded, never sent.
import { context, propagation, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Recorded = { url: string; traceparent: string | null };
let recorded: Recorded[] = [];
let imports = 0;

// XMLHttpRequest, recorded like fetch: `send` is replaced by a recorder before the template
// is imported, so the template's instrumentation wraps it and the headers it injected through
// `setRequestHeader` are there when the recorder runs. Nothing is sent.
const realXhr = {
	open: XMLHttpRequest.prototype.open,
	setRequestHeader: XMLHttpRequest.prototype.setRequestHeader,
	send: XMLHttpRequest.prototype.send,
};
const xhrState = new WeakMap<XMLHttpRequest, { url: string; traceparent: string | null }>();

function recordXhr() {
	const proto = XMLHttpRequest.prototype;
	proto.open = function (this: XMLHttpRequest, method: string, url: string | URL) {
		xhrState.set(this, { url: String(url), traceparent: null });
		return (realXhr.open as (...a: unknown[]) => void).call(this, method, url);
	} as typeof proto.open;
	proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
		const state = xhrState.get(this);
		if (state && name.toLowerCase() === "traceparent") state.traceparent = value;
		return realXhr.setRequestHeader.call(this, name, value);
	};
	proto.send = function (this: XMLHttpRequest) {
		const state = xhrState.get(this);
		if (state) recorded.push({ url: state.url, traceparent: state.traceparent });
	};
}

beforeEach(() => {
	// Each case starts from an empty API: whichever provider and context manager a
	// previous case registered are gone, so the template's own `register()` is the only
	// thing deciding the context manager (A11 depends on that).
	trace.disable();
	context.disable();
	propagation.disable();
	recorded = [];
	Object.assign(XMLHttpRequest.prototype, realXhr);
	recordXhr();
	window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input);
		const headers = new Headers(
			init?.headers ?? (input instanceof Request ? input.headers : undefined),
		);
		recorded.push({ url, traceparent: headers.get("traceparent") });
		return new Response("ok");
	}) as typeof window.fetch;
});

afterEach(() => {
	vi.unstubAllEnvs();
	document.body.innerHTML = "";
});

/**
 * Import the template fresh, click a button whose handler fetches `urls`, return what was sent.
 * With `afterAwait` the handler awaits a microtask first, as real handlers do.
 */
async function clickAndFetch(
	urls: string[],
	{
		afterAwait = false,
		xhr = false,
		later = null,
	}: { afterAwait?: boolean; xhr?: boolean; later?: "then" | "timer" | null } = {},
): Promise<{ sent: Recorded[]; clickTraceIds: string[]; activeTraceId?: string }> {
	recorded = [];
	await import(/* @vite-ignore */ `./instrumentation.web.ts?fresh=${++imports}`);
	const button = document.createElement("button");
	document.body.append(button);
	// The click's trace id is read from inside the handler, where the click span is the
	// active one; a request is in the click's trace when its traceparent carries that id.
	let activeTraceId: string | undefined;
	button.addEventListener("click", async () => {
		activeTraceId = trace.getSpan(context.active())?.spanContext().traceId;
		if (later) {
			// Not an `await`: the request is made from a callback the handler scheduled.
			const go = () => {
				for (const url of urls) void fetch(url);
			};
			if (later === "then") void Promise.resolve().then(go);
			else setTimeout(go, 0);
			return;
		}
		if (afterAwait) await Promise.resolve();
		for (const url of urls) {
			if (!xhr) {
				void fetch(url);
				continue;
			}
			const req = new XMLHttpRequest();
			req.open("GET", url);
			req.send();
		}
	});
	button.click();
	await vi.waitFor(() => expect(recorded.length).toBe(urls.length));
	const clickTraceIds = activeTraceId ? [activeTraceId] : [];
	return { sent: recorded, clickTraceIds, activeTraceId };
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

	it("A9: an exact origin matches the request however the entry is cased or spelled", async () => {
		for (const entry of ["https://API.Example.com", "https://api.example.com:443"]) {
			vi.stubEnv("VITE_OTEL_PROPAGATE_TO", entry);
			const { sent, clickTraceIds } = await clickAndFetch(["https://api.example.com/seats"]);
			expect(sent[0].traceparent, `entry ${entry} carries traceparent`).not.toBeNull();
			expect(clickTraceIds).toContain(traceIdOf(sent[0].traceparent));
		}
	});

	it("A10: a bare * propagates nowhere, and a scheme-less entry is reported once", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "*");
		const star = await clickAndFetch(["https://api.thirdparty.example/v1/x"]);
		expect(star.sent[0].traceparent, "bare * sends no traceparent to a third party").toBeNull();

		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "localhost:3000");
		await clickAndFetch(["http://localhost:3000/api"]);
		const naming = warn.mock.calls.filter((c) => String(c[0]).includes("localhost:3000"));
		warn.mockRestore();
		expect(naming.length, "one warning names the scheme-less entry").toBe(1);
	});

	// SKIPPED by decision (browser-telemetry-leftovers, Build Phase 2): zone.js does not patch
	// native async/await, so no context manager the template can install carries the click's
	// trace across this `await`. Red against the template as shipped; unskip when browsers have
	// AsyncContext. See the plan's Deferred Verification.
	it.skip("A11: a request made after an await in the click handler is in the click's trace", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "http://localhost:3000");
		const { sent, activeTraceId } = await clickAndFetch(
			[`${location.origin}/api/ping`, "http://localhost:3000/api/seats"],
			{ afterAwait: true },
		);
		expect(activeTraceId, "a click span was active in the handler").toBeDefined();
		for (const r of sent) {
			expect(r.traceparent, `${r.url} carries traceparent after await`).not.toBeNull();
			expect(traceIdOf(r.traceparent)).toBe(activeTraceId);
		}
	});

	it("A13: requests made through XMLHttpRequest carry the click's trace the way fetch does", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "http://localhost:3000");
		const { sent, clickTraceIds } = await clickAndFetch(
			[
				`${location.origin}/api/ping`,
				"http://localhost:3000/api/seats",
				"https://api.thirdparty.example/v1/x",
			],
			{ xhr: true },
		);
		const by = (prefix: string) => sent.find((r) => r.url.startsWith(prefix));
		for (const prefix of [location.origin, "http://localhost:3000"]) {
			const tp = by(prefix)?.traceparent ?? null;
			expect(tp, `${prefix} carries traceparent over XHR`).not.toBeNull();
			expect(clickTraceIds).toContain(traceIdOf(tp));
		}
		expect(
			by("https://api.thirdparty.example")?.traceparent,
			"third party carries none",
		).toBeNull();
	});

	it("T1: an exact entry that names a path covers that path and what is under it, and nothing else", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "https://api.example.com/v1");
		const { sent, clickTraceIds } = await clickAndFetch([
			"https://api.example.com/v1/seats",
			"https://api.example.com/v2/seats",
			"https://api.example.com/v10/seats",
		]);
		const by = (path: string) => sent.find((r) => r.url === `https://api.example.com${path}`);
		const covered = by("/v1/seats")?.traceparent ?? null;
		expect(covered, "/v1/seats carries traceparent").not.toBeNull();
		expect(clickTraceIds).toContain(traceIdOf(covered));
		expect(by("/v2/seats")?.traceparent, "/v2/seats carries none").toBeNull();
		expect(by("/v10/seats")?.traceparent, "/v10/seats carries none").toBeNull();
	});

	it("T2: a pattern entry that names a path covers that path only", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "https://*.dev.example.com/v1");
		const { sent, clickTraceIds } = await clickAndFetch([
			"https://plan-a.dev.example.com/v1/seats",
			"https://plan-a.dev.example.com/v2/seats",
		]);
		const covered = sent[0].traceparent;
		expect(covered, "/v1 on a matching host carries traceparent").not.toBeNull();
		expect(clickTraceIds).toContain(traceIdOf(covered));
		expect(sent[1].traceparent, "/v2 on the same host carries none").toBeNull();
	});

	it("T3: a pattern entry's default port may be written or left off; any other port stays literal", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "https://*.dev.example.com:443");
		const defaultPort = await clickAndFetch(["https://plan-a.dev.example.com/api"]);
		expect(
			defaultPort.sent[0].traceparent,
			":443 written in the entry matches a request whose URL leaves it off",
		).not.toBeNull();

		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "https://*.dev.example.com:8443");
		const other = await clickAndFetch([
			"https://plan-a.dev.example.com:8443/api",
			"https://plan-a.dev.example.com/api",
		]);
		expect(other.sent[0].traceparent, ":8443 request carries traceparent").not.toBeNull();
		expect(other.sent[1].traceparent, "default-port request carries none").toBeNull();
	});

	it("T4: a request made from a .then() callback or a timer is not in the click's trace", async () => {
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "http://localhost:3000");
		for (const later of ["then", "timer"] as const) {
			const { sent, activeTraceId } = await clickAndFetch(["http://localhost:3000/api/seats"], {
				later,
			});
			expect(activeTraceId, `${later}: a click span was active in the handler`).toBeDefined();
			expect(
				traceIdOf(sent[0].traceparent),
				`${later}: the request is not in the click's trace`,
			).not.toBe(activeTraceId);
		}
	});

	it("T6: a path in an entry is compared as written; host and scheme case do not matter", async () => {
		for (const entry of ["https://api.example.com/Admin", "https://*.dev.example.com/Admin"]) {
			vi.stubEnv("VITE_OTEL_PROPAGATE_TO", entry);
			const host = entry.includes("*") ? "plan-a.dev.example.com" : "api.example.com";
			const { sent, clickTraceIds } = await clickAndFetch([
				`https://${host}/Admin/users`,
				`https://${host}/admin/users`,
			]);
			const covered = sent[0].traceparent;
			expect(covered, `${entry}: /Admin carries traceparent`).not.toBeNull();
			expect(clickTraceIds).toContain(traceIdOf(covered));
			expect(sent[1].traceparent, `${entry}: /admin (another resource) carries none`).toBeNull();
		}
		vi.stubEnv("VITE_OTEL_PROPAGATE_TO", "HTTPS://API.Example.com");
		const cased = await clickAndFetch(["https://api.example.com/seats"]);
		expect(
			cased.sent[0].traceparent,
			"scheme and host case in the entry still match",
		).not.toBeNull();
	});

	it("T8: a query or fragment on an entry is ignored, for exact and pattern entries alike", async () => {
		for (const entry of ["https://api.example.com/v1?x=1", "https://*.dev.example.com/v1#top"]) {
			vi.stubEnv("VITE_OTEL_PROPAGATE_TO", entry);
			const host = entry.includes("*") ? "plan-a.dev.example.com" : "api.example.com";
			const { sent, clickTraceIds } = await clickAndFetch([
				`https://${host}/v1/seats`,
				`https://${host}/v2/seats`,
			]);
			const covered = sent[0].traceparent;
			expect(covered, `${entry}: /v1/seats carries traceparent`).not.toBeNull();
			expect(clickTraceIds).toContain(traceIdOf(covered));
			expect(sent[1].traceparent, `${entry}: /v2/seats carries none`).toBeNull();
		}
	});
});
