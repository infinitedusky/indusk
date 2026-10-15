import { resolve } from "node:path";
import { healthLine } from "@infinitedusky/indusk-mcp/promises/health";
import type { Registry } from "@infinitedusky/indusk-mcp/promises/registry";
import { type LookRun, readLookStanding } from "@infinitedusky/indusk-mcp/promises/standing";
import { describe, expect, it } from "vitest";
import { lookStates } from "./looks-health.js";

/**
 * ui-promises A24: the editor shows a look's state as the admin does. The
 * admin reads each look's standing from the package (`readLookStanding`); the
 * editor reads the health line, which carries the same rows. Over the
 * package's looks fixture with three recorded runs, the editor's state and
 * word for every look are the package's.
 *
 * promise: a-look-reports-like-any-promise
 * promise: the-editor-shows-the-same-health-as-the-admin
 */

const FIXTURE = resolve(__dirname, "../../../indusk-mcp/src/__tests__/fixtures/looks-app");

const run = (
	device: string,
	outcome: LookRun["outcome"],
	at: string,
	symptom: string | null = null,
): LookRun => ({ app: "demo", screen: "home", state: "empty", device, outcome, at, symptom });

const RUNS: LookRun[] = [
	run("phone", "violated", "2026-10-11T10:00:00.000Z", "home.empty @ phone: token --color-paper"),
	run("desktop", "upheld", "2026-10-11T10:00:00.000Z"),
];

const registry = { dir: "/r", promises: [], incidents: [] } as unknown as Registry;

describe("A24 — the editor's state for a look is the admin's", () => {
	it("A24 every look on the line reads in the editor as readLookStanding has it", async () => {
		const read = await readLookStanding(FIXTURE, { runs: RUNS });
		expect(read.rows.length).toBeGreaterThan(0);
		const line = healthLine(registry, [], new Date("2026-10-11T10:05:00.000Z"), undefined, read);
		const shown = lookStates({ line, notReading: false });

		expect(shown.map((s) => [s.app, s.look, s.device, s.state, s.word])).toEqual(
			read.rows.map((r) => [r.app, r.look, r.device, r.standing, r.word]),
		);
		const phone = shown.find((s) => s.look === "home.empty" && s.device === "phone");
		expect(phone).toMatchObject({ state: "broken", tone: "broken" });
		expect(shown.find((s) => s.look === "home.empty" && s.device === "desktop")?.state).toBe(
			"held",
		);
		expect(shown.find((s) => s.look === "badge")?.state).toBe("uncovered");
	});

	it("A24 a line with no looks shows none, and a missing line shows nothing rather than a guess", () => {
		const line = healthLine(registry, [], new Date("2026-10-11T10:05:00.000Z"));
		expect(lookStates({ line, notReading: false })).toEqual([]);
		expect(lookStates(null)).toEqual([]);
	});
});
