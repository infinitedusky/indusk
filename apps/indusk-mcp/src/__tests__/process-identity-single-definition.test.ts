import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * small-fixes — A14: "is this process mine" is defined once.
 *
 * `telemetry stop` learned to judge a process by its command line
 * (telemetry-stop-stops-what-it-started); `ui stop` kept its own copy of the
 * older rule, by port, with the same bug (known-issues, "The admin daemon's
 * stop has the same port-based identity check"). One definition,
 * `lib/process-identity.ts`, used by both.
 *
 * promise: one-definition-per-shared-rule
 */

const LIB = new URL("../lib/", import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(LIB, rel), "utf-8");
const LESSON = "lesson: structural-single-definition-test-for-must-agree-invariants";

describe("A14 — one definition of process identity, used by both stops", () => {
	it("`lib/process-identity.ts` defines `isOwnProcess`, and nothing else does", () => {
		expect(
			existsSync(join(LIB, "process-identity.ts")),
			`lib/process-identity.ts — ${LESSON}`,
		).toBe(true);
		expect(read("process-identity.ts"), LESSON).toMatch(/export function isOwnProcess\(/);
		expect(read("telemetry/stop.ts"), `a second copy — ${LESSON}`).not.toMatch(
			/export function isOwnProcess\(/,
		);
		expect(read("admin/daemon.ts"), `a second copy — ${LESSON}`).not.toMatch(
			/function isOwnProcess\(/,
		);
	});

	it("both stops import it, and the admin's identity check no longer asks the port", () => {
		expect(read("telemetry/stop.ts"), LESSON).toMatch(/from "\.\.\/process-identity\.js"/);
		const daemon = read("admin/daemon.ts");
		expect(daemon, LESSON).toMatch(/from "\.\.\/process-identity\.js"/);
		const identity = daemon.slice(daemon.indexOf("function verifyIdentity"));
		expect(identity.slice(0, identity.indexOf("\n}")), LESSON).not.toContain("isPortListening");
	});
});
