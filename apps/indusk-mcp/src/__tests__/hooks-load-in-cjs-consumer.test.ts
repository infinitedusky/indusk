import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * The hooks must actually LOAD in a consumer that declares
 * `"type": "commonjs"` — which is every project created by `npm init -y`
 * on npm 11.
 *
 * The hooks are ESM. Node only tolerates that in a `.js` file when the nearest
 * `package.json` is silent about `type`: it retries the parse as a module and
 * warns. State `"type": "commonjs"` outright and node refuses —
 * `SyntaxError: Cannot use import statement outside a module` — so every hook
 * dies at load and no gate fires.
 *
 * npm changed this: older `npm init -y` omitted the field entirely, newer
 * versions write `"type": "commonjs"`. So the breakage arrived without anyone
 * touching InDusk, and only for *newly created* consumers.
 *
 * It stayed invisible because **this repository is in the configuration that
 * masks it** — dusk's own root `package.json` has no `type` field, so the repo
 * dogfooding the hooks is exactly the case where they still work. Every
 * existing hook test runs them from this tree. That is why this test builds a
 * consumer rather than using the repo, and why it spawns a hook rather than
 * grepping a source file: the defect is invisible to both shortcuts.
 *
 * The fix is a nested `package.json` in `.claude/hooks/` declaring
 * `{"type":"module"}` — module type resolves to the *nearest* package.json, so
 * one file scopes it to that directory without renaming ten hooks to `.mjs`
 * and rewriting every `settings.json` registration (which would itself need
 * the consumer-side removal path this project does not have).
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A consumer shaped the way `npm init -y` shapes one, on npm 11. */
function makeCjsConsumer(): string {
	const root = mkdtempSync(join(tmpdir(), "cjs-consumer-"));
	dirs.push(root);
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ name: "consumer", version: "1.0.0", type: "commonjs" }, null, 2),
	);
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: root });
	spawnSync("node", [CLI_BIN, "init", "--local", "--no-index"], {
		cwd: root,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1", INDUSK_BIN: `node ${CLI_BIN}` },
		timeout: 120_000,
	});
	return root;
}

describe.skipIf(!existsSync(CLI_BIN))("hooks load in a `type: commonjs` consumer", () => {
	it("init writes .claude/hooks/package.json declaring the module type", () => {
		const root = makeCjsConsumer();
		const marker = join(root, ".claude", "hooks", "package.json");

		expect(existsSync(marker), "no module-type marker in .claude/hooks/").toBe(true);
		expect(JSON.parse(readFileSync(marker, "utf8")).type).toBe("module");
	}, 180_000);

	it("every installed hook actually loads there", () => {
		const root = makeCjsConsumer();
		const hooksDir = join(root, ".claude", "hooks");
		// Registered hooks only — the `_`-prefixed modules are imported by
		// these, so a load failure in one surfaces through its importer.
		const hooks = [
			"check-gates.js",
			"validate-impl-structure.js",
			"gate-reminder.js",
			"claude-md-budget.js",
		].filter((h) => existsSync(join(hooksDir, h)));
		expect(hooks.length).toBeGreaterThan(0);

		const broken: string[] = [];
		for (const hook of hooks) {
			// A path the hook ignores: every one fast-paths out on a non-impl
			// file, so a clean run proves the module LOADED, which is the only
			// thing under test here.
			const r = spawnSync("node", [join(hooksDir, hook)], {
				cwd: root,
				input: JSON.stringify({ tool_name: "Write", tool_input: {}, cwd: root }),
				encoding: "utf-8",
				timeout: 30_000,
			});
			if (/Cannot use import statement|ERR_REQUIRE_ESM|SyntaxError/.test(r.stderr ?? "")) {
				broken.push(`${hook}: ${(r.stderr ?? "").split("\n")[0]}`);
			}
		}

		expect(broken).toEqual([]);
	}, 180_000);
});
