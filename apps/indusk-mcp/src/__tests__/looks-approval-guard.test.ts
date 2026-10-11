import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * ui-promises A3 (hook half), A28, A29 (hook half) — promise: a-mockup-is-approved-by-a-person.
 *
 * Only the cockpit's Approve makes a mockup the reference. An agent's Write or
 * Edit to an app's `approved.json` is refused before it lands, naming the
 * cockpit's Approve; the mockups themselves, and every other file beside the
 * record, stay the agent's to draw. The hook is driven as a process, the way
 * Claude Code runs it: an event on stdin, the exit code and stderr read back.
 *
 * The project root is a path that never exists: the guard judges the path an
 * agent names, never the file's contents, so nothing is written for it to read.
 */

const ROOT = "/tmp/looks-approval-guard-project";
const RECORD = ".indusk/mockups/demo/approved.json";

const write = (rel: string) => ({
	tool_name: "Write",
	tool_input: { file_path: join(ROOT, rel), content: '{ "approvals": [] }\n' },
	cwd: ROOT,
});

const edit = (rel: string) => ({
	tool_name: "Edit",
	tool_input: { file_path: join(ROOT, rel), old_string: "a", new_string: "b" },
	cwd: ROOT,
});

describe("A3 — an agent's write to approved.json is refused, naming the cockpit's Approve", () => {
	it("refuses a Write to .indusk/mockups/<app>/approved.json", async () => {
		const r = await runHook("looks-approval-guard.js", write(RECORD));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/cockpit/i);
		expect(r.stderr).toMatch(/Approve/);
	});

	it("refuses an Edit of the same file", async () => {
		const r = await runHook("looks-approval-guard.js", edit(RECORD));
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/cockpit/i);
	});

	it("refuses it under any app, and under a relative path", async () => {
		const other = await runHook(
			"looks-approval-guard.js",
			write(".indusk/mockups/admin/approved.json"),
		);
		expect(other.exitCode, other.stderr).toBe(2);
		const relative = await runHook("looks-approval-guard.js", {
			...edit(RECORD),
			tool_input: { file_path: RECORD, old_string: "a", new_string: "b" },
		});
		expect(relative.exitCode, relative.stderr).toBe(2);
	});

	it("lets a mockup, the foundation and the devices be written — drawing is the agent's", async () => {
		for (const rel of [
			".indusk/mockups/demo/screens/home.empty.html",
			".indusk/mockups/demo/foundation.tokens.json",
			".indusk/mockups/demo/devices.json",
			"src/approved.json",
		]) {
			const r = await runHook("looks-approval-guard.js", write(rel));
			expect(r.exitCode, `${rel}: ${r.stderr}`).toBe(0);
		}
	});

	it("leaves every other tool alone", async () => {
		const r = await runHook("looks-approval-guard.js", {
			tool_name: "Bash",
			tool_input: { command: "git status" },
			cwd: ROOT,
		});
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

const bash = (command: string) => ({
	tool_name: "Bash",
	tool_input: { command },
	cwd: ROOT,
});

/**
 * ui-promises A28 — an agent's Bash command that writes an app's
 * `approved.json` is refused, naming the cockpit's Approve. The guard is a
 * tripwire against an agent's ordinary attempt, read from the command's text;
 * reading the record stays the agent's.
 */
describe("A28 — a Bash command that writes approved.json is refused, naming the cockpit's Approve", () => {
	const writes: Array<[string, string]> = [
		["a redirect", `echo '{"approvals":[]}' > ${RECORD}`],
		["an appending redirect", `printf '%s' "$entry" >> ${RECORD}`],
		["tee", `printf '{}' | tee .indusk/mockups/admin/approved.json`],
		["sed -i", `sed -i '' 's/0000/3293/' ${RECORD}`],
		["cp onto it", `cp /tmp/forged.json ${RECORD}`],
		["mv onto it", `mv /tmp/forged.json ${join(ROOT, RECORD)}`],
		["node -e", `node -e "require('fs').writeFileSync('${RECORD}', '{}')"`],
		["git checkout <ref> --", `git checkout main -- ${RECORD}`],
		["after a cd", `cd ${ROOT} && cat /tmp/forged.json > ${RECORD}`],
	];
	for (const [how, command] of writes) {
		it(`refuses ${how}`, async () => {
			const r = await runHook("looks-approval-guard.js", bash(command));
			expect(r.exitCode, `${command}\n${r.stderr}`).toBe(2);
			expect(r.stderr).toMatch(/cockpit/i);
			expect(r.stderr).toMatch(/Approve/);
		});
	}

	it("lets the record be read, diffed, staged and committed", async () => {
		for (const command of [
			`cat ${RECORD}`,
			`jq '.approvals | length' ${RECORD}`,
			`git diff -- ${RECORD}`,
			`git log --oneline -- .indusk/mockups/admin/approved.json`,
			`git add ${RECORD} && git commit -m "looks: approvals"`,
			`grep -c mockupHash ${RECORD}`,
		]) {
			const r = await runHook("looks-approval-guard.js", bash(command));
			expect(r.exitCode, `${command}\n${r.stderr}`).toBe(0);
		}
	});
});

/**
 * ui-promises A29 (the hook's half) — a Bash command that names the approve
 * route is refused: the route is the person's, pressed in their browser.
 */
describe("A29 — a Bash command naming the approve route is refused", () => {
	it("refuses a curl to /api/looks/<app>/approve", async () => {
		const r = await runHook(
			"looks-approval-guard.js",
			bash(
				`curl -s -X POST http://127.0.0.1:3939/api/looks/admin/approve -H 'Origin: http://127.0.0.1:3939' -H 'content-type: application/json' -d '{"project":"dusk","mockup":"nav.expanded"}'`,
			),
		);
		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toMatch(/cockpit/i);
	});

	it("lets another admin route be called", async () => {
		const r = await runHook(
			"looks-approval-guard.js",
			bash("curl -s http://127.0.0.1:3939/api/health"),
		);
		expect(r.exitCode, r.stderr).toBe(0);
	});
});
