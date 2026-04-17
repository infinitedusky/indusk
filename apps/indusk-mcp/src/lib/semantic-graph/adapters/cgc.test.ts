/**
 * Integration tests for the CGC adapter.
 *
 * Runs against real cgc-dusk graph in the indusk-infra container.
 * Self-skips if FalkorDB is not reachable.
 */

import { FalkorDB } from "falkordb";
import { beforeAll, describe, expect, it } from "vitest";

import { CgcAdapter } from "./cgc.js";

const PROJECT_ROOT = "/Users/the_dusky/code/sandbox/dusk";

async function isFalkorReachable(): Promise<boolean> {
	try {
		const db = await FalkorDB.connect({ socket: { host: "localhost", port: 6379 } });
		await db.close();
		return true;
	} catch {
		return false;
	}
}

async function isCgcGraphPopulated(): Promise<boolean> {
	try {
		const db = await FalkorDB.connect({ socket: { host: "localhost", port: 6379 } });
		const graph = db.selectGraph("cgc-dusk");
		const result = await graph.query<{ n: number }>("MATCH (f:File) RETURN count(f) AS n");
		await db.close();
		return (result.data?.[0]?.n ?? 0) > 0;
	} catch {
		return false;
	}
}

const canRun = (await isFalkorReachable()) && (await isCgcGraphPopulated());
const describeIfCgc = canRun ? describe : describe.skip;

describeIfCgc("CGC adapter (integration)", () => {
	let adapter: CgcAdapter;

	beforeAll(() => {
		adapter = new CgcAdapter();
	});

	it("snapshot returns files, functions, classes, and interfaces", async () => {
		const records = await adapter.snapshot(PROJECT_ROOT);

		const files = records.filter((r) => r.kind === "file");
		const functions = records.filter((r) => r.kind === "function");
		const classes = records.filter((r) => r.kind === "class");
		const interfaces = records.filter((r) => r.kind === "interface");

		// Based on CGC counts: 118 files, ~19821 functions, 20 classes, 18 interfaces
		expect(files.length).toBeGreaterThan(50);
		expect(functions.length).toBeGreaterThan(100);
		expect(classes.length).toBeGreaterThan(0);
		expect(interfaces.length).toBeGreaterThan(0);

		// Files should have blob hashes
		const filesWithHash = files.filter((f) => f.metadata?.blob_hash);
		expect(filesWithHash.length).toBeGreaterThan(0);
	});

	it("identify produces stable identities", async () => {
		const records = await adapter.snapshot(PROJECT_ROOT);

		const file = records.find((r) => r.kind === "file");
		const fn = records.find((r) => r.kind === "function");

		expect(file).toBeDefined();
		expect(fn).toBeDefined();

		if (file) {
			const id = adapter.identify(file);
			expect(id).toMatch(/^file::/);
		}
		if (fn) {
			const id = adapter.identify(fn);
			expect(id).toMatch(/^function::/);
			expect(id).toContain("::");
		}
	});

	it("contentFingerprint returns blob hash for files, undefined for symbols", async () => {
		const records = await adapter.snapshot(PROJECT_ROOT);

		const file = records.find((r) => r.kind === "file" && r.metadata?.blob_hash);
		const fn = records.find((r) => r.kind === "function");

		expect(file).toBeDefined();
		if (file) {
			const fp = adapter.contentFingerprint(file);
			expect(fp).toBeDefined();
			expect(fp).toMatch(/^[0-9a-f]{40}$/); // git blob hash
		}

		if (fn) {
			expect(adapter.contentFingerprint(fn)).toBeUndefined();
		}
	});

	it("edges returns internal imports only (no npm, no node: builtins)", async () => {
		await adapter.snapshot(PROJECT_ROOT);
		const edges = adapter.edges();

		expect(edges.length).toBeGreaterThan(0);

		for (const edge of edges) {
			expect(edge.relation).toBe("imports");
			expect(edge.source_identity).toMatch(/^file::/);
			expect(edge.target_identity).toMatch(/^file::/);

			// Target should be a real file path, not an npm package or node: builtin
			const targetPath = edge.target_identity.replace("file::", "");
			expect(targetPath).toMatch(/^\//); // absolute path
			expect(targetPath).not.toContain("node_modules");
		}
	});

	it("edges count is reasonable (not including external deps)", async () => {
		await adapter.snapshot(PROJECT_ROOT);
		const edges = adapter.edges();

		// CGC shows 158 internal imports; after resolution some may not match
		// but we should get a substantial portion
		expect(edges.length).toBeGreaterThan(50);
		expect(edges.length).toBeLessThan(500); // sanity upper bound
	});
});
