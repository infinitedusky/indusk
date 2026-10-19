// clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs
// promise: a-plan-runs-its-tests-and-what-must-not-break
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { briefText, implText } from "../../__tests__/helpers/plan-fixture.js";
import type { Runner } from "../tests/run-files.js";
import { plansTestsOutcome } from "./plan-tests.js";

const PLAN = "seats-v2";
const ROW_TEST = "apps/a/src/row.test.ts";
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const write = (root: string, path: string, text: string) => {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), text);
};
const git = (root: string, ...args: string[]) =>
	execFileSync("git", args, { cwd: root, stdio: "pipe" });

/** A repo whose plan branch changed a file a package's tests could import. */
function project(): string {
	const root = mkdtempSync(join(tmpdir(), "plan-tests-"));
	dirs.push(root);
	git(root, "init", "-q", "-b", "main");
	git(root, "config", "user.email", "t@t.invalid");
	git(root, "config", "user.name", "T");
	write(root, ".indusk/config.json", JSON.stringify({ verify: { testCommand: "npx vitest run" } }));
	write(root, `.indusk/planning/${PLAN}/brief.md`, briefText(PLAN));
	write(
		root,
		`.indusk/planning/${PLAN}/impl.md`,
		implText(PLAN, { columns: ["Test"], rows: [{ cells: { Test: ROW_TEST } }] }),
	);
	write(root, "apps/a/vitest.config.ts", "export default {};\n");
	write(root, ROW_TEST, "");
	git(root, "add", "-A");
	git(root, "commit", "-qm", "base");
	git(root, "checkout", "-q", "-b", `plan/${PLAN}`);
	write(root, "apps/a/src/x.ts", "export const x = 1;\n");
	git(root, "add", "-A");
	git(root, "commit", "-qm", "change");
	return root;
}

it("T3 running a landing's tests starts no search for the tests the changed files reach", async () => {
	const root = project();
	const calls: string[][] = [];
	const run: Runner = async (_c, args) => {
		calls.push(args);
		return { code: 0, output: "" };
	};
	await plansTestsOutcome(root, { plan: PLAN, scope: { landing: true }, run });
	expect(calls.some((args) => args.includes("related"))).toBe(false);
	expect(calls.flat(), "the row's own file still runs").toContain("src/row.test.ts");
});
