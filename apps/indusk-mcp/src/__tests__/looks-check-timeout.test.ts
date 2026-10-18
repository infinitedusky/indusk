/**
 * promise: a-look-check-runs-what-changed — looks-check-speed A15: a slow look
 * never ends the run (the clause shipped in storybook-components), held while
 * the opening of looks is rewritten.
 */
import { describe, expect, it } from "vitest";
import { LookNotHere, LooksCheckError, openWithinTime } from "../lib/looks/check.js";

const timeout = () =>
	Object.assign(new Error("page.goto: Timeout 30000ms exceeded.\nCall log: …"), {
		name: "TimeoutError",
	});

describe("a look that runs out of time is unchecked, not the end of the run", () => {
	it("answers the look when it opens", async () => {
		expect(await openWithinTime(async () => "seen")).toBe("seen");
	});

	it("tries a slow look again once before giving up on it", async () => {
		let calls = 0;
		const seen = await openWithinTime(async () => {
			calls++;
			if (calls === 1) throw timeout();
			return "seen";
		});
		expect(seen).toBe("seen");
		expect(calls).toBe(2);
	});

	it("names a look that timed out twice instead of throwing", async () => {
		let calls = 0;
		const seen = await openWithinTime(async () => {
			calls++;
			throw timeout();
		});
		expect(calls).toBe(2);
		expect(seen).toEqual({ timedOut: "timed out 2 times: page.goto: Timeout 30000ms exceeded." });
	});

	it("still ends the run on a failure that is neither time nor a 404", async () => {
		await expect(
			openWithinTime(async () => {
				throw new LooksCheckError("http://localhost/p/x answered 500");
			}),
		).rejects.toThrow("answered 500");
		await expect(
			openWithinTime(async () => {
				throw new Error("page.goto: net::ERR_CONNECTION_REFUSED");
			}),
		).rejects.toThrow("ERR_CONNECTION_REFUSED");
	});

	// regression: the audit's finding that `indusk looks check admin` against the person's own project stops at the first `looks-fixture-*` path
	it("names a look whose page answers 404 as unchecked, on the first try, instead of ending the run", async () => {
		let calls = 0;
		const seen = await openWithinTime(async () => {
			calls++;
			throw new LookNotHere("http://localhost:3939/p/dusk/plan/looks-fixture-a answered 404");
		});
		expect(calls).toBe(1);
		expect(seen).toEqual({
			unchecked:
				"http://localhost:3939/p/dusk/plan/looks-fixture-a answered 404 — not in this project",
		});
	});
});
