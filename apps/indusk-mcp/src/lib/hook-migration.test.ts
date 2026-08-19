import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEGACY_HOOKS, removeLegacyHooks } from "./hook-migration.js";

/**
 * Both halves of a hook retirement have to go, and they fail differently: an
 * orphaned file is dead weight that still runs, an orphaned registration makes
 * Claude Code invoke a missing script on every matching tool call. Removing
 * only one is worse than removing neither, because it looks handled.
 */

describe("legacy hook removal", () => {
	let root: string;

	const settingsWith = (commands: string[]) => ({
		hooks: {
			PreToolUse: [
				{
					matcher: "Edit|Write",
					hooks: commands.map((c) => ({ type: "command", command: `node .claude/hooks/${c}` })),
				},
			],
		},
	});

	function writeSettings(obj: unknown): void {
		writeFileSync(join(root, ".claude/settings.json"), JSON.stringify(obj, null, "\t"));
	}
	function readSettings(): { hooks?: Record<string, { hooks?: { command?: string }[] }[]> } {
		return JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf-8"));
	}

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "hook-migration-"));
		mkdirSync(join(root, ".claude/hooks"), { recursive: true });
	});

	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it("deletes the retired hook file", () => {
		writeFileSync(join(root, ".claude/hooks/check-plan-order.js"), "// dead\n");
		writeSettings(settingsWith(["check-gates.js"]));

		const r = removeLegacyHooks(root);
		expect(r.filesRemoved).toContain("check-plan-order.js");
		expect(existsSync(join(root, ".claude/hooks/check-plan-order.js"))).toBe(false);
	});

	it("removes the registration, leaving its siblings intact", () => {
		writeSettings(settingsWith(["check-gates.js", "check-plan-order.js", "claude-md-budget.js"]));

		const r = removeLegacyHooks(root);
		expect(r.registrationsRemoved).toContain("check-plan-order.js");

		const cmds = readSettings().hooks?.PreToolUse?.[0]?.hooks?.map((h) => h.command ?? "") ?? [];
		expect(cmds.some((c) => c.includes("check-plan-order"))).toBe(false);
		expect(cmds.some((c) => c.includes("check-gates"))).toBe(true);
		expect(cmds.some((c) => c.includes("claude-md-budget"))).toBe(true);
	});

	it("drops a matcher entry whose hooks all went away", () => {
		// An entry with an empty hooks array still matches tool calls and runs
		// nothing — worse than absent, because it looks configured.
		writeSettings(settingsWith(["check-plan-order.js"]));

		removeLegacyHooks(root);
		expect(readSettings().hooks?.PreToolUse).toBeUndefined();
	});

	it("removes the registration even when the file is already gone", () => {
		// The half-done state: someone deleted the file by hand months ago and
		// Claude Code has been invoking a missing script ever since.
		writeSettings(settingsWith(["check-gates.js", "check-plan-order.js"]));

		const r = removeLegacyHooks(root);
		expect(r.filesRemoved).toEqual([]);
		expect(r.registrationsRemoved).toContain("check-plan-order.js");
	});

	it("leaves a project with no legacy hooks completely untouched", () => {
		const before = settingsWith(["check-gates.js", "claude-md-budget.js"]);
		writeSettings(before);

		const r = removeLegacyHooks(root);
		expect(r.filesRemoved).toEqual([]);
		expect(r.registrationsRemoved).toEqual([]);
		expect(readSettings()).toEqual(before);
	});

	it("absent state is not an error — no settings, no hooks dir, bad JSON", () => {
		rmSync(join(root, ".claude/hooks"), { recursive: true, force: true });
		expect(() => removeLegacyHooks(root)).not.toThrow();

		mkdirSync(join(root, ".claude/hooks"), { recursive: true });
		writeFileSync(join(root, ".claude/settings.json"), "{ not json");
		expect(() => removeLegacyHooks(root)).not.toThrow();
	});

	it("check-plan-order.js is on the list — the retirement this closes", () => {
		expect(LEGACY_HOOKS).toContain("check-plan-order.js");
	});
});
