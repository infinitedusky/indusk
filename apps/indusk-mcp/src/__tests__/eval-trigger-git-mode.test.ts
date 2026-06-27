import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 2 collapse — `eval-trigger.js` is git-only as of 1.31.0
 * (`git-only-substrate` Phase 2). The trigger regex narrowed from
 * `/\b(jj describe|git commit)\b/` to `/\bgit commit\b/`. The skip
 * message no longer names `jj describe`. Change ID extraction goes
 * straight to git (no jj-first-then-fallback).
 *
 * History: T11 + T12 (git-or-jj-substrate Phase 6) originally pinned
 * the dual-SCM shape — kept here as updated assertions for the git-
 * only shape that replaced it.
 *
 * Source-level tests are sufficient — the hook is a single short script
 * and the patterns we want to enforce are textual.
 */

const HOOK_PATH = resolve(__dirname, "../../hooks/eval-trigger.js");

describe("eval-trigger.js — git-only trigger filter (T8)", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	it("matches `git commit` in the trigger filter", () => {
		expect(source).toMatch(/git commit/);
	});

	it("does NOT match `jj describe` (or any `jj` subcommand) in the trigger filter regex", () => {
		// The TRIGGER_RE literal in source must contain `git commit` and NOT
		// `jj describe`. Search the specific TRIGGER_RE line/block to avoid
		// false-positives from comment prose elsewhere.
		const triggerLine = source
			.split("\n")
			.find((l) => l.includes("TRIGGER_RE =") && l.includes("git commit"));
		expect(triggerLine, "TRIGGER_RE assignment line should exist").toBeDefined();
		expect(triggerLine).not.toMatch(/jj describe/);
	});

	it("the skip log message names ONLY git commit (no jj reference)", () => {
		// Find the syslog line for the trigger-filter skip path (the one that
		// fires when TRIGGER_RE doesn't match). It names "no git commit" after
		// the Phase 2 collapse; pre-Phase-2 it named both `jj describe` and
		// `git commit`.
		const syslogSkipLine = source
			.split("\n")
			.find((l) => l.includes("syslog") && l.includes("no git commit"));
		expect(syslogSkipLine, "trigger-filter skip syslog line should exist").toBeDefined();
		expect(syslogSkipLine).not.toMatch(/jj describe/);
	});
});

describe("eval-trigger.js — change ID extraction is git-only (T8 supporting)", () => {
	const source = readFileSync(HOOK_PATH, "utf-8");

	it("invokes `git rev-parse` (git is the only SCM)", () => {
		expect(source).toMatch(/git rev-parse/);
	});

	it("does NOT invoke `jj log` for change-ID extraction (jj is gone)", () => {
		// jj-first-then-fallback is collapsed to git-only. The jj log path is
		// gone entirely. Allow `jj` to appear in comment prose; assert no
		// `jj log` shell-out remains.
		expect(source).not.toMatch(/jj log -r/);
	});
});
