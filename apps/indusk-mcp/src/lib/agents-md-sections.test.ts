import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ENSURED_AGENTS_MD_SECTIONS,
	ensureAgentsMdSections,
	extractSection,
} from "./agents-md-sections.js";

/**
 * AGENTS.md is user-owned: `init`/`update` copy it once and never overwrite
 * it. That made every conduct rule added after a project's first init
 * unreachable — the file existed, so the template was never consulted again.
 * The ensure appends missing sections and must do nothing else: a user's own
 * wording of a section, their extra sections, and their byte layout all
 * survive, and a second run is a no-op.
 */

const HEADING = "## Citing plan artifacts";

const FAKE_TEMPLATE = [
	"# Agent Conduct",
	"",
	"- Rule one.",
	"",
	HEADING,
	"",
	"Say what A2 is.",
	"",
	"- Bullet.",
	"",
	"## Brevity",
	"",
	"Cut it.",
	"",
].join("\n");

const SECTION = `${HEADING}\n\nSay what A2 is.\n\n- Bullet.`;

const OLD_PROJECT_FILE = "# Agent Conduct\n\n- Rule one.\n\n## Brevity\n\nCut it.\n";

describe("ensureAgentsMdSections", () => {
	let project: string;
	let pkg: string;

	const projectFile = () => join(project, "AGENTS.md");
	const read = () => readFileSync(projectFile(), "utf-8");

	beforeEach(() => {
		project = mkdtempSync(join(tmpdir(), "agents-md-project-"));
		pkg = mkdtempSync(join(tmpdir(), "agents-md-pkg-"));
		mkdirSync(join(pkg, "templates"));
		writeFileSync(join(pkg, "templates/AGENTS.md"), FAKE_TEMPLATE);
	});

	afterEach(() => {
		rmSync(project, { recursive: true, force: true });
		rmSync(pkg, { recursive: true, force: true });
	});

	it("appends the section, verbatim from the template, to a file that lacks it", () => {
		writeFileSync(projectFile(), OLD_PROJECT_FILE);

		const r = ensureAgentsMdSections(project, pkg);
		expect(r).toEqual({ added: [HEADING], current: [], fileMissing: false });
		// The user's content is a byte-identical prefix; only the section follows.
		expect(read()).toBe(`${OLD_PROJECT_FILE}\n${SECTION}\n`);
	});

	it("is idempotent — a second run reports current and writes nothing", () => {
		writeFileSync(projectFile(), OLD_PROJECT_FILE);
		ensureAgentsMdSections(project, pkg);
		const after = read();

		const r = ensureAgentsMdSections(project, pkg);
		expect(r).toEqual({ added: [], current: [HEADING], fileMissing: false });
		expect(read()).toBe(after);
	});

	it("leaves a user-rewritten section byte-untouched — the heading is the identity", () => {
		const mine = `# Mine\n\n${HEADING}\n\nMy own wording, kept.\n\n## Extra\n\nAlso kept.\n`;
		writeFileSync(projectFile(), mine);

		const r = ensureAgentsMdSections(project, pkg);
		expect(r.added).toEqual([]);
		expect(read()).toBe(mine);
	});

	it("matches the heading as a whole line — a mention in prose is not the section", () => {
		// Both a quoted mention and the literal text mid-line: neither is a heading.
		const body = `# Agent Conduct\n\nSee "Citing plan artifacts" below. ${HEADING} mid-line is prose.\n`;
		writeFileSync(projectFile(), body);

		const r = ensureAgentsMdSections(project, pkg);
		expect(r.added).toEqual([HEADING]);
		expect(read()).toBe(`${body}\n${SECTION}\n`);
	});

	it("separates the section with exactly one blank line regardless of trailing whitespace", () => {
		writeFileSync(projectFile(), "# X\n- Rule");
		ensureAgentsMdSections(project, pkg);
		expect(read()).toBe(`# X\n- Rule\n\n${SECTION}\n`);

		writeFileSync(projectFile(), "# X\n- Rule\n\n\n\n");
		ensureAgentsMdSections(project, pkg);
		expect(read()).toBe(`# X\n- Rule\n\n${SECTION}\n`);
	});

	it("reports a missing AGENTS.md and never creates one — creation is the copy path's job", () => {
		const r = ensureAgentsMdSections(project, pkg);
		expect(r).toEqual({ added: [], current: [], fileMissing: true });
		expect(existsSync(projectFile())).toBe(false);
	});

	it("throws when the template lacks a promised section — a packaging bug, not consumer state", () => {
		writeFileSync(join(pkg, "templates/AGENTS.md"), "# Agent Conduct\n\n- Rule one.\n");
		writeFileSync(projectFile(), OLD_PROJECT_FILE);

		expect(() => ensureAgentsMdSections(project, pkg)).toThrow(/Citing plan artifacts/);
		expect(read()).toBe(OLD_PROJECT_FILE);
	});

	it("ensures several headings in one pass, each independently", () => {
		writeFileSync(projectFile(), `# Agent Conduct\n\n## Brevity\n\nMine.\n`);

		const r = ensureAgentsMdSections(project, pkg, { headings: [HEADING, "## Brevity"] });
		expect(r.added).toEqual([HEADING]);
		expect(r.current).toEqual(["## Brevity"]);
	});
});

describe("extractSection", () => {
	it("runs from the heading to the line before the next h2, trailing blanks trimmed", () => {
		expect(extractSection(FAKE_TEMPLATE, HEADING)).toBe(SECTION);
	});

	it("runs to EOF for the last section", () => {
		expect(extractSection(FAKE_TEMPLATE, "## Brevity")).toBe("## Brevity\n\nCut it.");
	});

	it("does not stop at h3 or deeper", () => {
		const t = "## A\n\ntext\n\n### A.1\n\nmore\n\n## B\n";
		expect(extractSection(t, "## A")).toBe("## A\n\ntext\n\n### A.1\n\nmore");
	});
});

describe("the shipped template carries every ensured section", () => {
	const PACKAGE_ROOT = new URL("../..", import.meta.url).pathname;
	const template = readFileSync(join(PACKAGE_ROOT, "templates/AGENTS.md"), "utf-8");

	it.each([...ENSURED_AGENTS_MD_SECTIONS])("%s is in templates/AGENTS.md", (heading) => {
		expect(() => extractSection(template, heading)).not.toThrow();
	});

	it("the ensured list names the citing rule — the reason this module exists", () => {
		expect(ENSURED_AGENTS_MD_SECTIONS).toContain(HEADING);
	});
});
