import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPromiseTools } from "../tools/promise-tools.js";
import { git, SHOULD_SKIP } from "./helpers/cli.js";
import {
	CLAIMED_FILE,
	incidentId,
	junitReport,
	OWNER,
	PROMISE,
	REPORT_PATH,
	type ReleaseProject,
	routingProject,
} from "./helpers/release-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * release-records-its-failures, Test Phase 1 — A11–A14: a test still failing
 * after its rerun, named by a row whose `For` names a promise, becomes an
 * incident on that promise.
 *
 * promise: a-failing-slow-test-breaks-its-promise
 * promise: an-incident-names-its-tests
 * promise: an-open-incident-stays-loud
 *
 * The fixture: an archived owner plan whose row R1 names the promise and the
 * file the slow run fails, and R2 names another file and no promise. A green
 * slow run was recorded first, then two commits: one touching code the slow
 * tests cover (the suspect), one touching only a README (not one). The
 * incident reads as ADR D7 says: `source: release`, `tests:` and `release:`
 * evidence in place of `traces:`, and the suspects in its body.
 *
 * The line `indusk release` prints for an incident it opened or extended:
 *
 *   recorded: incident <id>
 */

const SUSPECT = "rewrite the seat release timer";
const NOT_SUSPECT = "docs: reword the readme";

let project: ReleaseProject;
let previousHome: string | undefined;
let home: string;
beforeEach(() => {
	previousHome = process.env.INDUSK_HOME;
	home = mkdtempSync(join(tmpdir(), "release-incident-home-"));
	process.env.INDUSK_HOME = home;
});
afterEach(() => {
	if (previousHome === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = previousHome;
	project?.cleanup();
	rmSync(home, { recursive: true, force: true });
});

/** A project with a green slow run recorded, two commits since, and a slow run that fails the claimed file. */
function failingSince() {
	project = routingProject({
		slow: {
			exit: 1,
			reports: { [REPORT_PATH]: junitReport({ [CLAIMED_FILE]: ["holds a seat"] }) },
		},
	});
	project.recordGreenRun();
	project.commit("src/seat-released.ts", `// promise: ${PROMISE}\nexport const x = 2;\n`, SUSPECT);
	project.commit("README.md", "words\n", NOT_SUSPECT);
	return project;
}

const onlyIncident = (p: ReleaseProject): string => {
	const files = p.incidentFiles();
	expect(files, "the number of incident files").toHaveLength(1);
	return files[0] as string;
};

describe.skipIf(SHOULD_SKIP)("indusk release — a failing slow test breaks its promise", () => {
	it("A11: opens an incident on the promise, naming the test, the release version and the commits since the last green run", () => {
		const p = failingSince();
		const r = p.release();
		const file = onlyIncident(p);
		const text = p.incident(file);
		const data = matter(text).data as Record<string, unknown>;
		expect(data.promise).toBe(PROMISE);
		expect(data.source).toBe("release");
		expect(data.status).toBe("open");
		expect(data, "evidence is tests and release, not traces").toEqual(
			expect.objectContaining({ tests: expect.anything(), release: expect.anything() }),
		);
		expect(data.traces).toBeUndefined();
		expect(JSON.stringify(data.tests)).toContain(CLAIMED_FILE);
		expect(text).toContain("holds a seat");
		expect(JSON.stringify(data.release)).toContain("1.4.0");
		expect(text, "the suspect commit").toContain(SUSPECT);
		expect(text, "a commit outside the covered code").not.toContain(NOT_SUSPECT);
		expect(r.stdout).toMatch(new RegExp(`^recorded: incident ${incidentId(file)}$`, "m"));
		expect(p.records().at(-1)?.failed).toEqual([
			{ file: CLAIMED_FILE, routed: `incident ${incidentId(file)}` },
		]);
	});

	it("A12: the same file failing in a later release adds to the open incident rather than opening a second", () => {
		const p = failingSince();
		p.release();
		const first = onlyIncident(p);
		p.bump("1.4.1");
		const r = p.release();
		const file = onlyIncident(p);
		expect(file).toBe(first);
		const text = p.incident(file);
		expect(text).toContain("1.4.0");
		expect(text).toContain("1.4.1");
		expect(r.stdout).toMatch(new RegExp(`^recorded: incident ${incidentId(file)}$`, "m"));
	});

	it("A13: reopens the owning plan with its Maintenance phase and names the rows that were proving the promise", () => {
		const p = failingSince();
		p.release();
		const id = incidentId(onlyIncident(p));
		const impl = readFileSync(
			join(p.planRoot, ".indusk", "planning", "archive", OWNER, "impl.md"),
			"utf-8",
		);
		expect(impl).toMatch(new RegExp(`^### Build Phase 2: Maintenance — ${id}$`, "m"));
		const provenBy = /## Proven by\n([\s\S]*?)(?=\n## |$)/.exec(p.incident(`${id}.md`))?.[1] ?? "";
		expect(provenBy).toMatch(new RegExp(`${OWNER}.*\\bR1\\b`));
		expect(provenBy, "a row that names no promise").not.toMatch(/\bR2\b/);
	});

	it("A14: shows in `promises status` before anything else and in promise_health, with its age and owner", async () => {
		const p = failingSince();
		p.release();
		const id = incidentId(onlyIncident(p));
		const status = p.run(["promises", "status"]);
		const first = status.stdout.split("\n").find((l) => l.trim() !== "") ?? "";
		expect(first, `stdout:\n${status.stdout}\nstderr:\n${status.stderr}`).toContain(id);
		expect(first).toMatch(/open /);
		expect(first).toContain(OWNER);

		const tools = toolCaller((s) => registerPromiseTools(s, p.root));
		const { json } = await tools.call("promise_health");
		const open = (json as { openIncidents?: Record<string, unknown>[] }).openIncidents;
		expect(open, JSON.stringify(json)).toEqual([
			expect.objectContaining({ id, promise: PROMISE, owner: OWNER, ownerHasPhase: true }),
		]);
		expect(typeof open?.[0]?.ageMs).toBe("number");
	});

	it("A23: an incident a release opens is committed on the trunk and appears in the break inbox", () => {
		const p = failingSince();
		p.release();
		const file = onlyIncident(p);
		const id = incidentId(file);
		const rel = `.indusk/promises/incidents/${file}`;
		const status = git(p.planRoot, ["status", "--porcelain", "--", ".indusk/promises"]).stdout;
		expect(status.trim(), "the incident and its promise are left uncommitted").toBe("");
		const log = git(p.planRoot, ["log", "-1", "--format=%s", "--", rel]).stdout;
		expect(log, "the incident file's last commit").toContain(id);
		expect(git(p.planRoot, ["branch", "--show-current"]).stdout.trim()).toMatch(/^(main|master)$/);

		const projectHome = p.run(["eval", "home"]).stdout.trim();
		const inbox = join(projectHome, "inbox.jsonl");
		expect(existsSync(inbox), `no inbox at ${inbox}`).toBe(true);
		const entries = readFileSync(inbox, "utf-8")
			.split("\n")
			.filter(Boolean)
			.map((l) => JSON.parse(l) as Record<string, unknown>);
		expect(entries).toEqual([
			expect.objectContaining({ kind: "break", promise: PROMISE, incident: id, owner: OWNER }),
		]);
	});
});
