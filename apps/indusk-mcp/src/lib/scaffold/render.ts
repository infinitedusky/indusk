import { PORT_BLOCK } from "../telemetry/daemon-address.js";

/**
 * Filling a template for one project. Only the settings carry values — the line marked
 * RENDERED in `telemetry-settings.ts` and in `instrumentation.py` — and a render replaces
 * that one line whole; every other template is copied as it is.
 */

export interface Rendered {
	service: string;
	project: string;
	traces: string;
	logs: string;
}

/** The rendered values: the service, the InDusk project id, and the daemon's stored address, else InDusk's block. */
export function settingsValues(v: {
	service: string;
	project: string;
	address: { traces: string; logs: string } | null;
}): Rendered {
	return {
		service: v.service,
		project: v.project,
		traces: v.address?.traces ?? `http://localhost:${PORT_BLOCK.traces}`,
		logs: v.address?.logs ?? `http://localhost:${PORT_BLOCK.logs}`,
	};
}

const KEYS = ["service", "project", "traces", "logs"] as const;

/** The RENDERED line per template that has one: what finds it, and what replaces it. */
const RENDERED_LINES: Record<string, { find: RegExp; line: (v: Rendered) => string }> = {
	"telemetry-settings.ts": {
		find: /^export const RENDERED: Rendered = \{[^}]*\};$/m,
		line: (v) =>
			`export const RENDERED: Rendered = { ${KEYS.map((k) => `${k}: ${JSON.stringify(v[k])}`).join(", ")} };`,
	},
	"instrumentation.py": {
		find: /^RENDERED = \{[^}]*\}$/m,
		line: (v) =>
			`RENDERED = {${KEYS.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(v[k])}`).join(", ")}}`,
	},
};

/** A template's text rendered with the values; a template without a RENDERED line is returned as it is. */
export function renderTemplate(template: string, text: string, values: Rendered): string {
	const spec = RENDERED_LINES[template];
	if (!spec) return text;
	if (!spec.find.test(text)) {
		throw new Error(`templates/${template} has no RENDERED line for the scaffold to fill`);
	}
	return text.replace(spec.find, () => spec.line(values));
}
