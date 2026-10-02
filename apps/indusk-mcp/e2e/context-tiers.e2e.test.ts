import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/__tests__/helpers/cli.js";

/**
 * context-tiers — A1, A2, A17, A3: nested context files reach the session that
 * touches their directory, through the documented path and nothing else.
 *
 * Research Finding 4 (2026-10-01) measured this: Claude Code loads every
 * `CLAUDE.md` on the ancestor path between a file it reads and the session
 * cwd, at read time. The behaviour is observed, not documented, so this probe
 * is the standing guard that it has not changed — a headless `claude -p` is
 * asked to touch one file and report the codewords in its context. A1 and A2
 * are green on arrival by design (regression guards); A17 asks the one thing
 * Finding 4 did not — whether a Write to an unread directory loads it — and
 * A3 runs the probe against this repository's real planning file.
 *
 * Needs the `claude` CLI on PATH; run with `pnpm e2e`.
 */

const ROOT_WORD = "ROOTWORD-9f1";
const PLAN_WORD = "PLANWORD-4c2";
const ADMIN_WORD = "ADMINWORD-7e5";
const REAL_RULE = "fencedLineMask";

function claudeOnPath(): boolean {
	return spawnSync("claude", ["--version"], { encoding: "utf-8" }).status === 0;
}

const CODEWORD_PROMPT =
	"After doing exactly what the first sentence asks, answer with one line per codeword you can see anywhere in your instructions or context, in the form `CODEWORD: <word>`, and nothing else. A codeword is a token of the form WORD-xxx in all capitals.";

function probe(cwd: string, prompt: string, tool: "Read" | "Write"): string {
	const r = spawnSync(
		"claude",
		["-p", prompt, "--allowedTools", tool, "--output-format", "text", "--max-turns", "4"],
		{ cwd, encoding: "utf-8", timeout: 170_000 },
	);
	if (r.status !== 0) throw new Error(`claude -p failed: ${r.stderr}`);
	return r.stdout;
}

const words = (out: string) =>
	new Set([...out.matchAll(/CODEWORD:\s*([A-Z]+-[0-9a-z]+)/g)].map((m) => m[1]));

let fixture: string | null = null;
function fixtureRoot(): string {
	if (fixture) return fixture;
	const root = mkdtempSync(join(tmpdir(), "context-tiers-e2e-"));
	mkdirSync(join(root, ".indusk/planning/p"), { recursive: true });
	mkdirSync(join(root, "apps/admin"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, "CLAUDE.md"), `# Fixture\n\nCodeword: ${ROOT_WORD}\n`);
	writeFileSync(
		join(root, ".indusk/planning/CLAUDE.md"),
		`# Planning rules\n\nCodeword: ${PLAN_WORD}\n`,
	);
	writeFileSync(join(root, ".indusk/planning/p/impl.md"), "# p\n\n- [ ] an item\n");
	writeFileSync(join(root, "apps/admin/CLAUDE.md"), `# Admin rules\n\nCodeword: ${ADMIN_WORD}\n`);
	writeFileSync(join(root, "apps/admin/Thing.tsx"), "export const Thing = () => null;\n");
	writeFileSync(join(root, "src/other.ts"), "export const other = 1;\n");
	fixture = root;
	return root;
}
afterAll(() => {
	if (fixture) rmSync(fixture, { recursive: true, force: true });
});

describe.skipIf(!claudeOnPath())("nested context files reach the session that touches them", () => {
	it("A1 — reading a plan's impl loads the planning file, which the root does not carry", () => {
		const root = fixtureRoot();
		expect(readFileSync(join(root, "CLAUDE.md"), "utf-8")).not.toContain(PLAN_WORD);
		const got = words(
			probe(root, `Read the file .indusk/planning/p/impl.md. ${CODEWORD_PROMPT}`, "Read"),
		);
		expect(got, "the root is always loaded").toContain(ROOT_WORD);
		expect(got, "the planning file loaded on the read beneath it").toContain(PLAN_WORD);
	});

	it("A2 — the admin file loads only when an admin file is read", () => {
		const root = fixtureRoot();
		const without = words(probe(root, `Read the file src/other.ts. ${CODEWORD_PROMPT}`, "Read"));
		expect(without, "a sibling directory's file is never loaded").not.toContain(ADMIN_WORD);
		const withAdmin = words(
			probe(root, `Read the file apps/admin/Thing.tsx. ${CODEWORD_PROMPT}`, "Read"),
		);
		expect(withAdmin).toContain(ADMIN_WORD);
	});

	it("A17 — writing a new plan's first file, with nothing there read, loads the planning file", () => {
		const root = fixtureRoot();
		const target = ".indusk/planning/newplan/brief.md";
		probe(
			root,
			`Using only the Write tool, and without reading any file first, create the file ${target}. Its content is one line per codeword you can see anywhere in your instructions or context, in the form \`CODEWORD: <word>\` (a codeword is a token of the form WORD-xxx in all capitals). Write nothing else to the file and say nothing afterwards.`,
			"Write",
		);
		expect(existsSync(join(root, target)), "the probe wrote the file").toBe(true);
		const got = words(readFileSync(join(root, target), "utf-8"));
		expect(got).toContain(ROOT_WORD);
		expect(got, "the planning file loaded for a Write beneath it").toContain(PLAN_WORD);
	});

	it("A3 — this repository's planning file reaches a session that reads an impl", () => {
		const root = readFileSync(join(REPO_ROOT, "CLAUDE.md"), "utf-8");
		expect(root, `the rule has left the root, so only the nested file can supply it`).not.toContain(
			REAL_RULE,
		);
		const planning = join(REPO_ROOT, ".indusk/planning/CLAUDE.md");
		expect(existsSync(planning)).toBe(true);
		expect(readFileSync(planning, "utf-8")).toContain(REAL_RULE);
		const out = probe(
			REPO_ROOT,
			`Read the file .indusk/planning/context-tiers/impl.md. Then answer with exactly one word, PRESENT or ABSENT: whether the identifier ${REAL_RULE} appears in the instructions or context files loaded for this session (not counting the file you just read).`,
			"Read",
		);
		expect(out.trim()).toMatch(/PRESENT/);
	});
});
