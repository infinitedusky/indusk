import { describe, expect, it } from "vitest";
import { line } from "./fixture.js";
import { stateOf } from "./markers.js";
import { stateIn } from "./view.js";

// promise: a-promise-is-upheld-or-broken

/**
 * A7 (the editor's half) and A9 of one-promise-language: the words the editor
 * shows for a promise's state. A promise declared known broken reads `known
 * broken`; one nothing has reported on reads `no signal`, never `not seen`
 * and never `holding`. The activity section's half is in `activity.test.ts`.
 */

const shown = (state: string) => {
	const source = line({ localState: state }).sources.find((s) => s.name === "local");
	if (!source) throw new Error("the fixture line has no local source");
	return stateIn(source, "seats-held").shown;
};

describe("the editor's labels for a promise's state", () => {
	it("A9 — an amber row reads known broken", () => {
		expect(shown("amber")).toBe("known broken");
	});

	it("A7, A9 — an unverified row reads no signal, not not seen", () => {
		expect(shown("unverified")).toBe("no signal");
	});

	it("A7 — a promise the source has no row for reads no signal", () => {
		const source = line({ localState: "green" }).sources.find((s) => s.name === "local");
		if (!source) throw new Error("the fixture line has no local source");
		expect(stateIn(source, "no-such-promise").shown).toBe("no signal");
	});

	it("A7 — a row nothing has reported on is never holding", () => {
		expect(shown("unverified")).not.toBe("holding");
	});
});

describe("A15 — the editor's words for retired and fixed", () => {
	it("a retired promise reads retired, never holding", () => {
		expect(shown("grey")).toBe("retired");
		expect(shown("grey")).not.toBe("holding");
	});

	it("a promise that broke and was fixed reads broke — fixed", () => {
		expect(shown("fixed")).toBe("broke — fixed");
	});
});

describe("A15 — the tone follows the word", () => {
	const both = (state: string) =>
		stateOf("seats-held", {
			line: line({ productionState: state, localState: state }),
			notReading: false,
		});

	it("a retired promise is not drawn in the healthy tone", () => {
		expect(both("grey")).toEqual({ text: "retired", tone: "unknown" });
	});

	it("a promise that broke and was fixed reads broke — fixed, in the healthy tone", () => {
		expect(both("fixed")).toEqual({ text: "broke — fixed", tone: "ok" });
	});
});
