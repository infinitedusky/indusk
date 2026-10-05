import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * test-kinds A20 — no package's test run is replayed from turbo's cache.
 *
 * turbo keys a cached task on its own package's files. The never-wait guard
 * lives in mcp and reads the admin's tests, so a change touching only an
 * admin test left mcp's cache valid: turbo replayed mcp's last green and the
 * guard never ran. The same replay made a cached root run take seconds and
 * mark `everyday-suite-stays-fast` upheld. A test run is a question asked now.
 * Asked of turbo itself (`--dry=json`), not of turbo.json's text, so a
 * package-level override is seen too.
 */

describe("test-kinds A20 — test runs are never replayed", () => {
	it("every package's test task resolves with the cache off", () => {
		const dry = JSON.parse(
			execFileSync(
				join(REPO_ROOT, "node_modules", ".bin", "turbo"),
				["run", "test", "--dry=json"],
				{
					cwd: REPO_ROOT,
					encoding: "utf-8",
					stdio: ["ignore", "pipe", "ignore"],
				},
			),
		) as { tasks: Array<{ taskId: string; resolvedTaskDefinition: { cache: boolean } }> };
		const cached = dry.tasks
			.filter((t) => t.taskId.endsWith("#test") && t.resolvedTaskDefinition.cache)
			.map((t) => t.taskId);
		expect(cached, "lesson: a-test-run-is-never-replayed-from-a-cache").toEqual([]);
	});
});
