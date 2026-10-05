import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * day-always-on-deploy — A16: a record write the disk cuts short never
 * replaces the record (Build Phase 4, falsification).
 *
 * `write(2)` on a nearly full volume returns a short count rather than an
 * error. `writeFileDurably` called `writeSync` once and ignored the count, so
 * a truncated temp file was fsynced and renamed over the good record — the
 * 1.58.2 failure (a record that does not parse, and every pass after refuses
 * to announce) reached from a full disk instead of a restart. A write that
 * throws (ENOSPC) kept the old record but left its temp file on the volume.
 *
 * The disk is simulated at `node:fs`'s `writeSync`, the one call between the
 * function and the kernel: a short count is what the kernel returns, and no
 * test can fill a real volume to within a few bytes on purpose.
 */

const disk = vi.hoisted(() => ({ mode: "normal" as "normal" | "short" | "full" }));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	const writeSync = ((fd: number, data: string | NodeJS.ArrayBufferView, ...rest: unknown[]) => {
		if (disk.mode === "full") {
			throw Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC" });
		}
		const buf =
			typeof data === "string"
				? Buffer.from(data)
				: Buffer.from(data.buffer, data.byteOffset, data.byteLength);
		const offset = typeof data === "string" ? 0 : ((rest[0] as number | undefined) ?? 0);
		const length =
			typeof data === "string"
				? buf.length
				: ((rest[1] as number | undefined) ?? buf.length - offset);
		// Seven bytes per call: what a volume with almost no room left gives.
		const allowed = disk.mode === "short" ? Math.min(7, length) : length;
		return actual.writeSync(fd, buf, offset, allowed);
	}) as typeof actual.writeSync;
	return { ...actual, writeSync, default: { ...actual, writeSync } };
});

const { writeFileDurably } = await import("../lib/always-on/durable-write.js");

const OLD = JSON.stringify({ spans: ["already-announced"] });
const NEW = JSON.stringify({ spans: ["already-announced", "and-one-more-violation"] }, null, 1);

let dir: string;

afterEach(() => {
	disk.mode = "normal";
	if (dir) rmSync(dir, { recursive: true, force: true });
});

function volumeWithRecord(): string {
	dir = mkdtempSync(join(tmpdir(), "durable-write-"));
	const path = join(dir, "announced.json");
	writeFileSync(path, OLD);
	return path;
}

describe("A16 — a record write the disk cuts short", () => {
	it("a short write is carried on until every byte is down: the record is whole", () => {
		const path = volumeWithRecord();
		disk.mode = "short";
		writeFileDurably(path, NEW);
		disk.mode = "normal";
		expect(readFileSync(path, "utf-8")).toBe(NEW);
		expect(() => JSON.parse(readFileSync(path, "utf-8"))).not.toThrow();
	});

	it("a write that fails keeps the old record and leaves no temp file", () => {
		const path = volumeWithRecord();
		disk.mode = "full";
		expect(() => writeFileDurably(path, NEW)).toThrow(/ENOSPC/);
		disk.mode = "normal";
		expect(readFileSync(path, "utf-8")).toBe(OLD);
		expect(readdirSync(dir)).toEqual(["announced.json"]);
	});
});
