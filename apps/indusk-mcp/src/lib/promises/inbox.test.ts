import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	answering,
	jsonLines,
	OWNER,
	PROMISE,
	recordingProject,
	TRACE,
} from "../../__tests__/helpers/record-fixture.js";
import { recordBreaks } from "./record.js";

/**
 * incident-recording A17 — promise: a-break-reaches-the-working-agent.
 *
 * When a pass opens or extends an incident, the project's inbox — a JSON-lines
 * file in its home, which the prompt hook delivers — gains an entry naming
 * the promise, the incident and the reopened plan's phase. A pass that
 * changes nothing adds nothing.
 */

const SECOND = "5cf92f3577b34da6a3ce929d0e0e4737";

let home: string;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "inbox-home-"));
	cleanups.push(() => rmSync(home, { recursive: true, force: true }));
});
afterEach(() => {
	for (const c of cleanups.splice(0).reverse()) c();
});

const deps = (traces: string[]) => ({ reads: answering(traces), mark: () => {}, home });

describe("A17 — a recorded break lands in the project's inbox", () => {
	it("an opened incident adds one entry naming the promise, the incident, the owner and its phase", async () => {
		const fx = recordingProject();
		cleanups.push(fx.cleanup);
		const r = await recordBreaks(fx.root, { by: "admin", source: "deployed" }, deps([TRACE]));
		const id = r.opened[0]?.id;
		expect(jsonLines(home, "inbox.jsonl")).toEqual([
			expect.objectContaining({
				kind: "break",
				promise: PROMISE,
				incident: id,
				owner: OWNER,
				phase: `Maintenance — ${id}`,
				id: expect.any(String),
				at: expect.any(String),
			}),
		]);
	});

	it("an extended incident adds another; a pass that changes nothing adds none", async () => {
		const fx = recordingProject();
		cleanups.push(fx.cleanup);
		await recordBreaks(fx.root, { by: "admin", source: "deployed" }, deps([TRACE]));
		await recordBreaks(fx.root, { by: "admin", source: "deployed" }, deps([TRACE, SECOND]));
		await recordBreaks(fx.root, { by: "admin", source: "deployed" }, deps([TRACE, SECOND]));
		const entries = jsonLines<{ id: string; incident: string }>(home, "inbox.jsonl");
		expect(entries).toHaveLength(2);
		expect(entries[0].incident).toBe(entries[1].incident);
		expect(new Set(entries.map((e) => e.id)).size).toBe(2);
	});
});
