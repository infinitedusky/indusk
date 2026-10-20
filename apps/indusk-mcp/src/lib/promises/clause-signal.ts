import type { Tracer } from "@opentelemetry/api";
import { commandTracerAsync, flushCommandTracer } from "../telemetry/command-tracer.js";
import { markProjectId } from "./config.js";
import { markPromise } from "./mark.js";

/**
 * One clause's verdict from a check that just ran: upheld, or broken naming what it saw.
 */
export interface ClauseVerdict {
	promise: string;
	clause: string;
	/** What was seen when the clause broke; absent when it held. */
	broken?: string;
}

/**
 * Write one `markPromise` span per verdict through the commands' one tracer (a span names
 * one clause, `indusk.clause`). Best-effort: a signal must never fail the command that
 * writes it. With no tracer given it flushes the command tracer, as `markClosing` does.
 */
export async function writeClauseSignals(
	projectRoot: string,
	spanName: string,
	plan: string,
	signal: { plan: string; phase: string },
	verdicts: readonly ClauseVerdict[],
	tracer?: Tracer,
): Promise<void> {
	try {
		const project = markProjectId(projectRoot);
		// Found asynchronously: a page's report must not stop the server to look for the daemon.
		const use = tracer ?? (await commandTracerAsync());
		for (const v of verdicts) {
			const span = use.startSpan(spanName);
			span.setAttribute("indusk.plan", plan);
			markPromise(span, {
				promise: v.promise,
				clause: v.clause,
				project,
				outcome: v.broken === undefined ? "upheld" : "broken",
				signal,
				...(v.broken === undefined ? {} : { symptom: v.broken }),
			});
			span.end();
		}
	} catch {
		// A signal is best-effort: writing it must never fail the command.
	}
	if (!tracer) await flushCommandTracer();
}
