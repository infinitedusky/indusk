import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * release-checks-run-once — A7: the landing and release steps every project
 * installs name none of dusk's own commands or paths; they name what
 * `indusk checks show` prints for the project at hand.
 *
 * The steps live in the package's skills: the retrospective's Steps 10 and 11
 * (landing and the bump), the verify skill's "Test (all)" row and the work
 * skill's line on what a phase runs. The rest of the retrospective cites the
 * package's own source for its gates, which is a different matter.
 *
 * promise: landing-and-release-name-the-projects-commands
 */

const SKILLS = resolve(__dirname, "../../skills");
const read = (name: string) => readFileSync(resolve(SKILLS, name), "utf-8");

const DUSK_ONLY = [
	"pnpm test:system",
	"pnpm release",
	"release-guard.sh",
	"PACKAGED_PATHS",
	"apps/docs/src/changelog.md",
	"apps/indusk-mcp/",
];

function steps(): Record<string, string> {
	const retro = read("retrospective.md");
	const landing = retro.slice(retro.indexOf("### Step 10"));
	const verify = read("verify.md")
		.split("\n")
		.filter((l) => l.includes("Test (all)"))
		.join("\n");
	const work = read("work.md")
		.split("\n")
		.filter((l) => l.includes("A phase runs what it touched"))
		.join("\n");
	return {
		"retrospective.md Steps 10–11": landing,
		"verify.md Test (all)": verify,
		"work.md what a phase runs": work,
	};
}

describe("A7 — the landing and release steps name the project's commands, never dusk's", () => {
	for (const [where, text] of Object.entries(steps())) {
		it(`${where} names none of dusk's commands or paths`, () => {
			expect(text.length, `${where} not found`).toBeGreaterThan(0);
			const found = DUSK_ONLY.filter((p) => text.includes(p));
			expect(found, `${where} names ${found.join(", ")}`).toEqual([]);
		});
	}
});
