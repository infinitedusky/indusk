import { describe, expect, it } from "vitest";
import { type AskAdminDeps, askAdminToPlan } from "./ask-admin.js";

/**
 * promise: an-accepted-brief-is-planned-unasked — accepting a brief asks the
 * running admin to plan it, and says plainly when it cannot. The daemon, the
 * registry and the network are fakes; what is pinned is the address the post
 * goes to, what it carries, and that no failure reads as success.
 */

function deps(
	over: Partial<AskAdminDeps> = {},
): AskAdminDeps & { posted: Array<[string, unknown]> } {
	const posted: Array<[string, unknown]> = [];
	return {
		posted,
		status: async () => ({ running: true, port: 4321 }),
		projectName: async () => "seats",
		post: async (url, body) => {
			posted.push([url, body]);
			return { status: 202, json: async () => ({ started: true }) };
		},
		...over,
	};
}

describe("askAdminToPlan", () => {
	it("posts the project and plan to the address the admin recorded", async () => {
		const d = deps();
		const said = await askAdminToPlan("/p", "a-plan", d);
		expect(d.posted).toEqual([
			["http://127.0.0.1:4321/api/plans/plan", { project: "seats", plan: "a-plan" }],
		]);
		expect(said).toMatch(/writing a-plan's plan/);
	});

	it("says plainly when no admin is running, and posts nothing", async () => {
		const d = deps({ status: async () => ({ running: false }) });
		const said = await askAdminToPlan("/p", "a-plan", d);
		expect(said).toMatch(/admin is not running/);
		expect(d.posted).toEqual([]);
	});

	it("says so when the project is not registered", async () => {
		const said = await askAdminToPlan("/p", "a-plan", deps({ projectName: async () => null }));
		expect(said).toMatch(/not registered/);
	});

	it("names the looks it waits on", async () => {
		const said = await askAdminToPlan(
			"/p",
			"a-plan",
			deps({
				post: async () => ({
					status: 200,
					json: async () => ({
						started: false,
						stop: { step: "wait-for-looks", looks: ["seat-picker is still proposed"] },
					}),
				}),
			}),
		);
		expect(said).toMatch(/seat-picker is still proposed/);
	});

	it("reports a refusal and an unreachable admin, never success", async () => {
		const refused = await askAdminToPlan(
			"/p",
			"a-plan",
			deps({ post: async () => ({ status: 409, json: async () => ({ error: "is building" }) }) }),
		);
		expect(refused).toMatch(/refused.*is building/);
		const down = await askAdminToPlan(
			"/p",
			"a-plan",
			deps({
				post: async () => {
					throw new Error("ECONNREFUSED");
				},
			}),
		);
		expect(down).toMatch(/did not answer.*ECONNREFUSED/);
	});
});
