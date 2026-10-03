import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerLessonTools } from "../tools/lesson-tools.js";
import { REPO_ROOT } from "./helpers/cli.js";
import { registerRows } from "./helpers/register.js";
import { git, initRepoWithCommit } from "./helpers/test-git.js";
import { toolCaller } from "./helpers/tool-call.js";
import { LAYOUTS } from "./helpers/versioned-workbench.js";

/**
 * context-tiers — A7, A8, A5: a lesson is guarded when an enforcer's message
 * names it, and the state is read, never stored.
 *
 * The scan reuses the promise citation's file set, which skips prose — so a
 * lesson named in a guide, a changelog, or its own body is still advisory
 * (A8). The eight single-definition pins the root file names today are the
 * first enforcers to carry a token (A5); they are listed here by path so an
 * empty register cannot make the row pass by iterating nothing.
 */

const roots: string[] = [];
const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
	for (const c of cleanups.splice(0)) c();
});

const LESSON = "foo-rule";

/** A git repository with one lesson and nothing that names it yet. */
function project(): string {
	const root = mkdtempSync(join(tmpdir(), "context-tiers-lessons-"));
	roots.push(root);
	initRepoWithCommit(root);
	mkdirSync(join(root, ".claude/lessons"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	mkdirSync(join(root, "docs"), { recursive: true });
	writeFileSync(
		join(root, ".claude/lessons", `${LESSON}.md`),
		`# Foo must have one definition\n\nTwo copies drift. Cite as \`lesson: ${LESSON}\`.\n`,
	);
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "a lesson"]);
	return root;
}

interface Listed {
	title: string;
	path: string;
	state?: string;
	guardedBy?: { file: string; kind: string }[];
}

async function listed(root: string): Promise<Listed[]> {
	const { json } = await toolCaller((s) => registerLessonTools(s, root)).call("list_lessons");
	return (json as { lessons: Listed[] }).lessons;
}

const find = (all: Listed[]) => all.find((l) => l.path.endsWith(`${LESSON}.md`));

/** Everything under the root except `.git`, with each file's bytes — to prove a read wrote nothing. */
function snapshot(root: string): Map<string, string> {
	const out = new Map<string, string>();
	const walk = (dir: string) => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			if (e.name === ".git") continue;
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else out.set(p, readFileSync(p, "utf-8"));
		}
	};
	walk(root);
	return out;
}

describe("A7 — guarded or advisory is derived on every read", () => {
	it("is guarded once a test names it, advisory once none does, and nothing is written either way", async () => {
		const root = project();
		const test = join(root, "src/foo.test.ts");
		writeFileSync(
			test,
			`expect(definers("foo"), "lesson: ${LESSON} — one definition").toEqual(["a"]);\n`,
		);
		const before = snapshot(root);

		const guarded = find(await listed(root));
		expect(guarded?.state, "a test carries the token").toBe("guarded");
		expect(
			guarded?.guardedBy?.map((g) => g.file),
			"and is named as the guard",
		).toContain("src/foo.test.ts");
		expect(guarded?.guardedBy?.[0]?.kind).toBe("test");

		writeFileSync(test, `expect(definers("foo")).toEqual(["a"]);\n`);
		const advisory = find(await listed(root));
		expect(advisory?.state, "the token is gone, so is the guard").toBe("advisory");
		expect(advisory?.guardedBy).toEqual([]);

		expect(snapshot(root), "a read writes nothing").toEqual(
			new Map([...before].map(([p, v]) => [p, p === test ? readFileSync(test, "utf-8") : v])),
		);
	});
});

describe("A8 — prose never guards", () => {
	it("stays advisory when the name appears only in a guide and in the lesson's own body", async () => {
		const root = project();
		writeFileSync(
			join(root, "docs/guide.md"),
			`Cite it as \`lesson: ${LESSON}\` in a failing test.\n`,
		);
		writeFileSync(join(root, "CHANGELOG.md"), `- the pin now carries lesson: ${LESSON}\n`);
		const l = find(await listed(root));
		expect(l?.state, "a mention in prose is not an enforcer").toBe("advisory");
	});
});

/** The eight single-definition pins the root file names, by path. */
const PINS = [
	"src/lib/verify/shared-resolution.test.ts",
	"src/lib/shape/shared-definitions.test.ts",
	"src/__tests__/workbench-repos-single-definition.test.ts",
	"src/__tests__/execution-roots-single-definition.test.ts",
	"src/__tests__/head-sha-single-definition.test.ts",
	"src/__tests__/promises-cleanup.test.ts",
	"src/__tests__/plan-worktrees-single-definition.test.ts",
	"src/__tests__/impl-headings.test.ts",
];

const PKG = join(REPO_ROOT, "apps/indusk-mcp");
const REGISTER = join(REPO_ROOT, ".indusk/planning/context-tiers/register.md");

/** The lesson named by the first `expect(…, "lesson: <name> …")` in a test file, or null. */
function lessonNamedBy(source: string): string | null {
	const m = /expect\([^;]*?,\s*["'`]lesson: ([a-z0-9-]+)/s.exec(source);
	return m ? m[1] : null;
}

describe("A5 — each single-definition pin names its lesson when it fails", () => {
	it.each(PINS)("%s", (pin) => {
		const source = readFileSync(join(PKG, pin), "utf-8");
		const name = lessonNamedBy(source);
		expect(name, `${pin} carries no lesson token in an expect message`).not.toBeNull();
		expect(
			existsSync(join(REPO_ROOT, ".claude/lessons", `${name}.md`)),
			`${pin} names lesson "${name}", which is not a file in .claude/lessons/`,
		).toBe(true);
	});

	it("the register lists at least those eight as enforcer rows", () => {
		const rows = registerRows(readFileSync(REGISTER, "utf-8")).filter((r) => r.tier === "enforcer");
		expect(rows.length, "enforcer rows in register.md").toBeGreaterThanOrEqual(PINS.length);
	});
});

describe("A18 — a hook's token opening a line of its refusal guards the lesson", () => {
	it("reads a token directly after a \\n escape inside one string, as kind hook", async () => {
		const root = project();
		mkdirSync(join(root, "hooks"), { recursive: true });
		writeFileSync(
			join(root, "hooks/guard.js"),
			"console.error(`refused: the rule was broken.\\nlesson: foo-rule`);\n",
		);
		const l = find(await listed(root));
		expect(l?.state, "the refusal's second line names the lesson").toBe("guarded");
		expect(l?.guardedBy).toEqual([{ file: "hooks/guard.js", kind: "hook" }]);
	});

	it("this repository's check-gates.js guards test-red-at-earliest-writable-phase", async () => {
		const { lessonStates } = await import("../lib/lessons/state.js");
		const l = (await lessonStates(REPO_ROOT)).find(
			(x) => x.name === "test-red-at-earliest-writable-phase",
		);
		expect(
			l?.guardedBy.map((g) => `${g.file}:${g.kind}`),
			"check-gates' test-first refusal carries the token",
		).toContain("apps/indusk-mcp/hooks/check-gates.js:hook");
	});
});

describe.each(LAYOUTS)(
	"A21 — in a %s workbench, a declared repo's test guards",
	(_label, build) => {
		it("reads the lesson guarded by a test inside the declared repo", async () => {
			const wb = build();
			cleanups.push(() => wb.cleanup());
			mkdirSync(join(wb.root, ".claude/lessons"), { recursive: true });
			writeFileSync(join(wb.root, ".claude/lessons", `${LESSON}.md`), "# Foo has one definition\n");
			const repo = wb.repos[0];
			mkdirSync(join(repo.dir, "src"), { recursive: true });
			writeFileSync(
				join(repo.dir, "src/foo.test.ts"),
				`expect(definers("foo"), "lesson: ${LESSON} — one definition").toEqual(["a"]);\n`,
			);
			git(repo.dir, ["add", "-A"]);
			git(repo.dir, ["commit", "-q", "-m", "a guarding test"]);
			const l = find(await listed(wb.root));
			expect(l?.state, "the code repo's test is an enforcer the wrapper's git cannot see").toBe(
				"guarded",
			);
			expect(
				l?.guardedBy?.some((g) => g.file.endsWith("src/foo.test.ts") && g.kind === "test"),
			).toBe(true);
		});
	},
);
