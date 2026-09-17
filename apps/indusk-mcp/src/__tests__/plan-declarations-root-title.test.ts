import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPlanDeclarations } from "../lib/plan-parser.js";

/**
 * admin-ui-phase-progress — A28 (falsification).
 *
 * The sidebar's root node is titled from the root master: frontmatter `title`,
 * else the first `# ` heading. The fallback matched the first `# ` line of the
 * RAW file — and the real root master carries four `# …` YAML comment lines
 * inside its frontmatter, so a root master without `title:` would have headed
 * the whole tree with "Machine-readable plan hierarchy (dawn-ui-plan-grouping).
 * Prose below is for". The heading must come from the document body.
 */

let root: string;
let planning: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "root-title-"));
	planning = join(root, ".indusk", "planning");
	mkdirSync(planning, { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const COMMENTED_FRONTMATTER = [
	"---",
	"date: 2026-04-19",
	"# Machine-readable plan hierarchy (dawn-ui-plan-grouping). Prose below is for",
	"# humans; these keys are what the parser and admin sidebar read.",
	"parents:",
	"  - dawn",
	"roadmap:",
	"  - dawn",
	"---",
].join("\n");

describe("A28 — the root title never comes from a frontmatter comment", () => {
	it("with no `title` key, the first BODY heading titles the root, not the YAML comment", () => {
		writeFileSync(
			join(planning, "master.md"),
			`${COMMENTED_FRONTMATTER}\n\nSome prose first.\n\n# Real Title\n\nMore prose.\n`,
			"utf8",
		);
		expect(readPlanDeclarations(planning).root).toEqual({ name: "master", title: "Real Title" });
	});

	it("a `# ` line inside a fenced code block in the body is not a heading either", () => {
		writeFileSync(
			join(planning, "master.md"),
			`${COMMENTED_FRONTMATTER}\n\n\`\`\`bash\n# a shell comment\necho hi\n\`\`\`\n\n# Real Title\n`,
			"utf8",
		);
		expect(readPlanDeclarations(planning).root?.title).toBe("Real Title");
	});

	it("a declared `title` still wins over every heading", () => {
		writeFileSync(
			join(planning, "master.md"),
			`---\ntitle: "Declared"\nparents: []\n---\n\n# Body Heading\n`,
			"utf8",
		);
		expect(readPlanDeclarations(planning).root?.title).toBe("Declared");
	});

	it("no heading and no title falls back to the folder-ish default", () => {
		writeFileSync(join(planning, "master.md"), `${COMMENTED_FRONTMATTER}\n\nProse only.\n`, "utf8");
		expect(readPlanDeclarations(planning).root?.title).toBe("master");
	});
});
