import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../bin/commands/run.js";
import { resolveModel } from "../lib/run/registry.js";
import {
	oneRepoAtPath,
	twoRepos,
	type VersionedWorkbench,
	writePlan,
} from "./helpers/versioned-workbench.js";

/**
 * dawn-workbench-execution — A11, and A5's run half.
 *
 * `indusk run` refuses every workbench at the door (workbench-trust-fixes A4).
 * This plan lifts that for a workbench declaring ONE repo: the command must get
 * past the tree check and stop at the next thing that stops it, which with
 * every provider key scrubbed is the missing key. Two repos still refuse, by
 * name. Same harness as `run-refuses-workbench-root.test.ts`: the command
 * function in-process, provider keys removed for the test's duration, so the
 * outcome is decided by the tree shape and nothing else.
 */

const IMPL = `---
title: "Demo"
status: approved
---

# Demo

## Checklist

### Phase 1: Do

- [ ] do the thing
`;

function scrubProviderKeys(model: string): () => void {
	const envs = resolveModel(model).apiKeyEnvs;
	const saved = envs.map((e) => [e, process.env[e]] as const);
	for (const e of envs) delete process.env[e];
	return () => {
		for (const [e, v] of saved) if (v !== undefined) process.env[e] = v;
	};
}

let restoreKeys: () => void;
let errors: string[];
let exitCodeBefore: number | string | undefined;
let wb: VersionedWorkbench;

beforeEach(() => {
	restoreKeys = scrubProviderKeys("claude");
	errors = [];
	vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		errors.push(args.map(String).join(" "));
	});
	vi.spyOn(console, "info").mockImplementation(() => {});
	exitCodeBefore = process.exitCode;
	process.exitCode = undefined;
});

afterEach(() => {
	vi.restoreAllMocks();
	restoreKeys();
	process.exitCode = exitCodeBefore;
	wb?.cleanup();
});

describe("dawn-workbench-execution — the run command at a workbench root", () => {
	it("A11: a one-repo workbench gets past the tree check and stops at the provider key", async () => {
		wb = oneRepoAtPath("nested");
		writePlan(wb, "demo", IMPL);

		await run(wb.root, "demo", { model: "claude" });

		expect(process.exitCode).toBe(1);
		const message = errors.join("\n");
		expect(message, message).toMatch(/is not set/);
		expect(message, message).not.toContain("workbench");
	});

	it("A5 (run): a two-repo workbench still refuses, naming both repos", async () => {
		wb = twoRepos("nested");
		writePlan(wb, "demo", IMPL);

		await run(wb.root, "demo", { model: "claude" });

		expect(process.exitCode).toBe(1);
		const message = errors.join("\n");
		expect(message, message).toContain("alpha");
		expect(message, message).toContain("beta");
		expect(message, "stopped on a missing key, not on the tree shape").not.toMatch(/is not set/);
	});
});
