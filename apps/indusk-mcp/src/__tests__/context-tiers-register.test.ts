import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * context-tiers — A10, A12, A13: no rule is lost, the root carries no
 * operational state, and the smaller root is held by a lower budget.
 *
 * A10 is the plan's own proof that the rewrite dropped nothing: every entry
 * of the root as it stood at the baseline commit — read from git, never from
 * a copy — must have a register row naming where it went. The register is
 * `register.md` in the plan folder; its `baseline:` frontmatter names the
 * commit.
 */

const ROOT_MD = join(REPO_ROOT, "CLAUDE.md");
const CONFIG = join(REPO_ROOT, ".indusk/config.json");
const CURRENT_MD = join(REPO_ROOT, ".indusk/current.md");
const REGISTER = join(REPO_ROOT, ".indusk/planning/context-tiers/register.md");
const PKG_SRC = join(REPO_ROOT, "apps/indusk-mcp/src");

export interface RootEntry {
	section: string;
	text: string;
}

/**
 * The entries of a root context file: under each `## ` section, every
 * top-level bullet and every bold-led paragraph. Fenced blocks (the tree
 * diagram) and plain prose are not entries.
 */
export function rootEntries(md: string): RootEntry[] {
	const out: RootEntry[] = [];
	let section = "";
	let inFence = false;
	for (const raw of md.split("\n")) {
		if (raw.startsWith("```")) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const h = /^## (.+)$/.exec(raw);
		if (h) {
			section = h[1].trim();
			continue;
		}
		if (!section) continue;
		if (/^- /.test(raw) || /^\*\*/.test(raw)) out.push({ section, text: raw.replace(/^- /, "") });
	}
	return out;
}

export interface RegisterRow {
	section: string;
	entry: string;
	tier: string;
	destination: string;
}

const TIERS = new Set(["enforcer", "directory", "root", "current.md", "deleted"]);

export function registerRows(md: string): RegisterRow[] {
	return md
		.split("\n")
		.filter((l) => /^\|\s*\d+\s*\|/.test(l))
		.map((l) => l.split("|").map((c) => c.trim()))
		.filter((c) => TIERS.has(c[4]))
		.map((c) => ({ section: c[2], entry: c[3], tier: c[4], destination: c[5] }));
}

const norm = (s: string) =>
	s
		.toLowerCase()
		.replace(/[*`_[\]()]/g, "")
		.replace(/\s+/g, " ")
		.trim();

function baselineRoot(): { sha: string; md: string } {
	const register = readFileSync(REGISTER, "utf-8");
	const sha = /^baseline:\s*([0-9a-f]+)\s*$/m.exec(register)?.[1];
	if (!sha) throw new Error("register.md names no baseline commit");
	const md = execFileSync("git", ["show", `${sha}:CLAUDE.md`], {
		cwd: REPO_ROOT,
		encoding: "utf-8",
	});
	return { sha, md };
}

describe("A10 — every baseline root entry has a register row with a destination", () => {
	it("names any entry without one", () => {
		const { sha, md } = baselineRoot();
		const entries = rootEntries(md);
		expect(entries.length, `entries parsed from CLAUDE.md at ${sha}`).toBeGreaterThan(50);
		const rows = registerRows(readFileSync(REGISTER, "utf-8"));
		const missing = entries.filter(
			(e) =>
				!rows.some(
					(r) => norm(r.section) === norm(e.section) && norm(e.text).startsWith(norm(r.entry)),
				),
		);
		expect(
			missing.map((e) => `${e.section}: ${e.text.slice(0, 70)}`),
			"baseline entries with no register row",
		).toEqual([]);
		for (const r of rows) {
			expect(r.destination, `row "${r.entry}" has no destination`).not.toBe("");
		}
	});
});

describe("A12 — operational state lives in current.md, not the root", () => {
	it("the root has no Current State section and current.md's shared region holds it", () => {
		const root = readFileSync(ROOT_MD, "utf-8");
		expect(root, "the root carries no Current State heading").not.toMatch(/^## Current State$/m);
		const current = readFileSync(CURRENT_MD, "utf-8");
		const shared = current.slice(current.indexOf("## Project (shared)"));
		const sharedRegion = shared.slice(0, shared.indexOf("\n---"));
		expect(sharedRegion, "the test-bed note moved with the section").toMatch(/Test bed/);
	});

	it("nothing in the package reads the old section, and the consumer template does not ship it", () => {
		const readers = execFileSync("grep", ["-rl", "Current State", "lib", "tools"], {
			cwd: PKG_SRC,
			encoding: "utf-8",
		})
			.split("\n")
			.filter((f) => f && !f.endsWith(".test.ts"));
		expect(readers, "package code naming the retired section").toEqual([]);
		const template = readFileSync(join(REPO_ROOT, "apps/indusk-mcp/templates/CLAUDE.md"), "utf-8");
		expect(template).not.toMatch(/^## Current State$/m);
	});
});

describe("A13 — the root is held by a lower budget, with its reason beside it", () => {
	it("is at least 20 % under the configured budget", () => {
		const config = JSON.parse(readFileSync(CONFIG, "utf-8"));
		const budget = config?.context?.claude_md_budget_bytes;
		expect(typeof budget).toBe("number");
		const size = statSync(ROOT_MD).size;
		expect(size, `root ${size} bytes against budget ${budget}`).toBeLessThanOrEqual(budget * 0.8);
	});

	it("records why the budget is what it is", () => {
		const config = JSON.parse(readFileSync(CONFIG, "utf-8"));
		const reason = config?.context?.claude_md_budget_reason;
		expect(typeof reason, "context.claude_md_budget_reason").toBe("string");
		expect(reason.length).toBeGreaterThan(20);
	});
});
