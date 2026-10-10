import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTests } from "@vscode/test-electron";
import { describe, expect, it } from "vitest";

/**
 * vscode-extension A5, A11, A14 — live checks, run once by hand and recorded
 * in the plan: `INDUSK_LIVE_EDITOR=1`, the demo app running from `indusk demo`
 * in `INDUSK_LIVE_EDITOR_PROJECT` (its fault switch on: `SEAT_HOLDS_FAULT_TOGGLE=1`),
 * and the extension installed into `INDUSK_LIVE_EDITOR_EXTENSIONS`.
 * `INDUSK_LIVE_EDITOR_COMMAND` names the `indusk` the extension runs, when the
 * one on `PATH` is not the build under test.
 *
 * promise: a-promise-shows-where-it-is-kept
 * promise: a-break-reaches-the-editor
 * promise: a-break-opens-a-fix-in-one-click
 * promise: every-promise-is-listed-in-the-editor
 * promise: the-editor-shows-each-run-as-it-happens
 */

const LIVE = process.env.INDUSK_LIVE_EDITOR === "1";
// `INDUSK_LIVE_EDITOR_APP` runs the same checks in another VS Code build, such as Cursor.
const VSCODE =
	process.env.INDUSK_LIVE_EDITOR_APP ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code";

// display-names A10: `INDUSK_LIVE_A10=1` runs the probe's names check alone, on
// `INDUSK_LIVE_EDITOR_PROJECT` (the dusk project), with no demo app.
const NAMES = process.env.INDUSK_LIVE_A10 === "1";

describe.skipIf(!LIVE)("live — the editor on the demo app", () => {
	it("A5, A11, A14 — the marker, the break within ten seconds, and Fix with Claude", async () => {
		const project = process.env.INDUSK_LIVE_EDITOR_PROJECT as string;
		const extensions = process.env.INDUSK_LIVE_EDITOR_EXTENSIONS as string;
		expect(existsSync(join(project, ".indusk", "config.json")), "the demo project").toBe(true);
		const installed = readdirSync(extensions).find((d) =>
			d.startsWith("infinitedusky.indusk-"),
		) as string;
		const out = join(tmpdir(), `live-editor-${Date.now()}.json`);
		process.env.LIVE_OUT = out;
		// A terminal inside VS Code exports this; the test VS Code would start as Node.
		delete process.env.ELECTRON_RUN_AS_NODE;
		// macOS caps a socket path near 103 characters; a worktree path is longer.
		const userData = mkdtempSync(join(tmpdir(), "live-u-"));
		if (process.env.INDUSK_LIVE_EDITOR_COMMAND) {
			mkdirSync(join(userData, "User"), { recursive: true });
			writeFileSync(
				join(userData, "User", "settings.json"),
				JSON.stringify({ "indusk.command": process.env.INDUSK_LIVE_EDITOR_COMMAND }),
			);
		}
		await runTests({
			vscodeExecutablePath: VSCODE,
			extensionDevelopmentPath: join(extensions, installed),
			extensionTestsPath: join(__dirname, "live-probe.cjs"),
			launchArgs: [
				project,
				"--disable-workspace-trust",
				"--extensions-dir",
				extensions,
				"--disable-extensions",
				"--user-data-dir",
				userData,
			],
		});
		const r = JSON.parse(readFileSync(out, "utf-8"));
		console.info(`live editor: ${JSON.stringify(r)}`);
		if (NAMES) {
			expect(r.a10?.ok, "A10 — the panel read").toBe(true);
			expect(r.a10.titled, "A10 — groups read by plan titles").toBeGreaterThan(0);
			expect(r.a10.dated, "A10 — groups carry their start date").toBeGreaterThan(0);
			expect(r.a10.shipped, "A10 — a shipped plan names its release").toBeGreaterThan(0);
			expect(r.a10.inWords, "A10 — every card and row reads in words").toBe(r.a10.promises);
			return;
		}
		expect(r.a5?.text, "A5 — the promise's marker on its line").toMatch(
			/^a-held-seat-is-released-in-time · /,
		);
		expect(r.a11?.seconds, "A11 — broken within ten seconds").toBeLessThanOrEqual(10);
		expect(r.a14?.terminal, "A14 — the Claude terminal opened").toBe(true);
		expect(
			r.a25,
			"A25 — the panel lists the promise; its telemetry location opens at the token",
		).toMatchObject({
			listed: true,
			opened: "src/telemetry.ts",
		});
		expect(r.a25?.line, "A25 — the cursor on the token's line").toBe(r.a25?.tokenLine);
		expect(r.a28?.held, "A28 — a run that held, in the activity section").toBeTruthy();
		expect(r.a28?.broke, "A28 — a run that broke, in the activity section").toBeTruthy();
	}, 300_000);
});
