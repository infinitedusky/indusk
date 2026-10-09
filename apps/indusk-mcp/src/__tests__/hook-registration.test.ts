import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	ensureHookRegistered,
	type HookSettings,
	hookCommand,
	hookFileOf,
	hookRegistered,
} from "../lib/hook-command.js";

/**
 * trunk-guard cleanup — A11.
 *
 * One way to register a hook. Five sites hand-rolled "is this command in that
 * matcher's group; if not, add it" and the fifth's bug (a duplicate group) hid
 * in the fourth's shadow. The helper holds the four shapes here; A5 and
 * hook-cwd-independence hold behaviour parity for init and update.
 */

const cmd = (file: string) => ({ type: "command", command: hookCommand(file) });

describe("A11 — ensureHookRegistered", () => {
	it("adds the hook to an existing group with that matcher — never a second group", () => {
		const settings: HookSettings = {
			hooks: { PreToolUse: [{ matcher: "Edit|Write", hooks: [cmd("check-gates.js")] }] },
		};
		expect(ensureHookRegistered(settings, "PreToolUse", "Edit|Write", "trunk-guard.js")).toBe(true);
		const groups = settings.hooks?.PreToolUse ?? [];
		expect(groups).toHaveLength(1);
		expect(groups[0].hooks?.map((h) => h.command)).toEqual([
			hookCommand("check-gates.js"),
			hookCommand("trunk-guard.js"),
		]);
	});

	it("creates the group when no group has that matcher, and the event key when absent", () => {
		const settings: HookSettings = {};
		expect(ensureHookRegistered(settings, "PreToolUse", "Bash", "trunk-guard.js")).toBe(true);
		expect(settings.hooks?.PreToolUse).toEqual([
			{ matcher: "Bash", hooks: [cmd("trunk-guard.js")] },
		]);
	});

	it("returns false and changes nothing when a command naming the file is already in the group", () => {
		const settings: HookSettings = {
			hooks: { PreToolUse: [{ matcher: "Bash", hooks: [cmd("trunk-guard.js")] }] },
		};
		const before = JSON.stringify(settings);
		expect(ensureHookRegistered(settings, "PreToolUse", "Bash", "trunk-guard.js")).toBe(false);
		expect(JSON.stringify(settings)).toBe(before);
	});

	it("treats a customised command that still names the file as present", () => {
		const settings: HookSettings = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "node .claude/hooks/eval-trigger.js --quiet" }],
					},
				],
			},
		};
		expect(hookRegistered(settings, "PostToolUse", "Bash", "eval-trigger.js")).toBe(true);
		expect(ensureHookRegistered(settings, "PostToolUse", "Bash", "eval-trigger.js")).toBe(false);
	});

	it("the same file under another matcher is not presence — half a gate is not a gate", () => {
		const settings: HookSettings = {
			hooks: { PreToolUse: [{ matcher: "Edit|Write", hooks: [cmd("trunk-guard.js")] }] },
		};
		expect(hookRegistered(settings, "PreToolUse", "Bash", "trunk-guard.js")).toBe(false);
		expect(ensureHookRegistered(settings, "PreToolUse", "Bash", "trunk-guard.js")).toBe(true);
		expect(settings.hooks?.PreToolUse).toHaveLength(2);
	});

	it("is idempotent across repeated calls for several hooks", () => {
		const settings: HookSettings = {};
		for (const round of [1, 2]) {
			for (const file of ["check-gates.js", "claude-md-budget.js", "trunk-guard.js"]) {
				const changed = ensureHookRegistered(settings, "PreToolUse", "Edit|Write", file);
				expect(changed, `${file} round ${round}`).toBe(round === 1);
			}
		}
		expect(settings.hooks?.PreToolUse).toHaveLength(1);
		expect(settings.hooks?.PreToolUse?.[0].hooks).toHaveLength(3);
	});
});

describe("A11 — hookFileOf reads the file a registered command runs", () => {
	it.each([
		[hookCommand("trunk-guard.js"), "trunk-guard.js"],
		["node .claude/hooks/eval-trigger.js", "eval-trigger.js"],
		["node .claude/hooks/eval-trigger.js --quiet", "eval-trigger.js"],
		["npx something-else", null],
	])("%s → %s", (command, file) => {
		expect(hookFileOf(command)).toBe(file);
	});
});

/**
 * small-fixes A24 (cleanup): which hooks a project registers is one table.
 * `init` and `update` each kept a list; adding the stash guard meant editing
 * both, as the hooks CLAUDE.md said to. Both now read `HOOK_REGISTRATIONS`.
 *
 * promise: one-definition-per-shared-rule
 */
describe("A24 — init and update register hooks from one table", () => {
	const SRC = new URL("../", import.meta.url).pathname;
	const HOOKS = new URL("../../hooks/", import.meta.url).pathname;
	const registered = readdirSync(HOOKS)
		.filter((f) => f.endsWith(".js") && !f.startsWith("_"))
		.sort();

	it("the table names every registered hook in the package, under an event and a matcher", async () => {
		const mod = (await import("../lib/hook-command.js")) as Record<string, unknown>;
		const table = mod.HOOK_REGISTRATIONS as [string, string, string][] | undefined;
		expect(table, "lib/hook-command.ts exports HOOK_REGISTRATIONS").toBeDefined();
		expect([...new Set((table ?? []).map(([, , file]) => file))].sort()).toEqual(registered);
		for (const [event, matcher] of table ?? []) {
			expect(["PreToolUse", "PostToolUse", "UserPromptSubmit"]).toContain(event);
			// A prompt hook takes no matcher (incident-recording); a tool hook names one.
			expect(matcher).toMatch(event === "UserPromptSubmit" ? /^$/ : /^(Edit\|Write|Bash)$/);
		}
	});

	it("neither init.ts nor update.ts names a hook file of its own", () => {
		for (const rel of ["bin/commands/init.ts", "bin/commands/update.ts"]) {
			const source = readFileSync(join(SRC, rel), "utf-8");
			const named = registered.filter((f) => source.includes(`"${f}"`));
			expect(named, `${rel} names hooks outside the table`).toEqual([]);
		}
	});
});
