import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { siteFile, testFile, writeIncident, writePromise } from "./helpers/promises-fixture.js";
import {
	commitFile,
	LAYOUTS,
	makeVersionedWorkbench,
	twoRepos,
	type VersionedWorkbench,
} from "./helpers/versioned-workbench.js";

/**
 * day-promises — A12: in a one-repo workbench the registry is plan-root state
 * and sites/tests are code-repo facts, over every layout; zero or several
 * declared repos refuse by name.
 *
 * The registry is written at the WORKBENCH root and the token-bearing files
 * are committed in the wrapped repo; a check that read either from the wrong
 * root would fail on "no registry" or "no code site". CLI boundary, so the
 * red today is the unknown-command exit.
 */

function writeRegistry(wb: VersionedWorkbench, extraDomains: string[] = []): void {
	const config = join(wb.root, ".indusk", "config.json");
	const current = JSON.parse(readFileSync(config, "utf-8"));
	current.promises = { domains: ["seating", ...extraDomains] };
	writeFileSync(config, `${JSON.stringify(current, null, 2)}\n`);

	const planDir = join(wb.root, ".indusk", "planning", "archive", "lab-v0");
	mkdirSync(planDir, { recursive: true });
	writeFileSync(join(planDir, "brief.md"), "---\ntitle: lab-v0\nstatus: accepted\n---\n# lab-v0\n");

	const registry = join(wb.root, ".indusk", "promises");
	writePromise(registry, {
		name: "seat-never-double-booked",
		kind: "behaviour",
		state: "enforced",
		domain: "seating",
		owner: "lab-v0",
		sites: ["src/seats.ts"],
		tests: ["src/seats.test.ts"],
	});
	writePromise(registry, {
		name: "impact-events-are-strikes",
		kind: "behaviour",
		state: "known-violated",
		domain: "seating",
		owner: "lab-v0",
		incidents: ["i-1"],
	});
	writeIncident(join(registry, "incidents"), {
		id: "i-1",
		promise: "impact-events-are-strikes",
		source: "local",
	});
}

describe.skipIf(SHOULD_SKIP)("A12 — promises check across a one-repo workbench", () => {
	describe.each(LAYOUTS)("%s", (_label, build) => {
		it("reads the registry from the plan root and the links from the code root", () => {
			const wb = build();
			try {
				writeRegistry(wb);
				const repo = wb.repos[0];
				if (!repo) throw new Error("fixture declared no repo");
				commitFile(repo.dir, "src/seats.ts", siteFile("seat-never-double-booked"), "site");
				commitFile(repo.dir, "src/seats.test.ts", testFile("seat-never-double-booked"), "test");

				const r = runCli(wb.root, ["promises", "check"]);
				expect(r.code, r.stderr).toBe(0);
				expect(r.stdout).toMatch(/2 promises/);
			} finally {
				wb.cleanup();
			}
		});

		it("a token in the code repo with no entry at the plan root fails naming the code file", () => {
			const wb = build();
			try {
				writeRegistry(wb);
				const repo = wb.repos[0];
				if (!repo) throw new Error("fixture declared no repo");
				commitFile(repo.dir, "src/seats.ts", siteFile("seat-never-double-booked"), "site");
				commitFile(repo.dir, "src/seats.test.ts", testFile("seat-never-double-booked"), "test");
				commitFile(repo.dir, "src/stray.ts", siteFile("unregistered"), "stray");

				const r = runCli(wb.root, ["promises", "check"]);
				expect(r.code).toBe(2);
				expect(r.stderr).toContain("src/stray.ts");
				expect(r.stderr).toContain("unregistered");
			} finally {
				wb.cleanup();
			}
		});
	});

	it("a workbench declaring no repos refuses by name", () => {
		const wb = makeVersionedWorkbench({ repos: [], shape: "workbench" });
		try {
			writeRegistry(wb);
			const r = runCli(wb.root, ["promises", "check"]);
			expect(r.code).toBe(2);
			expect(r.stderr).toMatch(/no repos/i);
		} finally {
			wb.cleanup();
		}
	});

	it("a workbench declaring two repos refuses naming both", () => {
		const wb = twoRepos();
		try {
			writeRegistry(wb);
			const r = runCli(wb.root, ["promises", "check"]);
			expect(r.code).toBe(2);
			expect(r.stderr).toContain("alpha");
			expect(r.stderr).toContain("beta");
		} finally {
			wb.cleanup();
		}
	});

	it("a repo's own promises folder is its contract, read in place of the workbench's", () => {
		// day-promises wrote this the other way: the registry was plan-root
		// state, and a promises folder inside the wrapped repo was not read.
		// workbench-plan-authoring D4 reversed it: a repo has one contract, its
		// own `.indusk/promises/` once it holds one, and the workbench's folder
		// is only its shadow until then. So the repo's folder is the one checked.
		const wb = LAYOUTS[1]?.[1]();
		if (!wb) throw new Error("no nested layout");
		try {
			const repo = wb.repos[0];
			if (!repo) throw new Error("fixture declared no repo");
			const inRepo = join(repo.dir, ".indusk", "promises", "x.md");
			mkdirSync(dirname(inRepo), { recursive: true });
			writeFileSync(inRepo, "---\nname: x\n---\nnot a valid promise\n");
			const r = runCli(wb.root, ["promises", "check"]);
			expect(r.code).toBe(2);
			expect(r.stderr).toMatch(/x\.md: missing or invalid `kind`/);
		} finally {
			wb.cleanup();
		}
	});
});
