import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { git, initRepoWithCommit } from "./helpers/test-git.js";

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

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A project on `main` with one allowlisted file and one packaged file, both staged-able. */
function project(): string {
	const root = mkdtempSync(join(tmpdir(), "release-msg-"));
	roots.push(root);
	initRepoWithCommit(root);
	mkdirSync(join(root, ".indusk"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ mode: "local" }));
	writeFileSync(join(root, ".indusk", "notes.md"), "# notes\n");
	writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
	writeFileSync(join(root, "package.json"), '{"name":"p","version":"1.0.0"}\n');
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "seed"]);
	return root;
}

function stage(root: string, rel: string, body: string): void {
	writeFileSync(join(root, rel), body);
	git(root, ["add", rel]);
}

const bash = (root: string, command: string) => ({
	tool_name: "Bash",
	tool_input: { command },
	cwd: root,
});

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
