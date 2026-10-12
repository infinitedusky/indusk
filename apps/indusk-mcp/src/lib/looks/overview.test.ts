import { describe, expect, it } from "vitest";
import { type AppLooksRead, proposedCount } from "./overview";

const look = (approval: "approved" | "proposed") => ({ approval });
const app = (mockups: string[], stories: string[]) =>
	({
		app: "demo",
		mockups: mockups.map((a) => look(a as "approved")),
		stories: stories.map((a) => look(a as "approved")),
	}) as unknown as AppLooksRead;

describe("the count of looks waiting for a person", () => {
	it("counts every proposed mockup and story across apps, and no approved one", () => {
		const apps = [
			app(["approved", "proposed"], ["proposed", "proposed"]),
			app(["proposed"], ["approved"]),
		];
		expect(proposedCount(apps)).toBe(4);
	});

	it("skips an app that could not be read", () => {
		expect(proposedCount([{ app: "x", problem: "no foundation" }])).toBe(0);
	});
});
