import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workbenchRestore } from "../bin/commands/workbench.js";
import {
	git,
	makeVersionedWorkbench,
	type VersionedWorkbench,
} from "./helpers/versioned-workbench.js";

/**
 * workbench-trust-fixes A9 — `workbench restore` materializes a repo where
 * everything else looks for it.
 *
 * Health, status, doppler and the update nudge all read a repo at
 * `repoDir(repo)` (the declared `path`, else the name). `restoreOne` clones at
 * `<repos_root>/<name>`. On a workbench declaring a `path`, that is a second
 * copy beside the one that exists, with the trunk linked at the wrong one.
 * Real git, a local bare remote, explicit timeout: nothing here is mocked
 * except `process.exit`, which the command calls on both success and failure.
 */

class Exit extends Error {
	constructor(readonly code: number | string | null | undefined) {
		super(`process.exit(${code})`);
	}
}

function makeBareRemote(tmp: string): string {
	const seed = join(tmp, "seed");
	mkdirSync(seed, { recursive: true });
	git(seed, ["init", "-q", "-b", "main"]);
	git(seed, ["commit", "-q", "--allow-empty", "-m", "seed"]);
	const bare = join(tmp, "remote", "alpha.git");
	mkdirSync(join(tmp, "remote"), { recursive: true });
	git(tmp, ["clone", "-q", "--bare", seed, bare]);
	return bare;
}

function restore(root: string): { code: number | string | null | undefined; out: string } {
	const lines: string[] = [];
	const info = vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => {
		lines.push(a.map(String).join(" "));
	});
	const error = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
		lines.push(a.map(String).join(" "));
	});
	const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number | string | null) => {
		throw new Exit(code);
	}) as never);
	let code: number | string | null | undefined = "(never exited)";
	try {
		workbenchRestore(root, { noIgnoreCheck: true });
	} catch (e) {
		// A crash inside restore is the defect showing itself (today: linkTrunk
		// throws ENOENT because the clone landed at the name and the declared
		// path's parent was never made). Report it as the outcome, not as a
		// broken test.
		code = e instanceof Exit ? e.code : `threw: ${(e as Error).message}`;
	} finally {
		info.mockRestore();
		error.mockRestore();
		exit.mockRestore();
	}
	return { code, out: lines.join("\n") };
}

describe("A9 — restore on a repo declaring `path`", () => {
	let tmp: string;
	let wb: VersionedWorkbench;
	let remote: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "restore-path-"));
		remote = makeBareRemote(tmp);
		wb = makeVersionedWorkbench({
			repos: [{ name: "alpha", path: "code/alpha", remote }],
			layout: "nested",
			shape: "workbench",
			initRepos: false,
		});
	});
	afterEach(() => {
		wb.cleanup();
		rmSync(tmp, { recursive: true, force: true });
	});

	it("absent: clones at the declared path and prints that path", () => {
		const r = restore(wb.root);
		expect(r.code, r.out).toBe(0);
		expect(existsSync(join(wb.root, "code", "alpha", ".git")), r.out).toBe(true);
		expect(existsSync(join(wb.root, "alpha")), `cloned at the name instead:\n${r.out}`).toBe(false);
		expect(r.out).toContain("code/alpha");
	}, 30_000);

	it("present: reports it present, creates nothing beside it, and a second run is a no-op", () => {
		git(wb.root, ["clone", "-q", remote, join(wb.root, "code", "alpha")]);
		const first = restore(wb.root);
		expect(first.code, first.out).toBe(0);
		expect(existsSync(join(wb.root, "alpha")), `made a second copy:\n${first.out}`).toBe(false);
		expect(first.out).toMatch(/alpha — (already )?present/);

		const second = restore(wb.root);
		expect(second.code, second.out).toBe(0);
		expect(existsSync(join(wb.root, "alpha"))).toBe(false);
	}, 30_000);
});
