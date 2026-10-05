import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { reopenOwner } from "../lib/promises/reopen.js";
import { REPO_ROOT } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";

/**
 * promise: an-incident-names-its-tests — planner-promises A13.
 *
 * When a promise breaks, the plan that owns it is reopened: a Maintenance
 * phase and a test row are appended to its impl. The row was written with
 * five cells whatever the table had, so in an impl that requires each row to
 * name its kind the row arrived with an empty cell, and the next edit to that
 * impl was refused by its own validator (found by dry run on 2026-10-05; the
 * exposed plan was test-kinds, which owns `everyday-suite-stays-fast`).
 *
 * A row writer fills every column its table has: the level (the smallest,
 * `unit`, which the phase's author may raise) and what the row is for — the
 * promise that broke.
 */

const INCIDENT = "i-2026-10-05-everyday-suite-stays-fast";
const PROMISE = "everyday-suite-stays-fast";

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function project(plan: string, impl: string): { root: string; implPath: string } {
	const root = mkdtempSync(join(tmpdir(), "reopen-row-complete-"));
	roots.push(root);
	const dir = join(root, ".indusk", "planning", "archive", plan);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
	const implPath = join(dir, "impl.md");
	writeFileSync(implPath, impl);
	return { root, implPath };
}

function validate(root: string, implPath: string) {
	return runHook("validate-impl-structure.js", {
		tool_name: "Write",
		tool_input: { file_path: implPath, content: readFileSync(implPath, "utf-8") },
		cwd: root,
	});
}

/** The cells of the last row of the impl's Test Trajectory, by lower-cased header. */
function lastRow(implPath: string): Record<string, string> {
	const lines = readFileSync(implPath, "utf-8").split("\n");
	const start = lines.findIndex((l) => /^## Test Trajectory/.test(l));
	const table = [];
	for (let i = start + 1; i < lines.length; i++) {
		if (lines[i].trimStart().startsWith("|")) table.push(lines[i]);
		else if (table.length > 0) break;
	}
	const cells = (l: string) =>
		l
			.trim()
			.replace(/^\||\|$/g, "")
			.split("|")
			.map((c) => c.trim());
	const header = cells(table[0]).map((h) => h.toLowerCase());
	const last = cells(table[table.length - 1]);
	return Object.fromEntries(header.map((h, i) => [h, last[i] ?? ""]));
}

const WITH_FOR = `---
title: seats
status: completed
trajectory: required
test_phases: required
---

# seats

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | For |
|----|---------|-------------|-----------|-------|-----|
| T1 | a seat is held once | Test Phase 1 | Build Phase 1 | passing | promise: ${PROMISE} |

## Checklist

### Test Phase 1: Red

- [x] T1 written, red

#### Test Phase 1 Verification

- [x] T1 fails on its own assertion

### Build Phase 1: Seats

- [x] Hold a seat atomically

#### Build Phase 1 Verification

- [x] T1 passes

#### Build Phase 1 Context

- [x] guard: T1 carries the rule

#### Build Phase 1 Document

- [x] The seats page
`;

describe("planner-promises A13 — a reopened plan gets a complete row", () => {
	it("in an impl that requires each row's kind, the appended row has one and the impl still validates", async () => {
		const source = join(REPO_ROOT, ".indusk", "planning", "archive", "test-kinds", "impl.md");
		const { root, implPath } = project("test-kinds", "");
		cpSync(source, implPath);
		expect(
			(await validate(root, implPath)).exitCode,
			"the archived impl validates as it stands",
		).toBe(0);

		expect(reopenOwner(root, "test-kinds", INCIDENT, PROMISE).reopened).toBe(true);

		const row = lastRow(implPath);
		expect(row.kind, "the appended row names its level").toBe("unit");
		const after = await validate(root, implPath);
		expect(
			after.exitCode,
			`lesson: a-row-writer-fills-every-column-its-table-requires\n${after.stderr}`,
		).toBe(0);
	});

	it("in an impl whose rows say what they are for, the appended row names the promise that broke", async () => {
		const { root, implPath } = project("seats", WITH_FOR);
		expect(reopenOwner(root, "seats", INCIDENT, PROMISE).reopened).toBe(true);
		expect(lastRow(implPath).for).toBe(`promise: ${PROMISE}`);
		expect((await validate(root, implPath)).exitCode).toBe(0);
	});
});
