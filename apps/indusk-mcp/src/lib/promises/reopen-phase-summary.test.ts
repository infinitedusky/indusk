import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateWrite } from "../../__tests__/helpers/hook-runner.js";
import { summaryImpl } from "../../__tests__/helpers/phase-summary-fixture.js";
import { reopenOwner } from "./reopen.js";

/**
 * promise: an-impl-phase-explains-itself — A26 of the story-first-phases impl.
 *
 * When a promise breaks, the owner's impl gains a Maintenance phase. If the
 * impl has opted in to phase summaries, that phase is written in the shape too
 * (a paragraph, plain task sentences, the code and row label in the fold), so
 * the next save of the file is not refused by the rule it was written under.
 * An impl that has not opted in keeps the old shape.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const OWNER = "smoke-owner";
const ID = "i-2026-10-02-chat-keeps-line-breaks";

function project(impl: string): { root: string; implPath: string } {
	const root = mkdtempSync(join(tmpdir(), "reopen-phase-summary-"));
	roots.push(root);
	mkdirSync(join(root, ".indusk", "planning", OWNER), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ otel: { role: "library" } }),
	);
	const implPath = join(root, ".indusk", "planning", OWNER, "impl.md");
	writeFileSync(implPath, impl);
	return { root, implPath };
}

describe("A26 — the repair phase a broken promise adds follows the impl's shape", () => {
	it("the control: the impl the phase is added to passes the save check as written", async () => {
		const r = await validateWrite(summaryImpl(OWNER, { status: "in-progress" }));
		expect(r.exitCode, r.stderr).toBe(0);
	});

	it("adds, to an impl that has opted in, a phase the save check accepts", async () => {
		const { root, implPath } = project(summaryImpl(OWNER, { status: "in-progress" }));
		const reopened = reopenOwner(root, OWNER, ID, "chat-keeps-line-breaks", undefined, "opened");
		expect(reopened.reopened).toBe(true);
		const after = readFileSync(implPath, "utf-8");
		expect(after).toContain(`Maintenance — ${ID}`);
		const r = await validateWrite(after);
		expect(r.exitCode, `the impl after the Maintenance phase was added: ${r.stderr}`).toBe(0);
	});

	it("keeps the old shape for an impl that has not opted in", () => {
		const { root, implPath } = project(summaryImpl(OWNER, { status: "in-progress", optIn: false }));
		reopenOwner(root, OWNER, ID, "chat-keeps-line-breaks", undefined, "opened");
		const after = readFileSync(implPath, "utf-8");
		expect(after).toContain(
			`- [ ] Write the root cause in the incident (\`.indusk/promises/incidents/${ID}.md\`)`,
		);
	});
});
