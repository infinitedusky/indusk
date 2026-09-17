import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * trunk-guard — A5, A7.
 *
 * A hook that is not registered is not a gate. `init` registers the trunk
 * guard under BOTH PreToolUse matchers (the edit gate and the commit gate),
 * `update` adds them to a project that lacks them and is idempotent, and this
 * repository has them.
 */

const HOOK = "trunk-guard.js";

interface Settings {
	hooks?: { PreToolUse?: { matcher?: string; hooks?: { command?: string }[] }[] };
}

function registrations(settingsPath: string): { edit: boolean; bash: boolean } {
	const s = JSON.parse(readFileSync(settingsPath, "utf-8")) as Settings;
	const pre = s.hooks?.PreToolUse ?? [];
	const has = (matcher: string) =>
		pre.some(
			(e) => e.matcher === matcher && (e.hooks ?? []).some((h) => h.command?.includes(HOOK)),
		);
	return { edit: has("Edit|Write"), bash: has("Bash") };
}

function stripHook(settingsPath: string): void {
	const s = JSON.parse(readFileSync(settingsPath, "utf-8")) as Settings;
	for (const entry of s.hooks?.PreToolUse ?? []) {
		entry.hooks = (entry.hooks ?? []).filter((h) => !h.command?.includes(HOOK));
	}
	if (s.hooks?.PreToolUse) {
		s.hooks.PreToolUse = s.hooks.PreToolUse.filter((e) => (e.hooks ?? []).length > 0);
	}
	writeFileSync(settingsPath, `${JSON.stringify(s, null, 2)}\n`);
}

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "trunk-guard-reg-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe.skipIf(SHOULD_SKIP)(
	"A5 — init registers both matchers; update ensures them, idempotently",
	() => {
		it("init registers the hook under Edit|Write and under Bash", () => {
			const r = runCli(dir, ["init", "--local", "--no-index"]);
			expect(r.code, r.stderr).toBe(0);
			expect(registrations(join(dir, ".claude/settings.json"))).toEqual({ edit: true, bash: true });
		});

		it("update adds both to a project whose settings lack them, and a second update changes nothing", () => {
			expect(runCli(dir, ["init", "--local", "--no-index"]).code).toBe(0);
			const settingsPath = join(dir, ".claude/settings.json");
			stripHook(settingsPath);
			expect(registrations(settingsPath)).toEqual({ edit: false, bash: false });
			const u1 = runCli(dir, ["update"]);
			expect(u1.code, u1.stderr).toBe(0);
			expect(registrations(settingsPath)).toEqual({ edit: true, bash: true });
			const after1 = readFileSync(settingsPath, "utf-8");
			const u2 = runCli(dir, ["update"]);
			expect(u2.code, u2.stderr).toBe(0);
			expect(readFileSync(settingsPath, "utf-8")).toBe(after1);
		});
	},
);

describe("A7 — this repository registers the hook itself", () => {
	it("both matchers, in the hookCommand form", () => {
		const settingsPath = join(REPO_ROOT, ".claude/settings.json");
		expect(registrations(settingsPath)).toEqual({ edit: true, bash: true });
		const raw = readFileSync(settingsPath, "utf-8");
		expect(raw).toContain(`node "\${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/${HOOK}`);
	});
});
