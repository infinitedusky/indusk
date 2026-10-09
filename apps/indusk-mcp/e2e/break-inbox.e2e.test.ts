import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bookkeepingRoots } from "../src/lib/bookkeeping/roots.js";

/**
 * incident-recording A19 — promise: a-break-reaches-the-working-agent.
 *
 * The unit test (A18) proves the hook prints the right envelope; this asks
 * the thing we do not own: does Claude Code deliver a `UserPromptSubmit`
 * hook's `additionalContext` to the model on that prompt? A scratch project
 * registers the package's hook, its home's inbox holds one break, and a
 * headless session asked what is next must name the incident — which it can
 * only know from the hook.
 *
 * Needs the `claude` CLI on PATH; run with `pnpm e2e`.
 */

const HOOK = join(new URL("../hooks/", import.meta.url).pathname, "break-inbox.js");
const INCIDENT = "i-2026-10-08-seat-released-QX7";

function claudeOnPath(): boolean {
	return spawnSync("claude", ["--version"], { encoding: "utf-8" }).status === 0;
}

const made: string[] = [];
afterAll(() => {
	for (const d of made) rmSync(d, { recursive: true, force: true });
});

function scratch(): { root: string; home: string; settings: string } {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "break-inbox-e2e-")));
	const home = realpathSync(mkdtempSync(join(tmpdir(), "break-inbox-e2e-home-")));
	made.push(root, home);
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), '{ "mode": "local" }\n');
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: root });
	const dir = bookkeepingRoots(root, home).home;
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "inbox.jsonl"),
		`${JSON.stringify({
			id: "e1",
			at: "2026-10-08T20:00:05Z",
			kind: "break",
			promise: "seat-released",
			incident: INCIDENT,
			owner: "seat-holds",
			phase: `Maintenance — ${INCIDENT}`,
		})}\n`,
	);
	const settings = join(home, "settings.json");
	writeFileSync(
		settings,
		JSON.stringify({
			hooks: {
				UserPromptSubmit: [{ hooks: [{ type: "command", command: `node "${HOOK}"` }] }],
			},
		}),
	);
	return { root, home, settings };
}

describe.skipIf(!claudeOnPath())(
	"A19 — a break reaches a running session on its next prompt",
	() => {
		it("a session asked what is next names the incident the hook delivered", () => {
			const { root, home, settings } = scratch();
			const r = spawnSync(
				"claude",
				[
					"-p",
					"Without using any tools, say the most urgent thing to work on in this project right now, in one line, naming any incident id you have been told about.",
					"--settings",
					settings,
					"--output-format",
					"text",
					"--max-turns",
					"6",
				],
				{
					cwd: root,
					encoding: "utf-8",
					timeout: 170_000,
					env: { ...process.env, INDUSK_HOME: home },
				},
			);
			expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
			expect(r.stdout).toContain(INCIDENT);
		}, 180_000);
	},
);
