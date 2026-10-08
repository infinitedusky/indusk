import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { renderFlyConfig } from "../lib/server/fly-config.js";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * server-provisioning A26, A27: what the recording server's two commands
 * must agree on is defined once.
 *
 * lesson: structural-single-definition-test-for-must-agree-invariants
 */

const PKG = join(REPO_ROOT, "apps/indusk-mcp");
const LESSON = "lesson: structural-single-definition-test-for-must-agree-invariants";

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path);
		return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

describe("A26 — the machine's secrets file is located in one place", () => {
	it("only lib/server/secrets-file.ts names config.env (and the retired infra reader, by its own path)", () => {
		const allowed = new Set(["src/lib/server/secrets-file.ts", "src/lib/infra-config.ts"]);
		const naming = sources(join(PKG, "src"))
			.filter((path) => readFileSync(path, "utf-8").includes('"config.env"'))
			.map((path) => relative(PKG, path))
			.filter((path) => !allowed.has(path));
		expect(naming, `config.env located outside machineSecrets() — ${LESSON}`).toEqual([]);
		expect(readFileSync(join(PKG, "src/lib/server/secrets-file.ts"), "utf-8")).toMatch(
			/export function machineSecrets\(/,
		);
	});
});

describe("A27 — the Fly reference configuration and the package's template agree", () => {
	it("everything but comments, the app's name and the hand-deploy [build] section is identical", () => {
		const settings = (toml: string) =>
			toml
				.replace(/\n\[build\]\n[^[]*/, "\n")
				.split("\n")
				.map((l) => l.replace(/#.*$/, "").trimEnd())
				.filter((l) => l.trim() !== "");
		expect(
			settings(readFileSync(join(REPO_ROOT, "docker/fly.always-on.toml"), "utf-8")),
			LESSON,
		).toEqual(settings(renderFlyConfig({ app: "indusk-always-on", region: "iad" })));
	});
});
