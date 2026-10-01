import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	clearPendingRelease,
	describeWaitingRelease,
	isNewerVersion,
	readPendingRelease,
	recordPendingRelease,
	registryHasVersion,
} from "./pending-release.js";

let home: string;
const saved = { home: process.env.INDUSK_HOME, path: process.env.PATH };
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "pending-release-"));
	process.env.INDUSK_HOME = home;
});
afterEach(() => {
	process.env.INDUSK_HOME = saved.home;
	process.env.PATH = saved.path;
	rmSync(home, { recursive: true, force: true });
});

/** A stub `npm` on PATH that prints `stdout` and `stderr` and exits `code`. */
function stubNpm(stdout: string, stderr: string, code: number): void {
	const bin = join(home, "bin");
	mkdirSync(bin, { recursive: true });
	writeFileSync(
		join(bin, "npm"),
		`#!/bin/sh\nprintf '%s' '${stdout}'\nprintf '%s' '${stderr}' >&2\nexit ${code}\n`,
	);
	chmodSync(join(bin, "npm"), 0o755);
	process.env.PATH = `${bin}:${saved.path}`;
}

const release = { name: "@x/p", version: "1.55.0", uploadedAt: "2026-10-01T17:52:04.000Z" };

describe("the pending-release record", () => {
	it("round-trips, and clears", () => {
		recordPendingRelease(release);
		expect(readPendingRelease()).toEqual(release);
		clearPendingRelease();
		expect(readPendingRelease()).toBeNull();
	});

	it("reads a malformed record as none", () => {
		writeFileSync(join(home, "pending-release.json"), "{ not json");
		expect(readPendingRelease()).toBeNull();
	});
});

describe("asking npm whether a version is live", () => {
	it("is live when npm prints the version", () => {
		stubNpm("1.55.0", "", 0);
		expect(registryHasVersion("@x/p", "1.55.0")).toEqual({ state: "live" });
	});

	it("is absent on npm's 404 — the publish-time scan, or never uploaded", () => {
		stubNpm("", 'npm warn Unknown env config "npm-globalconfig".\nnpm error code E404\n', 1);
		expect(registryHasVersion("@x/p", "1.55.0")).toEqual({ state: "absent" });
	});

	it("names npm's error line, not the warning before it, when it cannot answer", () => {
		stubNpm("", 'npm warn Unknown env config "npm-globalconfig".\nnpm error code ETIMEDOUT\n', 1);
		const answer = registryHasVersion("@x/p", "1.55.0");
		expect(answer).toEqual({ state: "unknown", reason: "npm error code ETIMEDOUT" });
	});
});

describe("what upgrade says while it waits", () => {
	const at = (min: number) => new Date(Date.parse(release.uploadedAt) + min * 60_000);

	it("names the expected version and the minutes since upload — never the installed one", () => {
		const msg = describeWaitingRelease(release, { state: "absent" }, at(4));
		expect(msg).toContain("v1.55.0 was uploaded 4 min ago");
		expect(msg).toContain("malware scan");
		expect(msg).not.toMatch(/already/);
	});

	it("says overdue past npm's range", () => {
		expect(describeWaitingRelease(release, { state: "absent" }, at(34))).toMatch(
			/longer than npm's stated range/,
		);
	});
});

describe("version order", () => {
	it("compares numerically, so upgrade never downgrades", () => {
		expect(isNewerVersion("1.55.0", "1.54.0")).toBe(true);
		expect(isNewerVersion("1.10.0", "1.9.9")).toBe(true);
		expect(isNewerVersion("1.54.0", "1.55.0")).toBe(false);
		expect(isNewerVersion("1.55.0", "1.55.0")).toBe(false);
	});
});
