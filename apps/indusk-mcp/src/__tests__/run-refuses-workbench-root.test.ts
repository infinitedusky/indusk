import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../bin/commands/run.js";
import { resolveModel } from "../lib/run/registry.js";
import {
	git,
	headOf,
	oneRepoAtPath,
	type VersionedWorkbench,
	writePlan,
} from "./helpers/versioned-workbench.js";

/**
 * workbench-trust-fixes A4 + A5 — `indusk run` refuses at a versioned
 * workbench root, and is unchanged in a flat repo.
 *
 * The loop takes one root as its whole world. In a workbench that root holds
 * the plan and none of the code, and the only thing that ever stopped the loop
 * there was the commit-cadence guard tripping on "not a git repo" — a
 * coincidence versioned-workbench removed. The refusal must come before the
 * provider-key check, because a refusal about the *tree* should not need a
 * key to be reached; that ordering is also what lets this test run without one.
 *
 * Provider keys are scrubbed for the test's duration so that, before the
 * refusal exists, the loop cannot possibly reach a model: the run stops at
 * "$X is not set" instead. A4 is red today on the message, not on the exit
 * code — which is the point: exit 1 for the wrong reason is not a refusal.
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
});

describe("A4 — a versioned workbench root is refused at the door", () => {
	let wb: VersionedWorkbench;
	beforeEach(() => {
		wb = oneRepoAtPath();
	});
	afterEach(() => wb.cleanup());

	it("exits 1 naming the declared repo dir, with no commit and no eval record", async () => {
		writePlan(wb, "demo", IMPL);
		const headBefore = headOf(wb.root);

		await run(wb.root, "demo", { model: "claude" });

		expect(process.exitCode).toBe(1);
		const message = errors.join("\n");
		expect(message, message).toContain("workbench");
		expect(message, message).toContain("code/alpha");
		expect(message, "stopped on a missing key, not on the tree shape").not.toMatch(/API_KEY/);
		expect(headOf(wb.root), "the loop committed to the workbench").toBe(headBefore);
		expect(existsSync(join(wb.root, ".indusk", "eval"))).toBe(false);
	});
});

describe("A5 — regression guard: a flat repo is not touched by the workbench check", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "run-flat-"));
		mkdirSync(join(root, ".indusk", "planning", "demo"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({ otel: { role: "library" } }),
		);
		writeFileSync(join(root, ".indusk", "planning", "demo", "impl.md"), IMPL);
		writeFileSync(join(root, "README.md"), "flat\n");
		git(root, ["init", "-q", "-b", "main"]);
		git(root, ["add", "-A"]);
		git(root, ["commit", "-q", "-m", "init"]);
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it("gets past the tree check and stops at the provider key, as before", async () => {
		await run(root, "demo", { model: "claude" });
		expect(process.exitCode).toBe(1);
		const message = errors.join("\n");
		expect(message, message).toMatch(/is not set/);
		expect(message, message).not.toContain("workbench");
	});
});
