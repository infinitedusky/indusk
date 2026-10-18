// clause: a-look-check-runs-what-changed/the-changed-looks
// promise: a-look-check-runs-what-changed
import { describe, expect, it } from "vitest";
import { touchedLooks } from "./touched.js";

/** Looks are named as the held record names them: `screen:<name>.<state>`, `story:<component>.<state>`. */
const closures = {
	"screen:home.full": ["app/page.tsx", "app/layout.tsx", "components/chip.tsx"],
	"screen:plan.parts": ["app/plan/[name]/page.tsx", "app/layout.tsx"],
	"story:chip.waiting": ["components/chip.tsx"],
};

describe("which looks a change touches", () => {
	it("T8 a page edit touches its screens only", () => {
		expect(
			touchedLooks({ closures, foundation: [], changed: ["app/plan/[name]/page.tsx"] }),
		).toEqual(["screen:plan.parts"]);
	});

	it("T9 a component edit touches its stories and the screens importing it", () => {
		expect(
			touchedLooks({ closures, foundation: [], changed: ["components/chip.tsx"] }).sort(),
		).toEqual(["screen:home.full", "story:chip.waiting"]);
	});

	it("T10 a foundation edit, or an unreadable closure, touches every look", () => {
		expect(
			touchedLooks({ closures, foundation: ["tokens.json"], changed: ["tokens.json"] }),
		).toHaveLength(3);
		const unreadable = { ...closures, "screen:plan.parts": null };
		expect(touchedLooks({ closures: unreadable, foundation: [], changed: ["x.ts"] })).toHaveLength(
			3,
		);
	});

	it("a change that no look is drawn from touches none", () => {
		expect(touchedLooks({ closures, foundation: ["tokens.json"], changed: ["README.md"] })).toEqual(
			[],
		);
	});
});
