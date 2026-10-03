import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { maintenanceHeadingName, reopenOwner } from "./reopen.js";

/**
 * watch-reopen-collision — A3: a new incident whose Maintenance heading
 * already exists is a collision, refused with nothing written, and the report
 * of the watch run says so and fails.
 *
 * Once the allocator skips ids the owner already names, `watch` cannot produce
 * a collision through the CLI, so A3 is tested where one is decided (the
 * reopen) and where it is reported (`watchReport`). `watchReport` does not
 * exist before Build Phase 1, so it is loaded by dynamic import: a static
 * import would fail this file at load, not on an assertion.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const OWNER = "smoke-owner";
const ID = "i-2026-10-02-chat-keeps-line-breaks";

function project(): { root: string; impl: string } {
	const root = mkdtempSync(join(tmpdir(), "reopen-collision-"));
	roots.push(root);
	mkdirSync(join(root, ".indusk", "planning", OWNER), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
	const impl = join(root, ".indusk", "planning", OWNER, "impl.md");
	writeFileSync(
		impl,
		`---\ntitle: "${OWNER}"\nstatus: in-progress\n---\n\n# ${OWNER}\n\n## Checklist\n\n### Build Phase 1: the feature\n\n- [x] built it\n\n### Build Phase 2: ${maintenanceHeadingName(ID)}\n\n- [ ] written by hand\n`,
	);
	return { root, impl };
}

describe("A3 — an opened incident whose heading exists is a collision", () => {
	it("the reopen refuses it as a collision and writes nothing", () => {
		const { root, impl } = project();
		const before = readFileSync(impl, "utf-8");
		const reopen = (reopenOwner as (...a: unknown[]) => unknown)(
			root,
			OWNER,
			ID,
			"chat-keeps-line-breaks",
			undefined,
			"opened",
		);
		expect(reopen).toMatchObject({ reopened: false, reason: "collision" });
		expect(readFileSync(impl, "utf-8"), "the owner's impl is untouched").toBe(before);
	});

	it("the report of that watch run names the owner and the heading, and exits 1", async () => {
		const mod = (await import("./watch.js")) as Record<string, unknown>;
		expect(typeof mod.watchReport, "watch.ts exports watchReport").toBe("function");
		const heading = maintenanceHeadingName(ID);
		const report = (
			mod.watchReport as (r: unknown) => { out: string[]; err: string[]; exitCode: number }
		)({
			source: "http://localhost:16686",
			changes: [
				{
					id: ID,
					kind: "opened",
					traces: ["4bf92f3577b34da6a3ce929d0e0e4736"],
					promise: "chat-keeps-line-breaks",
					owner: OWNER,
					reopen: { reopened: false, reason: "collision", heading },
				},
			],
		});
		expect(report.exitCode).toBe(1);
		const err = report.err.join("\n");
		expect(err).toContain(OWNER);
		expect(err).toContain(heading);
	});
});
