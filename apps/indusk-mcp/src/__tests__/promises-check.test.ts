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
 * day-promises — Test Phase 1: the check refuses a registry that lies.
 *
 * Every row here reaches `indusk promises check` over the CLI boundary, so
 * before the command exists the red is commander's unknown-command exit (1,
 * where 0 or 2 is asserted) rather than a file that fails to load. Each
 * refusal row asserts the exit code AND that stderr names what the test plan
 * says it names: a refusal message is a factual claim, and a correct decision
 * to refuse can still carry a wrong path.
 */

const check = (root: string) => runCli(root, ["promises", "check"]);

function withClean(mutate: (o: PromiseProjectOptions) => void): PromiseProjectOptions {
	const o = cleanProjectOptions();
	mutate(o);
	return o;
}

describe.skipIf(SHOULD_SKIP)("indusk promises check — refusals by name", () => {
	it("A1: no registry → non-zero, naming where one is expected; never clean", () => {
		const p = promiseProject({ domains: ["seating"], registry: false });
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toMatch(/no promise registry/i);
		expect(r.stderr).toContain(".indusk/promises");
		expect(r.stdout + r.stderr).not.toMatch(/\bclean\b|0 promises/);
	});

	it("A2: a token with no registry entry fails, naming the file and the name", () => {
		const p = promiseProject(
			withClean((o) => {
				o.files = { ...o.files, "src/stray.ts": siteFile("no-such-promise") };
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("src/stray.ts");
		expect(r.stderr).toContain("no-such-promise");
	});

	it("A3: an enforced behaviour promise with no test naming it fails, naming the promise and the link", () => {
		const p = promiseProject(
			withClean((o) => {
				o.files = { ...o.files, "src/seats.test.ts": "// nothing here\n" };
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("seat-never-double-booked");
		expect(r.stderr).toMatch(/no test/i);
	});

	it("A3: an enforced state promise with no code site naming it fails, naming the promise and the link", () => {
		const p = promiseProject(
			withClean((o) => {
				o.files = { ...o.files, "src/table.ts": "export const t = 1;\n" };
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("seat-count-matches-table");
		expect(r.stderr).toMatch(/no code site/i);
	});

	it("A4: an enforced structure promise with no test fails; with a test and no site it passes", () => {
		const missing = promiseProject(
			withClean((o) => {
				o.files = { ...o.files, "src/archive-writer.test.ts": "// nothing\n" };
			}),
		);
		const r1 = check(missing.root);
		expect(r1.code).toBe(2);
		expect(r1.stderr).toContain("one-archive-writer");
		expect(r1.stderr).toMatch(/no test/i);

		const fine = promiseProject(cleanProjectOptions());
		const r2 = check(fine.root);
		expect(r2.code, r2.stderr).toBe(0);
	});

	it("A5: known-violated with no incident fails; with an open incident it passes with no links", () => {
		const bare = promiseProject(
			withClean((o) => {
				const kv = o.promises?.find((x) => x.name === "impact-events-are-strikes");
				if (!kv) throw new Error("fixture lost its known-violated promise");
				kv.incidents = [];
			}),
		);
		const r1 = check(bare.root);
		expect(r1.code).toBe(2);
		expect(r1.stderr).toContain("impact-events-are-strikes");
		expect(r1.stderr).toMatch(/incident/i);

		const fine = promiseProject(cleanProjectOptions());
		expect(check(fine.root).code).toBe(0);
	});

	it("A6: an undeclared domain fails naming the domain and the declared list", () => {
		const p = promiseProject(
			withClean((o) => {
				const s = o.promises?.find((x) => x.name === "one-archive-writer");
				if (!s) throw new Error("fixture lost its structure promise");
				s.domain = "billing";
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("billing");
		expect(r.stderr).toContain("seating");
		expect(r.stderr).toContain("archive");
	});

	it("A6: an empty domains list fails on the first promise, saying where to declare one", () => {
		const p = promiseProject(
			withClean((o) => {
				o.domains = [];
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("promises.domains");
		expect(r.stderr).toContain(".indusk/config.json");
	});

	it("A7: an owner that is not a plan folder fails naming the owner", () => {
		const p = promiseProject(
			withClean((o) => {
				const s = o.promises?.find((x) => x.name === "seat-count-matches-table");
				if (!s) throw new Error("fixture lost its state promise");
				s.owner = "ghost-plan";
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("ghost-plan");
		expect(r.stderr).toMatch(/owner/i);
	});

	it("A8: a declared promise passes with no links while its owner is open, and fails once archived", () => {
		const declared = (owner: string): PromiseProjectOptions =>
			withClean((o) => {
				o.promises?.push({
					name: "seat-release-on-timeout",
					kind: "behaviour",
					state: "declared",
					domain: "seating",
					owner,
					statement: "A held seat is released after thirty seconds.",
				});
			});
		expect(check(promiseProject(declared("seats-v2")).root).code).toBe(0);

		const r = check(promiseProject(declared("lab-v0")).root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("seat-release-on-timeout");
		expect(r.stderr).toMatch(/archived/i);
	});

	it("A9: a token naming a retired promise fails naming the file", () => {
		const p = promiseProject(
			withClean((o) => {
				o.promises?.push({
					name: "old-seat-rule",
					kind: "state",
					state: "retired",
					domain: "seating",
					owner: "lab-v0",
					statement: "Seats were numbered from zero.",
				});
				o.files = { ...o.files, "src/legacy.ts": siteFile("old-seat-rule") };
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("src/legacy.ts");
		expect(r.stderr).toContain("old-seat-rule");
		expect(r.stderr).toMatch(/retired/i);
	});

	it("A10: an entry missing a required field fails naming the entry and the field; never skipped", () => {
		for (const field of ["kind", "state", "owner"] as const) {
			const p = promiseProject(
				withClean((o) => {
					const s = o.promises?.find((x) => x.name === "one-archive-writer");
					if (!s) throw new Error("fixture lost its structure promise");
					s.omit = [field];
				}),
			);
			const r = check(p.root);
			expect(r.code, `omitting ${field}`).toBe(2);
			expect(r.stderr).toContain("one-archive-writer.md");
			expect(r.stderr).toContain(field);
		}
	});

	it("A10: an entry with no statement fails naming the entry", () => {
		const p = promiseProject(
			withClean((o) => {
				const s = o.promises?.find((x) => x.name === "one-archive-writer");
				if (!s) throw new Error("fixture lost its structure promise");
				s.statement = "";
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("one-archive-writer.md");
		expect(r.stderr).toMatch(/statement/i);
	});

	it("A10: malformed frontmatter fails naming the file; never skipped", () => {
		const p = promiseProject(
			withClean((o) => {
				o.promises?.push({
					name: "broken",
					kind: "state",
					state: "enforced",
					domain: "seating",
					owner: "lab-v0",
					raw: "---\nname: broken\nkind: [unclosed\n---\n\nA statement.\n",
				});
			}),
		);
		const r = check(p.root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("broken.md");
		expect(r.stderr).toMatch(/frontmatter/i);
	});

	it("A11: a clean registry exits 0 and prints promises by state and by kind, and the incident count", () => {
		const p = promiseProject(cleanProjectOptions());
		const r = check(p.root);
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout).toMatch(/4 promises/);
		expect(r.stdout).toMatch(/enforced 3/);
		expect(r.stdout).toMatch(/known-violated 1/);
		expect(r.stdout).toMatch(/behaviour 2/);
		expect(r.stdout).toMatch(/state 1/);
		expect(r.stdout).toMatch(/structure 1/);
		expect(r.stdout).toMatch(/1 incident/);
	});

	it("A13: an established promise still enforced after its owner archived fails; while open it passes", () => {
		const established = (owner: string): PromiseProjectOptions =>
			withClean((o) => {
				o.promises?.push({
					name: "seat-backfill-ran",
					kind: "state",
					lifetime: "established",
					state: "enforced",
					domain: "seating",
					owner,
					statement: "Every legacy seat row carries a table id.",
					sites: ["src/backfill.ts"],
					tests: ["src/backfill.test.ts"],
				});
				o.files = {
					...o.files,
					"src/backfill.ts": siteFile("seat-backfill-ran"),
					"src/backfill.test.ts": testFile("seat-backfill-ran"),
				};
			});
		expect(check(promiseProject(established("seats-v2")).root).code).toBe(0);

		const r = check(promiseProject(established("lab-v0")).root);
		expect(r.code).toBe(2);
		expect(r.stderr).toContain("seat-backfill-ran");
		expect(r.stderr).toMatch(/established/i);
		expect(r.stderr).toMatch(/retired/i);
	});

	it("A16: an incident missing a field, with an unknown source, or missing a section fails naming the incident", () => {
		const cases: Array<
			[label: string, mutate: PromiseProjectOptions["incidents"], expectText: RegExp]
		> = [
			[
				"missing source",
				[
					{
						id: "i-2026-08-26-detector-overtriggers",
						promise: "impact-events-are-strikes",
						source: "smoke",
						omit: ["source"],
					},
				],
				/source/i,
			],
			[
				"unknown source",
				[
					{
						id: "i-2026-08-26-detector-overtriggers",
						promise: "impact-events-are-strikes",
						source: "production",
					},
				],
				/production/,
			],
			[
				"missing root cause",
				[
					{
						id: "i-2026-08-26-detector-overtriggers",
						promise: "impact-events-are-strikes",
						source: "smoke",
						omitSections: ["root-cause"],
					},
				],
				/root cause/i,
			],
		];
		for (const [label, incidents, expectText] of cases) {
			const p = promiseProject(
				withClean((o) => {
					o.incidents = incidents;
				}),
			);
			const r = check(p.root);
			expect(r.code, label).toBe(2);
			expect(r.stderr, label).toContain("i-2026-08-26-detector-overtriggers");
			expect(r.stderr, label).toMatch(expectText);
		}
	});

	it("the token form is the one the fixture writes", () => {
		expect(token("x-y")).toBe("promise: x-y");
	});
});
