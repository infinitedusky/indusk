import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import {
	bash,
	trunkProject as project,
	removeTrunkProjects,
	stage,
} from "./helpers/trunk-guard-fixture.js";

/**
 * release-ritual — T1–T5: trunk-guard reads the message it is given.
 *
 * The `chore(release):` exemption is matched by a regex over the raw command
 * text, which recognises only `-m`. Two consequences, both found while
 * publishing 1.54.0:
 *
 * - a release commit written with `-F <file>` is refused, because the message
 *   lives in the file and the regex never sees it;
 * - a release commit written with `-m "$(cat <<EOF …)"` is refused *and* the
 *   words of the message are tokenized as **file paths**, so the refusal
 *   prints the commit message under "refusing to commit code on `main`".
 *
 * Both fail toward refusal, which is the safe direction. Neither says so.
 */

afterEach(removeTrunkProjects);

/** A message file, as `git commit -F` takes one. */
function messageFile(root: string, body: string): string {
	const path = join(root, "msg.txt");
	writeFileSync(path, body);
	return path;
}

describe("T1 — a release commit whose message is in a file", () => {
	it("is allowed with -F", async () => {
		const root = project();
		stage(root, "package.json", '{"name":"p","version":"1.1.0"}\n');
		const file = messageFile(root, "chore(release): 1.1.0 — the bump\n\nBody.\n");
		const r = await runHook("trunk-guard.js", bash(root, `git commit -q -F ${file}`));
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("T2 — the same, spelled --file=", () => {
	it("is allowed", async () => {
		const root = project();
		stage(root, "package.json", '{"name":"p","version":"1.1.0"}\n');
		const file = messageFile(root, "chore(release): 1.1.0 — the bump\n");
		const r = await runHook("trunk-guard.js", bash(root, `git commit -q --file=${file}`));
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

describe("T3 — a quote inside a heredoc message does not turn the message into paths", () => {
	it("allows a commit staging only allowlisted paths, and never prints message text as a filename", async () => {
		const root = project();
		stage(root, ".indusk/notes.md", "# more notes\n");
		// The exact shape that refused while landing day-always-on: inside
		// `-m "$(cat <<EOF …)"`, a literal double quote in the body closes the
		// tokenizer's quote, and the rest of that line is read as a pathspec.
		const command = [
			`git commit -q -m "$(cat <<'EOF'`,
			"plan(x): a subject",
			"",
			'"exactly once" is a durability claim, with five failure sites',
			"EOF",
			`)"`,
		].join("\n");
		const r = await runHook("trunk-guard.js", bash(root, command));
		expect(r.exitCode, r.stderr).toBe(0);
		expect(
			r.stderr,
			"a fragment of the commit message must never be reported as a file",
		).not.toContain("is a durability claim");
	});
});

describe("T4 — an unreadable message with packaged paths staged", () => {
	it("refuses by naming the unreadable message, not only by claiming code", async () => {
		const root = project();
		stage(root, "src/a.ts", "export const a = 2;\n");
		const command = `git commit -q -m "$(printf 'chore(release): 1.1.0')"`;
		const r = await runHook("trunk-guard.js", bash(root, command));
		expect(r.exitCode).toBe(2);
		expect(
			r.stderr,
			"the reason given must be the real one: the message could not be read",
		).toMatch(/could not (be )?read|unreadable/i);
		expect(r.stderr, "and it must say how to make it readable").toMatch(/-m|-F|--file/);
	});
});

describe("T5 — the file is read, not trusted", () => {
	it("still refuses a non-release commit supplied with -F that stages packaged paths", async () => {
		const root = project();
		stage(root, "src/a.ts", "export const a = 3;\n");
		const file = messageFile(root, "feat: something that is not a release\n");
		const r = await runHook("trunk-guard.js", bash(root, `git commit -q -F ${file}`));
		expect(r.exitCode, "a -F message that is not chore(release): gets no exemption").toBe(2);
		expect(r.stderr).toContain("src/a.ts");
	});
});

describe("T10 — a backslash-continued commit is read the same as the one-line form", () => {
	it("allows a multi-line commit staging only allowlisted paths, as it allows the one-line form", async () => {
		const root = project();
		stage(root, ".indusk/notes.md", "# continued notes\n");
		const oneLine = `git commit -q -m "plan(x): a subject" -m "a body paragraph"`;
		const continued = [
			`git commit -q \\`,
			`  -m "plan(x): a subject" \\`,
			`  -m "a body paragraph"`,
		].join("\n");
		const single = await runHook("trunk-guard.js", bash(root, oneLine));
		expect(single.exitCode, `the one-line form is the baseline: ${single.stderr}`).toBe(0);
		const multi = await runHook("trunk-guard.js", bash(root, continued));
		expect(multi.exitCode, `a continuation is not a pathspec: ${multi.stderr}`).toBe(0);
	});
});

describe("the installed copies `indusk update` writes are allowed on trunk", () => {
	it("allows a commit staging .claude/skills/ and .claude/hooks/", async () => {
		const root = project();
		mkdirSync(join(root, ".claude", "skills", "testing"), { recursive: true });
		mkdirSync(join(root, ".claude", "hooks"), { recursive: true });
		stage(root, ".claude/skills/testing/SKILL.md", "# testing\n");
		stage(root, ".claude/hooks/check-gates.js", "// installed copy\n");
		const r = await runHook(
			"trunk-guard.js",
			bash(root, `git commit -q -m "chore: indusk update"`),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("still refuses other .claude/ paths — the allowance is the two installed directories, not .claude/", async () => {
		const root = project();
		mkdirSync(join(root, ".claude", "agents"), { recursive: true });
		stage(root, ".claude/agents/x.md", "# agent\n");
		const r = await runHook("trunk-guard.js", bash(root, `git commit -q -m "chore: an agent"`));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toContain(".claude/agents/x.md");
	});
});

describe("T12 — only this commit's own subject line can exempt it", () => {
	it("refuses a code commit whose later -m paragraph begins chore(release):", async () => {
		const root = project();
		stage(root, "src/a.ts", "export const a = 4;\n");
		const command = `git commit -q -m "feat: code" -m "chore(release): mentioned in the body"`;
		const r = await runHook("trunk-guard.js", bash(root, command));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain("src/a.ts");
	});

	it("refuses a code commit preceded by a command that mentions chore(release):", async () => {
		const root = project();
		stage(root, "src/a.ts", "export const a = 5;\n");
		const command = `echo -m "chore(release): not this commit"; git commit -q -m "feat: code"`;
		const r = await runHook("trunk-guard.js", bash(root, command));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain("src/a.ts");
	});

	it("refuses a code commit preceded by a command that names a release message file", async () => {
		const root = project();
		stage(root, "src/a.ts", "export const a = 6;\n");
		const file = messageFile(root, "chore(release): 1.1.0\n");
		const command = `grep -F ${file} /dev/null; git commit -q -m "feat: code"`;
		const r = await runHook("trunk-guard.js", bash(root, command));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain("src/a.ts");
	});
});
