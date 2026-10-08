import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/**
 * small-fixes A23 (cleanup): the reads behind identity are defined once too.
 * Three copies each of "is it alive" and "what does `ps` say it is" sat in
 * the admin daemon, the telemetry daemon and the session manager — and had
 * already drifted: only the admin's read `ps` in the C locale, which
 * `lstart` needs to parse.
 */
describe("A23 — one place reads whether a process is alive and what `ps` says it is", () => {
	const sources = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
			const p = join(dir, e.name);
			if (e.isDirectory()) return e.name === "__tests__" ? [] : sources(p);
			return /\.ts$/.test(e.name) && !/\.test(-support)?\.ts$/.test(e.name) ? [p] : [];
		});
	const definers = (pattern: RegExp) =>
		sources(LIB)
			.filter((f) => pattern.test(readFileSync(f, "utf-8")))
			.map((f) => f.slice(LIB.length))
			.sort();

	it("only `process-identity.ts` signals 0 to ask whether a pid is alive", () => {
		expect(definers(/process\.kill\(\s*[\w.]+\s*,\s*0\s*\)/), LESSON).toEqual([
			"process-identity.ts",
		]);
	});

	it("only `process-identity.ts` asks `ps` about one pid", () => {
		expect(definers(/["']ps["'],\s*\[[^\]]*["']-p["']/), LESSON).toEqual(["process-identity.ts"]);
	});
});
