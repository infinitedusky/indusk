// promise: phase-boundary-record-never-malformed
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBoundaries, recordPhaseStart } from "./boundary.js";
import { trackedRoots } from "./shape.test-support.js";

/**
 * admin-ui-phase-progress — A30 (falsification).
 *
 * `recordPhaseStart` appended whatever it was handed; the record predicate
 * lived in the reader only. One malformed append — this plan's own Build
 * Phase 7 record, written by hand with `phase: {kind, number}` — made every
 * reader (Shape, the dogfood test, the admin's plan page) refuse the entire
 * file. The writer must refuse what its readers would.
 */

const roots = trackedRoots();
const AT = "2026-09-16T00:00:00.000Z";

async function freshRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "boundary-writer-"));
	roots.push(root);
	await recordPhaseStart(root, { plan: "demo", phase: 1, kind: "build", sha: "aaaaaaa", at: AT });
	return root;
}

describe("A30 — the boundary writer refuses what its readers refuse", () => {
	it("a phase that is not a finite number is refused naming the field, and nothing is appended", async () => {
		const root = await freshRoot();
		await expect(
			recordPhaseStart(root, {
				plan: "demo",
				phase: { kind: "build", number: 7 } as never,
				sha: "bbbbbbb",
				at: AT,
			}),
		).rejects.toThrow(/phase/);
		const records = await readBoundaries(root);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ plan: "demo", phase: 1, sha: "aaaaaaa" });
	});

	it("an unknown kind is refused the same way", async () => {
		const root = await freshRoot();
		await expect(
			recordPhaseStart(root, {
				plan: "demo",
				phase: 2,
				kind: "nope" as never,
				sha: "ccccccc",
				at: AT,
			}),
		).rejects.toThrow(/kind/);
		expect(await readBoundaries(root)).toHaveLength(1);
	});

	it("an empty plan or sha is refused", async () => {
		const root = await freshRoot();
		await expect(
			recordPhaseStart(root, { plan: "", phase: 2, sha: "ccccccc", at: AT }),
		).rejects.toThrow(/plan/);
		await expect(
			recordPhaseStart(root, { plan: "demo", phase: 2, sha: "", at: AT }),
		).rejects.toThrow(/sha/);
		expect(await readBoundaries(root)).toHaveLength(1);
	});

	it("a well-formed record still appends", async () => {
		const root = await freshRoot();
		await recordPhaseStart(root, { plan: "demo", phase: 2, kind: "test", sha: "ddddddd", at: AT });
		expect(await readBoundaries(root)).toHaveLength(2);
	});
});
