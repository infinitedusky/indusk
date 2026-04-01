/**
 * FilteringExporter — Category-based span filtering for OpenTelemetry.
 *
 * Wraps a real SpanExporter and drops spans from disabled categories
 * before they reach the backend. This lets you instrument aggressively
 * and control export volume at runtime.
 *
 * Categories are set via the `otel.category` span attribute.
 * Spans without a category are always exported.
 *
 * Control which categories are active via OTEL_ENABLED_CATEGORIES env var:
 *   OTEL_ENABLED_CATEGORIES=http,business,inference
 *
 * If OTEL_ENABLED_CATEGORIES is not set, all categories are exported.
 */

import type {
	ExportResult,
	ExportResultCode,
} from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

export const ALL_CATEGORIES = [
	"http",
	"db",
	"business",
	"inference",
	"state",
	"system",
] as const;

export type OtelCategory = (typeof ALL_CATEGORIES)[number];

function getEnabledCategories(): Set<string> {
	const env = process.env.OTEL_ENABLED_CATEGORIES;
	if (!env) return new Set(ALL_CATEGORIES);
	return new Set(
		env
			.split(",")
			.map((c) => c.trim())
			.filter(Boolean),
	);
}

export class FilteringExporter implements SpanExporter {
	private enabledCategories: Set<string>;

	constructor(private inner: SpanExporter) {
		this.enabledCategories = getEnabledCategories();
	}

	export(
		spans: ReadableSpan[],
		resultCallback: (result: ExportResult) => void,
	): void {
		const filtered = spans.filter((span) => {
			const category = span.attributes["otel.category"] as string | undefined;
			// Spans without a category are always exported
			if (!category) return true;
			return this.enabledCategories.has(category);
		});

		if (filtered.length > 0) {
			this.inner.export(filtered, resultCallback);
		} else {
			resultCallback({ code: 0 as ExportResultCode });
		}
	}

	async shutdown(): Promise<void> {
		return this.inner.shutdown();
	}

	async forceFlush(): Promise<void> {
		return this.inner.forceFlush?.() ?? Promise.resolve();
	}

	/** Re-read OTEL_ENABLED_CATEGORIES from env. Call after changing the env var at runtime. */
	refreshCategories(): void {
		this.enabledCategories = getEnabledCategories();
	}
}
