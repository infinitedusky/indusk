import { type Tracer, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { liveOtlpEndpointSync, type ResolveDeps } from "./status.js";

/**
 * The one tracer for InDusk's own commands (mark-first ADR; lifted from
 * `lib/eval/otel.ts`, which keeps the evaluator's own exporter).
 *
 * A command that emits a span — closing a plan, writing an incident,
 * `new_project.create` — asks here instead of building a provider. The
 * provider is made on the first ask, exports to the local daemon at the
 * address it is found at (`liveOtlpEndpointSync`, never a guessed port:
 * `/decisions/daemon-found-not-guessed`), and is not registered globally, so
 * it never competes with the evaluator's. With no daemon running the tracer is
 * the API's no-op one: no network, no error, nothing written anywhere.
 *
 * A short-lived command calls `flushCommandTracer()` before it exits, or the
 * batch processor holds its spans.
 */

const TRACER_NAME = "@infinitedusky/indusk-mcp/commands";
const SERVICE_NAME = "indusk";

let provider: NodeTracerProvider | null = null;

export function commandTracer(deps: ResolveDeps = {}): Tracer {
	if (provider === null) {
		const endpoint = liveOtlpEndpointSync(deps);
		if (endpoint === null) return trace.getTracer(TRACER_NAME);
		provider = new NodeTracerProvider({
			resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: SERVICE_NAME }),
			spanProcessors: [
				new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })),
			],
		});
	}
	return provider.getTracer(TRACER_NAME);
}

/** Send what the command has emitted; a no-op when no provider was made, and never throws. */
export async function flushCommandTracer(): Promise<void> {
	try {
		await provider?.forceFlush();
	} catch {
		// Telemetry is best-effort: a flush that fails must not fail the command.
	}
}
