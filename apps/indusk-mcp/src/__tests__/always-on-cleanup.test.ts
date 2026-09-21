import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMarkSource } from "../lib/promises/telemetry.js";
import { readPassSettings } from "../lib/telemetry/server.js";
import { promiseProject, siteFile, testFile } from "./helpers/promises-fixture.js";

/**
 * day-always-on — A29, A30 (Build Phase 8, cleanup).
 *
 * Two things this plan gave a second caller. The behavioural halves are
 * **regression guards**: they pass the moment they are written, because the
 * copies agree today — which is exactly why the duplication is easy to miss
 * and worth pinning before it is collapsed. The single-definition halves are
 * red now and are the reason the phase exists.
 */

const PROMISE = "seat-never-double-booked";
const CRED_ENV = "INDUSK_CLEANUP_CREDENTIAL";
const SRC = join(__dirname, "..");

/**
 * Every `.ts` under `src/`, tests aside — **including `src/bin`**, because the
 * second copy of each of these lives in a command module. A pin that scanned
 * only `src/lib` would have gone green while the duplication it names was
 * still there, one directory away.
 */
function sources(dir: string = SRC): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "__tests__") continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...sources(path));
		else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) out.push(path);
	}
	return out;
}

function occurrences(pattern: RegExp): { file: string; count: number }[] {
	return sources()
		.map((file) => ({
			file: file.slice(SRC.length + 1),
			count: (readFileSync(file, "utf-8").match(pattern) ?? []).length,
		}))
		.filter((f) => f.count > 0);
}

describe("A29 — one way to build a Jaeger endpoint", () => {
	it("the pass settings and a named remote normalize the same URL identically", async () => {
		const spelling = "  https://host/  ";
		const fromPass = readPassSettings({
			INDUSK_SERVER_VOLUME: "/tmp/v",
			INDUSK_SERVER_QUERY_URL: spelling,
			INDUSK_SERVER_CREDENTIAL: "indusk:pw",
			INDUSK_SERVER_SLACK_WEBHOOK: "http://127.0.0.1:1/hook",
		}).queryUrl;

		const fixture = promiseProject({
			domains: ["seating"],
			promises: [
				{
					name: PROMISE,
					kind: "behaviour",
					state: "enforced",
					domain: "seating",
					owner: "seats-v2",
					sites: [`src/${PROMISE}.ts`],
					tests: [`src/${PROMISE}.test.ts`],
				},
			],
			files: {
				[`src/${PROMISE}.ts`]: siteFile(PROMISE),
				[`src/${PROMISE}.test.ts`]: testFile(PROMISE),
			},
			extraConfig: {
				promises: { domains: ["seating"], jaeger: { url: spelling, credential_env: CRED_ENV } },
			},
		});
		process.env[CRED_ENV] = "indusk:pw";
		try {
			const source = await resolveMarkSource(fixture.planRoot);
			expect(source.endpoint.queryUrl).toBe(fromPass);
			expect(fromPass, "trailing slash and whitespace are both gone").toBe("https://host");
		} finally {
			delete process.env[CRED_ENV];
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it("that normalization is written once", () => {
		// The rule — strip trailing slashes from a Jaeger URL — is the thing
		// that must not be restated. Two copies agree today; that is what makes
		// a third easy to write differently.
		const found = occurrences(/replace\(\/\\\/\+\$\/, ""\)/g);
		const total = found.reduce((n, f) => n + f.count, 0);
		expect(total, `normalized in: ${found.map((f) => `${f.file}×${f.count}`).join(", ")}`).toBe(1);
	});
});

describe("A30 — one way to say what a pass did", () => {
	it("the unannounced phrasing lives in one module", () => {
		const found = occurrences(/it stays unannounced for the next pass/g);
		expect(
			found.map((f) => f.file),
			"the report belongs to the module that owns the result shape",
		).toEqual(["lib/always-on/pass.ts"]);
	});

	it("the record-problem phrasing lives in one module", () => {
		const found = occurrences(/announced nothing — /g);
		expect(found.map((f) => f.file)).toEqual(["lib/always-on/pass.ts"]);
	});
});
