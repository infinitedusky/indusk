import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, it } from "vitest";
import { PROMISE_MARK } from "../promises/vocabulary.js";
import { type LookResult, reportLooks } from "./report.js";

/**
 * promise: a-look-reports-like-any-promise — ui-promises A22.
 *
 * One span per screen x state x device, carrying the promise mark's
 * attributes, read back from an in-memory exporter.
 */

const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

afterEach(() => exporter.reset());

const results: LookResult[] = [
	{
		app: "demo",
		screen: "home",
		state: "empty",
		device: "phone",
		verdict: { state: "held", findings: [] },
	},
	{
		app: "demo",
		screen: "home",
		state: "empty",
		device: "desktop",
		verdict: {
			state: "broken",
			findings: [{ token: "--dusk", approved: "#c2620b", actual: "#c2620c" }],
		},
	},
];

describe("reportLooks — a look is a span like a promise's run", () => {
	it("emits one span per screen x state x device, with the promise mark", () => {
		reportLooks(results, provider.getTracer("looks-test"), { project: "demo-project" });
		const spans = exporter.getFinishedSpans();
		expect(spans).toHaveLength(2);
		const [held, broken] = spans;
		expect(held?.attributes[PROMISE_MARK.promise]).toBe("tokens-are-held-exactly");
		expect(held?.attributes[PROMISE_MARK.outcome]).toBe("upheld");
		expect(held?.attributes[PROMISE_MARK.project]).toBe("demo-project");
		expect(held?.attributes["indusk.look.device"]).toBe("phone");
		expect(broken?.attributes[PROMISE_MARK.outcome]).toBe("broken");
		expect(broken?.attributes["indusk.look.screen"]).toBe("home");
		expect(broken?.attributes["indusk.look.state"]).toBe("empty");
		expect(broken?.attributes["indusk.look.device"]).toBe("desktop");
	});

	it("names what was seen on the violated event", () => {
		reportLooks(results, provider.getTracer("looks-test"));
		const broken = exporter.getFinishedSpans()[1];
		const event = broken?.events.find((e) => e.name === PROMISE_MARK.violatedEvent);
		expect(String(event?.attributes?.[PROMISE_MARK.symptom])).toContain("--dusk");
		expect(String(event?.attributes?.[PROMISE_MARK.symptom])).toContain("#c2620c");
	});

	it("emits nothing for no results, and never throws", () => {
		reportLooks([], provider.getTracer("looks-test"));
		expect(exporter.getFinishedSpans()).toHaveLength(0);
	});
});
