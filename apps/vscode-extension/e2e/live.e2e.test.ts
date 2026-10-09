import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTests } from "@vscode/test-electron";
import { describe, expect, it } from "vitest";

/**
 * vscode-extension A5, A11, A14 — live checks, run once by hand and recorded
 * in the plan: `INDUSK_LIVE_EDITOR=1`, the demo app running from `indusk demo`
 * in `INDUSK_LIVE_EDITOR_PROJECT` (its fault switch on: `SEAT_HOLDS_FAULT_TOGGLE=1`),
 * and the extension installed into `INDUSK_LIVE_EDITOR_EXTENSIONS`.
 *
 * promise: a-promise-shows-where-it-is-kept
 * promise: a-break-reaches-the-editor
 * promise: a-break-opens-a-fix-in-one-click
 */

const LIVE = process.env.INDUSK_LIVE_EDITOR === "1";
const VSCODE = "/Applications/Visual Studio Code.app/Contents/MacOS/Code";

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
			],
		});
		const r = JSON.parse(readFileSync(out, "utf-8"));
		console.info(`live editor: ${JSON.stringify(r)}`);
		expect(r.a5?.text, "A5 — the promise's marker on its line").toMatch(
			/^a-held-seat-is-released-in-time · /,
		);
		expect(r.a11?.seconds, "A11 — broken within ten seconds").toBeLessThanOrEqual(10);
		expect(r.a14?.terminal, "A14 — the Claude terminal opened").toBe(true);
	}, 300_000);
});
