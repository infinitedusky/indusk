import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

/**
 * promise-timeline A5 — an incident records when it was fixed (ADR D1).
 *
 * Over the CLI, in a temp project. `indusk promises fix <id>` marks the
 * incident fixed, stamps the time, and returns the promise to `enforced`;
 * `promises check` refuses an incident marked fixed by hand with no time,
 * because a timeline band from "opened" to "fixed" has no end without it.
 *
 * Red today: there is no `fix` command, and `check` accepts a bare
 * `status: fixed`.
 */

const PROMISE = "seat-held";
const OWNER = "seats-v2";
const INCIDENT = "i-2026-10-01-seat-held";

function project(incident: { status: "open" | "fixed"; fixed?: string }): PromiseProject {
	return promiseProject({
		domains: ["seating"],
		landed: { [OWNER]: daysAgo(30) },
		promises: [
			{
				name: PROMISE,
				kind: "behaviour",
				state: incident.status === "open" ? "known-violated" : "enforced",
				domain: "seating",
				owner: OWNER,
				sites: [`src/${PROMISE}.ts`],
				tests: [`src/${PROMISE}.test.ts`],
				incidents: [INCIDENT],
			},
		],
		incidents: [
			{
				id: INCIDENT,
				promise: PROMISE,
				source: "local",
				status: incident.status,
				opened: "2026-10-01T10:00:00Z",
				lastSeen: "2026-10-01T11:00:00Z",
				traces: ["0123456789abcdef0123456789abcdef"],
				...(incident.fixed ? { fixed: incident.fixed } : {}),
			},
		],
		files: {
			[`src/${PROMISE}.ts`]: siteFile(PROMISE),
			[`src/${PROMISE}.test.ts`]: testFile(PROMISE),
		},
	});
}

function frontmatterOf(path: string): Record<string, unknown> {
	return matter(readFileSync(path, "utf-8")).data as Record<string, unknown>;
}

describe("A5 — an incident records when it was fixed", () => {
	let fixture: PromiseProject | undefined;

	afterEach(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
		fixture = undefined;
	});

	it("`promises fix <id>` marks it fixed now, and the promise is enforced again", () => {
		fixture = project({ status: "open" });
		const before = runCli(fixture.root, ["promises", "check"]);
		expect(before.code, `the fixture is valid: ${before.stderr}`).toBe(0);

		const started = Date.now();
		const r = runCli(fixture.root, ["promises", "fix", INCIDENT]);
		expect(r.code, r.stdout + r.stderr).toBe(0);

		const incident = frontmatterOf(
			join(fixture.planRoot, ".indusk", "promises", "incidents", `${INCIDENT}.md`),
		);
		expect(incident.status).toBe("fixed");
		const fixedAt = new Date(
			String(incident.fixed instanceof Date ? incident.fixed.toISOString() : incident.fixed),
		).getTime();
		expect(fixedAt, `fixed: ${String(incident.fixed)}`).toBeGreaterThanOrEqual(started - 1_000);
		expect(fixedAt).toBeLessThanOrEqual(Date.now() + 1_000);

		const promise = frontmatterOf(join(fixture.planRoot, ".indusk", "promises", `${PROMISE}.md`));
		expect(promise.state).toBe("enforced");
		expect(promise.incidents, "the history is kept").toEqual([INCIDENT]);

		const after = runCli(fixture.root, ["promises", "check"]);
		expect(after.code, after.stderr).toBe(0);
	});

	it("`promises check` refuses an incident marked fixed with no time, naming the file", () => {
		fixture = project({ status: "fixed" });
		const r = runCli(fixture.root, ["promises", "check"]);
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain(`${INCIDENT}.md`);
		expect(r.stderr).toMatch(/fixed/);
	});

	it("an incident fixed with its time passes the check", () => {
		fixture = project({ status: "fixed", fixed: "2026-10-01T12:00:00Z" });
		const r = runCli(fixture.root, ["promises", "check"]);
		expect(r.code, r.stderr).toBe(0);
	});
});
