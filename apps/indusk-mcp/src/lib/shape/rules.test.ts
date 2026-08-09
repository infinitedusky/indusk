import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { collectCraftRules } from "./rules.js";
import { enableExtension, makeRepo, packageExtension } from "./shape.test-support.js";

/**
 * A8, A11 — where craft standards come from, and where Shape stops.
 *
 * The rules are the enabled extensions' own prose. Core hardcodes none of them:
 * a project sets its standard by choosing extensions, the same way `/cleanup`
 * already delegates "what counts as a cohesive unit". This is the maxim-7
 * argument that kept runner-specific output parsing out of `atdawn verify`.
 */

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe("A11 — rules trace to enabled extensions, not to core", () => {
	it("includes an enabled extension's craft prose", async () => {
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);
		await enableExtension(root, "react");
		await packageExtension(pkg, "react", "# react\n\n## Craft\n\nOne component per file.\n");

		const rules = await collectCraftRules(root, pkg);

		expect(rules.sources.map((s) => s.extension)).toContain("react");
		expect(rules.sources.find((s) => s.extension === "react")?.rules).toContain(
			"One component per file",
		);
		// 30s, not vitest's 5s default — each case builds two real repos. See the
		// note in changed.test.ts.
	}, 30_000);

	it("drops the extension's rules when it is disabled", async () => {
		// Turning an extension off must change what Shape flags. If it does not,
		// the rule is really hardcoded somewhere and the project cannot set its
		// own standard.
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);
		await packageExtension(pkg, "react", "# react\n\n## Craft\n\nOne component per file.\n");
		// Note: never enabled in `.indusk/extensions/`.

		const rules = await collectCraftRules(root, pkg);

		expect(rules.sources.map((s) => s.extension)).not.toContain("react");
	}, 30_000);

	it("still yields a usable standard when no domain extension is enabled", async () => {
		// A library or CLI project gets the general move — extract a function or
		// module — rather than nothing at all.
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);

		const rules = await collectCraftRules(root, pkg);

		expect(rules.scope.inScope.length).toBeGreaterThan(0);
	}, 30_000);
});

describe("T17 — an extension whose prose cannot be read is reported, not dropped", () => {
	it("names the extension as unreadable", async () => {
		// Silently skipping it means the project believes its craft standard is in
		// force when it is not — "could not check" reported as "nothing to say",
		// which is the distinction this whole feature exists to preserve.
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);
		await enableExtension(root, "ghost");
		// Enabled, declares a skill, and no prose exists on either side.

		const rules = await collectCraftRules(root, pkg);

		expect(rules.sources.map((s) => s.extension)).not.toContain("ghost");
		expect(rules.unreadable).toContain("ghost");
	}, 30_000);

	it("leaves unreadable empty when every enabled extension was readable", async () => {
		// The report must distinguish "nothing was broken" from "nothing was
		// checked" — an always-populated field would be as useless as an absent one.
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);
		await enableExtension(root, "react");
		await packageExtension(pkg, "react", "# react\n\n## Craft\n\nOne component per file.\n");

		const rules = await collectCraftRules(root, pkg);

		expect(rules.unreadable).toEqual([]);
	}, 30_000);
});

describe("A8 — the rule set declares where Shape stops", () => {
	it("scopes to intra-unit craft", async () => {
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);

		const rules = await collectCraftRules(root, pkg);

		expect(rules.scope.inScope.join(" ").toLowerCase()).toMatch(/unit|function|component|file/);
	}, 30_000);

	it("declares cross-file duplication out of scope, leaving it to cleanup", async () => {
		// The line that keeps the two rituals from arguing over territory.
		// Its other half is asserted from cleanup's side (A9): cleanup must still
		// see these files, so "Shape ignores it" never means nobody catches it.
		const root = await makeRepo();
		const pkg = await makeRepo("shape-pkg");
		roots.push(root, pkg);

		const rules = await collectCraftRules(root, pkg);

		const outOfScope = rules.scope.outOfScope.join(" ").toLowerCase();
		expect(outOfScope).toMatch(/duplicat/);
		expect(outOfScope).toMatch(/cleanup/);
	}, 30_000);
});
