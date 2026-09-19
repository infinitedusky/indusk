import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { reopenOwner } from "../lib/promises/reopen.js";
import { REPO_ROOT } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";

/**
 * day-monitor, ADR D7: the Maintenance phase `watch` appends passes the impl
 * structure validator — the real hook, over real archived impls from this
 * repository: one written before test phases existed (the owner of
 * `every-commit-evaluated`) and one written with them.
 */

const OWNERS = [
	{ plan: "semantic-graph-eval", shape: "legacy (### Phase N)" },
	{ plan: "admin-ui-hosting", shape: "a trajectory, before test phases" },
	{ plan: "admin-plan-worktrees", shape: "test phases" },
];

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function validate(root: string, implPath: string) {
	return runHook("validate-impl-structure.js", {
		tool_name: "Write",
		tool_input: { file_path: implPath, content: readFileSync(implPath, "utf-8") },
		cwd: root,
	});
}

/** This repository's OTel role (`library`), under which its archived impls were written. */
function libraryConfig(root: string): void {
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
}

describe.each(OWNERS)("a Maintenance phase appended to $plan ($shape)", ({ plan }) => {
	it("passes the validator before and after, and is numbered after the owner's build phases", async () => {
		const root = mkdtempSync(join(tmpdir(), "reopen-validator-"));
		roots.push(root);
		const dir = join(root, ".indusk", "planning", "archive", plan);
		mkdirSync(dir, { recursive: true });
		cpSync(
			join(REPO_ROOT, ".indusk", "planning", "archive", plan, "impl.md"),
			join(dir, "impl.md"),
		);
		const implPath = join(dir, "impl.md");
		libraryConfig(root);

		const before = await validate(root, implPath);
		expect(before.exitCode, `the archived impl validates as it stands:\n${before.stderr}`).toBe(0);

		const result = reopenOwner(
			root,
			plan,
			"i-2026-09-19-every-commit-evaluated",
			"every-commit-evaluated",
		);
		expect(result.reopened).toBe(true);
		const text = readFileSync(implPath, "utf-8");
		expect(text).toContain("Maintenance — i-2026-09-19-every-commit-evaluated");

		const after = await validate(root, implPath);
		expect(after.exitCode, after.stderr).toBe(0);

		// A second pass appends nothing.
		expect(
			reopenOwner(root, plan, "i-2026-09-19-every-commit-evaluated", "every-commit-evaluated"),
		).toEqual({
			reopened: false,
			reason: "already",
		});
		expect(readFileSync(implPath, "utf-8")).toBe(text);
	});
});

const SERVICE_IMPL = `---
title: seats
status: completed
---

# seats

## Checklist

### Phase 1: Seats

- [x] Hold a seat atomically

#### Phase 1 Verification

- [x] The seat tests pass

#### Phase 1 OTel

- [x] The hold marks its promise

#### Phase 1 Context

- [x] Noted

#### Phase 1 Document

- [x] The seats page
`;

describe("a Maintenance phase in a project whose otel.role asks for the OTel gate", () => {
	it("carries an OTel gate, so the validator accepts it", async () => {
		const root = mkdtempSync(join(tmpdir(), "reopen-validator-service-"));
		roots.push(root);
		const dir = join(root, ".indusk", "planning", "archive", "seats");
		mkdirSync(dir, { recursive: true });
		const implPath = join(dir, "impl.md");
		writeFileSync(implPath, SERVICE_IMPL);
		expect((await validate(root, implPath)).exitCode).toBe(0);
		reopenOwner(root, "seats", "i-2026-09-19-seat-never-double-booked", "seat-never-double-booked");
		expect(readFileSync(implPath, "utf-8")).toContain("#### Build Phase 2 OTel");
		const after = await validate(root, implPath);
		expect(after.exitCode, after.stderr).toBe(0);
	});
});
