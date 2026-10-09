import { describe, expect, it } from "vitest";
import { fixFor } from "./fix.js";
import { line } from "./fixture.js";
import { panelModel } from "./panel.js";
import { whereBroken } from "./view.js";

/**
 * vscode-extension A31: where a broken promise broke is decided in one place;
 * the fix action and the panel's card name the same source.
 */

const view = (o: Parameters<typeof line>[0]) => ({ line: line(o), notReading: false });

describe("where a promise broke", () => {
	it("A31 — production first, else the first source that reads broken; nothing when it holds", () => {
		expect(
			whereBroken(view({ productionState: "red", localState: "red" }), "seats-held")?.source.name,
		).toBe("production");
		expect(whereBroken(view({ localState: "red" }), "seats-held")?.source.name).toBe("local");
		expect(whereBroken(view({}), "seats-held")).toBeNull();
		expect(whereBroken(null, "seats-held")).toBeNull();
	});

	it("A31 — the fix and the card name the source the rule names", () => {
		const v = view({ localState: "red", traceId: "loc-1" });
		const card = panelModel(v, new Map()).broken[0];
		const fix = fixFor(v, "seats-held", { projectRoot: "/p", claudeOnPath: true });
		const where = whereBroken(v, "seats-held")?.source.name;
		expect(card?.source).toBe(where);
		expect(fix && "terminal" in fix ? fix.terminal.command : "").toContain(`broken in ${where}`);
	});
});
