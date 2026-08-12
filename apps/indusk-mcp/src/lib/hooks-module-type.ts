import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Declare the installed hooks directory to be ESM.
 *
 * The hooks are ES modules. Node only tolerates that in a `.js` file when the
 * nearest `package.json` says nothing about `type` — it retries the parse as a
 * module and warns. A consumer that states `"type": "commonjs"` gets a refusal
 * instead: `SyntaxError: Cannot use import statement outside a module`, on
 * every hook, at load, before any gate can fire.
 *
 * That is not a hypothetical consumer. **`npm init -y` on npm 11 writes
 * `"type": "commonjs"`**, where older versions omitted the field — so the
 * breakage arrived without anyone touching InDusk, and only for newly created
 * projects. It went unnoticed because this repository is in the configuration
 * that masks it: dusk's own root `package.json` has no `type` field, so the
 * repo dogfooding the hooks is precisely the case where they still work.
 *
 * Module type resolves to the *nearest* `package.json`, so one file in the
 * hooks directory scopes it there and nothing else in the consumer is
 * affected. The alternative — renaming every hook to `.mjs` — would rewrite
 * each `settings.json` registration and the `globSync("*.js")` discovery on
 * both the init and update sides, and would need a consumer-side migration
 * path for the old names that this project does not yet have.
 *
 * Idempotent, and deliberately not overwriting: a consumer who has edited this
 * file has said something, and clobbering it would be the kind of silent
 * remote change an installer has no business making.
 */
export function ensureHooksModuleType(hooksDir: string): void {
	const marker = join(hooksDir, "package.json");
	if (existsSync(marker)) return;
	mkdirSync(hooksDir, { recursive: true });
	writeFileSync(marker, `${JSON.stringify({ type: "module" }, null, 2)}\n`, "utf-8");
}
