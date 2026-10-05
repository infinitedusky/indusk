import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";

/**
 * test-kinds A18 — an impl that opts in with `test_kinds: required` names a
 * kind for every trajectory row, one of the five: unit, contract, live check,
 * smoke, promise. The kind says when the test runs; a row without one, or with
 * a word that is not a kind, leaves that unsaid. Driven through the real hook,
 * over this plan's own impl.
 */

const KINDS = /unit.*contract.*live check.*smoke.*promise/s;
const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/**
 * This plan's impl — opted in, with a Kind column — with every row's kind set
 * to `kind`, or the Kind column removed when null.
 */
function implWith(kind: string | null): string {
	const src = readFileSync(
		join(REPO_ROOT, ".indusk", "planning", "test-kinds", "impl.md"),
		"utf-8",
	);
	expect(src, "the impl opts in").toMatch(/^test_kinds: required$/m);
	const dropLast = (line: string) => line.replace(/[^|]*\|$/, "");
	return src
		.split("\n")
		.map((line) => {
			const isTrajectory =
				/^\| ID \| Asserts \|/.test(line) || line.startsWith("|----|") || /^\| A\d+ \|/.test(line);
			if (!isTrajectory) return line;
			if (kind === null) return dropLast(line);
			return /^\| A\d+ \|/.test(line) ? `${dropLast(line)} ${kind} |` : line;
		})
		.join("\n");
}

async function validate(content: string) {
	const root = mkdtempSync(join(tmpdir(), "test-kinds-validation-"));
	roots.push(root);
	const dir = join(root, ".indusk", "planning", "test-kinds");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
	const path = join(dir, "impl.md");
	writeFileSync(path, content);
	return runHook("validate-impl-structure.js", {
		tool_name: "Write",
		tool_input: { file_path: path, content },
		cwd: root,
	});
}

describe("test-kinds A18 — every row names one of the five kinds", () => {
	it("accepts rows whose kind is one of the five", async () => {
		const r = await validate(implWith("unit"));
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("refuses a row whose kind is not one of the five, naming them", async () => {
		const r = await validate(implWith("example"));
		expect(r.exitCode, "a style word is not a kind").not.toBe(0);
		expect(r.stderr).toMatch(KINDS);
	});

	it("refuses an opted-in impl whose trajectory has no Kind column, naming the five", async () => {
		const r = await validate(implWith(null));
		expect(r.exitCode, "test_kinds: required with no kinds").not.toBe(0);
		expect(r.stderr).toMatch(KINDS);
	});
});
