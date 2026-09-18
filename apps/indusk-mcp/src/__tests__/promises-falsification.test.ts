import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	cleanProjectOptions,
	type PromiseProjectOptions,
	promiseProject,
	siteFile,
	testFile,
	token,
} from "./helpers/promises-fixture.js";

/**
 * day-promises — Build Phase 5, the falsification hypotheses (A27–A31).
 *
 * Each case names a specific input the shipped check trusts when it should
 * not, or refuses when it should not. All reach the check over the CLI
 * boundary, so each is a real red against the shipped behaviour and goes
 * green only when the fix lands. A refusal message is a factual claim, so
 * every refusal case asserts what stderr names.
 */

const check = (root: string) => runCli(root, ["promises", "check"]);

function withClean(mutate: (o: PromiseProjectOptions) => void): PromiseProjectOptions {
	const o = cleanProjectOptions();
	mutate(o);
	return o;
}

const known = token("seat-never-double-booked");

describe.skipIf(SHOULD_SKIP)(
	"A27 — a token after a comment opener anywhere on its line counts; a quote must directly precede",
	() => {
		it("a listed site whose comment has text before the token names the promise", () => {
			const p = promiseProject(
				withClean((o) => {
					o.files = {
						...o.files,
						"src/seats.ts": `// enforces ${known}\nexport const x = 1;\n`,
						"src/seats.test.ts": `/* see also: ${known} */\nimport { it } from "vitest";\nit("x", () => {});\n`,
					};
				}),
			);
			const r = check(p.root);
			expect(r.code, r.stderr).toBe(0);
		});

		it("a token after `#` or `<!--` with text before it is a citation; an unregistered one is refused", () => {
			const p = promiseProject(
				withClean((o) => {
					o.files = {
						...o.files,
						"src/a.py": `# guards ${token("nope-py")}\n`,
						"src/b.html": `<!-- guards ${token("nope-html")} -->\n`,
					};
				}),
			);
			const r = check(p.root);
			expect(r.code).toBe(2);
			expect(r.stderr).toContain("nope-py");
			expect(r.stderr).toContain("nope-html");
		});

		it("a type annotation on a line with an earlier string literal is still not a citation", () => {
			const p = promiseProject(
				withClean((o) => {
					o.files = {
						...o.files,
						"src/types.ts":
							'const label = "seat"; export type Row = { promise: string; label: string };\n',
					};
				}),
			);
			expect(check(p.root).code).toBe(0);
		});
	},
);

describe.skipIf(SHOULD_SKIP)(
	"A28 — an owner is a plan directory, never the archive folder or a file",
	() => {
		it("owner `archive` is refused naming it", () => {
			const p = promiseProject(
				withClean((o) => {
					const s = o.promises?.find((x) => x.name === "one-archive-writer");
					if (!s) throw new Error("fixture lost its structure promise");
					s.owner = "archive";
				}),
			);
			const r = check(p.root);
			expect(r.code).toBe(2);
			expect(r.stderr).toContain("one-archive-writer");
			expect(r.stderr).toContain('"archive"');
		});

		it("an owner that is a file under the planning dir is refused naming it", () => {
			const p = promiseProject(
				withClean((o) => {
					const s = o.promises?.find((x) => x.name === "one-archive-writer");
					if (!s) throw new Error("fixture lost its structure promise");
					s.owner = "master.md";
					o.files = { ...o.files, ".indusk/planning/master.md": "# master\n" };
				}),
			);
			const r = check(p.root);
			expect(r.code).toBe(2);
			expect(r.stderr).toContain("master.md");
			expect(r.stderr).toMatch(/not a plan folder/i);
		});
	},
);

describe.skipIf(SHOULD_SKIP)(
	"A29 — aliases resolve in the link check, and alias integrity is refused at read time",
	() => {
		it("a listed site carrying the old name of a renamed promise names it", () => {
			const p = promiseProject(
				withClean((o) => {
					const s = o.promises?.find((x) => x.name === "seat-never-double-booked");
					if (!s) throw new Error("fixture lost its behaviour promise");
					s.aliases = ["seat-not-double-booked"];
					o.files = {
						...o.files,
						"src/seats.ts": siteFile("seat-not-double-booked"),
						"src/seats.test.ts": testFile("seat-not-double-booked"),
					};
				}),
			);
			const r = check(p.root);
			expect(r.code, r.stderr).toBe(0);
		});

		it("an alias equal to a live promise's name is refused naming both entries", () => {
			const p = promiseProject(
				withClean((o) => {
					const s = o.promises?.find((x) => x.name === "one-archive-writer");
					if (!s) throw new Error("fixture lost its structure promise");
					s.aliases = ["seat-never-double-booked"];
				}),
			);
			const r = check(p.root);
			expect(r.code).toBe(2);
			expect(r.stderr).toContain("one-archive-writer");
			expect(r.stderr).toContain("seat-never-double-booked");
			expect(r.stderr).toMatch(/alias/i);
		});

		it("an alias shared by two promises is refused naming both", () => {
			const p = promiseProject(
				withClean((o) => {
					const a = o.promises?.find((x) => x.name === "one-archive-writer");
					const b = o.promises?.find((x) => x.name === "seat-count-matches-table");
					if (!a || !b) throw new Error("fixture lost a promise");
					a.aliases = ["old-shared-name"];
					b.aliases = ["old-shared-name"];
				}),
			);
			const r = check(p.root);
			expect(r.code).toBe(2);
			expect(r.stderr).toContain("old-shared-name");
			expect(r.stderr).toContain("one-archive-writer");
			expect(r.stderr).toContain("seat-count-matches-table");
		});
	},
);

describe.skipIf(SHOULD_SKIP)("A30 — an enforced promise with an open incident is refused", () => {
	it("names the promise, the incident and its open status", () => {
		const p = promiseProject(
			withClean((o) => {
				const s = o.promises?.find((x) => x.name === "seat-never-double-booked");
				if (!s) throw new Error("fixture lost its behaviour promise");
				s.incidents = ["i-2026-09-18-double-hold"];
				o.incidents?.push({
					id: "i-2026-09-18-double-hold",
					promise: "seat-never-double-booked",
					source: "local",
					status: "open",
				});
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("seat-never-double-booked");
		expect(r.stderr).toContain("i-2026-09-18-double-hold");
		expect(r.stderr).toMatch(/open/);
		expect(r.stderr).toMatch(/known-violated/);
	});

	it("a fixed incident on an enforced promise is history, not a refusal", () => {
		const p = promiseProject(
			withClean((o) => {
				const s = o.promises?.find((x) => x.name === "seat-never-double-booked");
				if (!s) throw new Error("fixture lost its behaviour promise");
				s.incidents = ["i-2026-09-01-double-hold"];
				o.incidents?.push({
					id: "i-2026-09-01-double-hold",
					promise: "seat-never-double-booked",
					source: "local",
					status: "fixed",
				});
			}),
		);
		expect(check(p.root).code).toBe(0);
	});
});

describe.skipIf(SHOULD_SKIP)("A31 — a link path never leaves the code root", () => {
	it("a `..` path in sites is refused naming the entry and the path, and the file outside is not read", () => {
		const p = promiseProject(
			withClean((o) => {
				const s = o.promises?.find((x) => x.name === "seat-never-double-booked");
				if (!s) throw new Error("fixture lost its behaviour promise");
				s.sites = ["../outside-seats.ts"];
			}),
		);
		// A file OUTSIDE the root that carries the token: with the join
		// unguarded the check would read it and call the link satisfied.
		const outside = join(p.root, "..", "outside-seats.ts");
		mkdirSync(dirname(outside), { recursive: true });
		writeFileSync(outside, siteFile("seat-never-double-booked"));
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("seat-never-double-booked");
		expect(r.stderr).toContain("../outside-seats.ts");
	});

	it("an absolute path in tests is refused naming the entry", () => {
		const p = promiseProject(
			withClean((o) => {
				const s = o.promises?.find((x) => x.name === "seat-never-double-booked");
				if (!s) throw new Error("fixture lost its behaviour promise");
				s.tests = ["/etc/hosts"];
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("/etc/hosts");
		expect(r.stderr).toMatch(/relative/i);
	});
});
