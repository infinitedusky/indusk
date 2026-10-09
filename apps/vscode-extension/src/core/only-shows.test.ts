import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixAction } from "./fix.js";
import { line } from "./fixture.js";
import { hover } from "./hover.js";
import { markers } from "./markers.js";
import { onLine, onTick, problems, startSession } from "./session.js";

/**
 * vscode-extension A15: the extension writes nothing to the project.
 *
 * promise: the-editor-only-shows
 */

describe("A15 — the editor only shows", () => {
	it("after reading, showing a break and building the fix action, the project's files are exactly as they were", () => {
		const root = mkdtempSync(join(tmpdir(), "only-shows-"));
		const git = (...a: string[]) => spawnSync("git", a, { cwd: root, encoding: "utf-8" });
		writeFileSync(join(root, "telemetry.ts"), "// promise: seats-held\n");
		git("init", "-q");
		git("add", ".");
		git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "start");
		const text = readFileSync(join(root, "telemetry.ts"), "utf-8");

		let s = startSession(5_000);
		s = onLine(s, line(), Date.UTC(2026, 9, 8, 12, 30, 0)).session;
		s = onLine(s, line({ productionState: "red" }), Date.UTC(2026, 9, 8, 12, 30, 5)).session;
		s = onTick(s, Date.UTC(2026, 9, 8, 12, 30, 9));
		markers({ path: "telemetry.ts", text }, s.view);
		hover("seats-held", s.view);
		problems(s);
		fixAction(
			{ promise: "seats-held", source: "production", sourceLabel: "x", statement: "s", tests: [] },
			{ projectRoot: root, claudeOnPath: true },
		);

		expect(git("status", "--porcelain").stdout).toBe("");
	});
});
