import { describe, expect, it } from "vitest";
import { line } from "./fixture.js";
import { hover } from "./hover.js";
import { panelModel } from "./panel.js";
import { panelBody } from "./panel-html.js";
import type { HealthLine, View } from "./view.js";

/**
 * A1, A2 of panel-last-broke-time: the panel and the hover say a promise last
 * broke at its newest violation's time, in the person's time zone, never the
 * time it was last seen.
 *
 * promise: a-broken-promise-says-when-it-last-broke
 */

const NEW_YORK = "America/New_York";

/** Production broke on Oct 9, 17:46 UTC; a run on Oct 10, 21:20 UTC held. */
function brokeThenHeld(): View {
	const l = line({ productionState: "red" }) as HealthLine;
	const prod = l.sources[0] as unknown as { rows: Record<string, unknown>[] };
	prod.rows[0] = {
		...prod.rows[0],
		lastSeen: "2026-10-10T21:20:00.000Z",
		lastBroke: "2026-10-09T17:46:00.000Z",
	};
	return { line: l, notReading: false };
}

type Hover = (promise: string, view: View, timeZone?: string) => string;
type Body = (m: unknown, a: string[], project: string, timeZone?: string) => string;

describe("last broke", () => {
	it("A1 — the panel and the hover say last broke at the violation's time, not the held run's", () => {
		const view = brokeThenHeld();
		const model = panelModel(view, new Map());
		expect(model.broken[0]?.brokeAt).toBe("2026-10-09T17:46:00.000Z");

		const html = (panelBody as unknown as Body)(model, [], "", NEW_YORK);
		expect(html).toContain("last broke 2026-10-09");
		expect(html).not.toContain("2026-10-10");

		const text = (hover as unknown as Hover)("seats-held", view, NEW_YORK);
		expect(text).toContain("production: broken, last broke 2026-10-09");
		expect(text).not.toMatch(/last broke 2026-10-10/);
	});

	it("A2 — the time reads in the person's time zone with no UTC suffix: 17:46 UTC is 1:46 pm in New York", () => {
		const view = brokeThenHeld();
		const html = (panelBody as unknown as Body)(panelModel(view, new Map()), [], "", NEW_YORK);
		expect(html).toContain("last broke 2026-10-09 13:46");
		expect(html).not.toContain("UTC");

		const text = (hover as unknown as Hover)("seats-held", view, NEW_YORK);
		expect(text).toContain("last broke 2026-10-09 13:46");
		expect(text).not.toContain("UTC");
	});
});
