import { describe, expect, it } from "vitest";
import { openWithinTime } from "../lib/looks/check.js";

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

	it("still ends the run on a failure that is not time", async () => {
		await expect(
			openWithinTime(async () => {
				throw new Error("http://localhost/p/x answered 404");
			}),
		).rejects.toThrow("answered 404");
	});
});
