/**
 * Signal helper — how this app tells InDusk whether a promise held.
 *
 * One call per verdict, from the place the behaviour happens:
 *
 *   import { signal } from "./signal";
 *
 *   signal.upheld({ promise: "a-hold-is-released", clause: "on-time", value: 812, bound: 1000 });
 *   signal.broken({ promise: "a-hold-is-released", clause: "on-time", symptom: "released 5.1 s late" });
 *
 * Each call writes one short span through OpenTelemetry's API (the only import besides
 * ./telemetry-settings), a child of the active span when there is one. The span is
 * ordinary OpenTelemetry: it exports wherever your tracer exports, and anyone with the
 * raw trace can read which promise held and which broke.
 *
 * This file is yours. `indusk update` refreshes it while you leave it as it is; once you
 * change it, a newer version is written beside it as `signal.ts.indusk-new`. The keys it
 * writes are InDusk's vocabulary; a test in InDusk holds them equal, so change none of
 * them here.
 */

import { trace } from "@opentelemetry/api";
import { telemetrySettings } from "./telemetry-settings";

const settings = telemetrySettings(process.env);

/** What a verdict says about the promise it is for. */
interface Measured {
	/** The promise's name, as in its registry file. */
	promise: string;
	/** Which part of the promise this concerns, when several hold it. */
	clause?: string;
	/** What was measured and the bound it is held to. */
	value?: number;
	bound?: number;
	/** The plan and phase that made the promise. */
	plan?: string;
	phase?: string;
}

function write(m: Measured, outcome: "upheld" | "broken", symptom?: string): void {
	const attributes: Record<string, string | number> = {
		"indusk.promise": m.promise,
		"indusk.promise.outcome": outcome,
	};
	if (m.clause !== undefined) attributes["indusk.clause"] = m.clause;
	if (m.value !== undefined) attributes["indusk.signal.value"] = m.value;
	if (m.bound !== undefined) attributes["indusk.signal.bound"] = m.bound;
	if (m.plan !== undefined) attributes["indusk.signal.plan"] = m.plan;
	if (m.phase !== undefined) attributes["indusk.signal.phase"] = m.phase;
	// Readers read the project from the span itself, and the service is not always the project.
	if (settings.resource["indusk.project"]) {
		attributes["indusk.project"] = settings.resource["indusk.project"];
	}
	if (settings.resource["indusk.run"]) attributes["indusk.run"] = settings.resource["indusk.run"];
	const span = trace.getTracer("indusk-signal").startSpan(m.promise, { attributes });
	if (symptom !== undefined) {
		span.addEvent("indusk.promise.violated", { "indusk.promise.symptom": symptom });
	}
	span.end();
}

export const signal = {
	/** The promise held in this run of the behaviour. */
	upheld: (m: Measured): void => write(m, "upheld"),
	/** The promise broke; `symptom` is one line saying what was seen. */
	broken: (m: Measured & { symptom: string }): void => write(m, "broken", m.symptom),
};
