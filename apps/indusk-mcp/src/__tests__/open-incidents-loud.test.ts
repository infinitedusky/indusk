import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPromiseTools } from "../tools/promise-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	behaviourPromise,
	codeFilesFor,
	openIncidentSpec,
	type PromiseProject,
	promiseProject,
} from "./helpers/promises-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * incident-recording A10, A11 — promise: an-open-incident-stays-loud.
 *
 * An open incident is work someone saw and nobody finished. Every reader
 * shows it with how long it has been open and whether its owner carries the
 * Maintenance phase: `promise_health` (A10), and `promises status` before any
 * source's counts (A11). Both hold when no Jaeger can be read — the incidents
 * are files, and "nobody could look" must not hide them.
 *
 * Red today: `promise_health` reports a count of open incidents per promise
 * and no ages; `promises status` prints no incidents.
 */

const PROMISE = "seat-released";
const OWNER = "seat-holds";
const OPEN = "i-2026-10-06-seat-released";
const FIXED = "i-2026-10-01-seat-released";
const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000 - 3_600_000).toISOString();

const MAINTENANCE = `---
title: "${OWNER}"
status: completed
---

# ${OWNER}

## Checklist

### Build Phase 2: Maintenance — ${OPEN}

- [ ] Find why the seat stayed held
`;

let fixture: PromiseProject;
let home: string;
const previousHome = process.env.INDUSK_HOME;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "open-incidents-home-"));
	process.env.INDUSK_HOME = home;
	fixture = promiseProject({
		domains: ["seating"],
		archivedPlans: [OWNER],
		planFiles: { [`archive/${OWNER}/impl.md`]: MAINTENANCE },
		promises: [
			behaviourPromise(PROMISE, {
				owner: OWNER,
				domain: "seating",
				state: "known-violated",
				incidents: [OPEN, FIXED],
			}),
		],
		incidents: [
			openIncidentSpec(OPEN, PROMISE, { opened: twoDaysAgo, date: twoDaysAgo.slice(0, 10) }),
			openIncidentSpec(FIXED, PROMISE, {
				status: "fixed",
				fixed: "2026-10-02T09:00:00Z",
				rootCause: "The release timer was never armed.",
				fix: "Armed it.",
			}),
		],
		files: codeFilesFor(PROMISE),
	});
});
afterEach(() => {
	if (previousHome === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = previousHome;
	rmSync(fixture.root, { recursive: true, force: true });
	rmSync(home, { recursive: true, force: true });
});

describe("A10 — promise_health lists each open incident with its age and owner", () => {
	it("names the open incident, how long it has been open, its owner and its phase, with no source readable", async () => {
		const tools = toolCaller((s) => registerPromiseTools(s, fixture.root));
		const { json } = await tools.call("promise_health");
		const open = (json as { openIncidents?: Record<string, unknown>[] }).openIncidents;
		expect(open, JSON.stringify(json)).toEqual([
			expect.objectContaining({
				id: OPEN,
				promise: PROMISE,
				owner: OWNER,
				ownerHasPhase: true,
			}),
		]);
		const ageMs = (open?.[0]?.ageMs as number) ?? 0;
		expect(ageMs).toBeGreaterThanOrEqual(2 * 86_400_000);
	});
});

describe.skipIf(SHOULD_SKIP)("A11 — promises status prints open incidents first", () => {
	it("prints the open incident with its age and owner before anything about a source", () => {
		const r = runCli(fixture.root, ["promises", "status"]);
		const first = r.stdout.split("\n").find((l) => l.trim() !== "") ?? "";
		expect(first, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toContain(OPEN);
		expect(first).toMatch(/\b2 ?d(ays?)?\b/);
		expect(first).toContain(OWNER);
		expect(r.stdout).not.toContain(FIXED);
	});
});
