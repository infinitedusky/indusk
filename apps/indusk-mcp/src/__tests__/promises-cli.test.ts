import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * day-promises — A14 and A15, the two rows about projects rather than
 * fixtures: a project that has not adopted is untouched by `update` beyond an
 * empty domains list, and this repository holds three promises with the
 * documented command run verbatim against its root.
 *
 * `init` and `update` write the admin registry; `runCli` pins `INDUSK_HOME`
 * to a temp dir so nothing here touches the developer's `~/.indusk/`.
 */

describe.skipIf(SHOULD_SKIP)("A14 — update ensures promises.domains and nothing else", () => {
	it("writes promises.domains: [] once, idempotently, and runs no check", () => {
		const dir = mkdtempSync(join(tmpdir(), "promises-update-"));
		const init = runCli(dir, ["init", "--local", "--no-index"]);
		expect(init.code, init.stderr).toBe(0);
		const configPath = join(dir, ".indusk", "config.json");

		const first = runCli(dir, ["update"]);
		expect(first.code, first.stderr).toBe(0);
		const afterFirst = readFileSync(configPath, "utf-8");
		expect(JSON.parse(afterFirst).promises).toEqual({ domains: [] });
		expect(first.stdout + first.stderr).not.toMatch(/promises check|no promise registry/i);

		const second = runCli(dir, ["update"]);
		expect(second.code, second.stderr).toBe(0);
		expect(readFileSync(configPath, "utf-8")).toBe(afterFirst);
	});

	it("a project with a block already set is left alone", () => {
		const dir = mkdtempSync(join(tmpdir(), "promises-update-set-"));
		expect(runCli(dir, ["init", "--local", "--no-index"]).code).toBe(0);
		const configPath = join(dir, ".indusk", "config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		config.promises = { domains: ["seating"] };
		writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);

		expect(runCli(dir, ["update"]).code).toBe(0);
		expect(JSON.parse(readFileSync(configPath, "utf-8")).promises).toEqual({
			domains: ["seating"],
		});
	});
});

describe.skipIf(SHOULD_SKIP)("A15 — this repository holds three promises, one per kind", () => {
	it("indusk promises check at the repo root exits 0 with one promise of each kind", () => {
		const r = runCli(REPO_ROOT, ["promises", "check"]);
		expect(r.code, r.stderr).toBe(0);
		expect(r.stdout).toMatch(/3 promises/);
		expect(r.stdout).toMatch(/behaviour 1/);
		expect(r.stdout).toMatch(/state 1/);
		expect(r.stdout).toMatch(/structure 1/);
		expect(r.stdout).toMatch(/enforced 3/);
	});
});
