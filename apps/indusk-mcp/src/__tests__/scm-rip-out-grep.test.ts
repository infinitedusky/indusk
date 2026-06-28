import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

/**
 * T6 (git-only-substrate Phase 4) — the SCM abstraction layer is gone.
 *
 * After Phase 4, no production code in `apps/indusk-mcp/src/` calls
 * `getScm()`, imports `lib/scm/detect.js`, imports `lib/semantic-graph/jj.js`,
 * or references `NotAJjRepoError` / `getJjReachable`. The few remaining
 * occurrences in the source tree are:
 *
 *  - **Negative-assertion test strings** — these are allowed.
 *  - **Comment prose** explaining historical context — also allowed.
 *
 * This test enforces "no imports / no usage as code" by inspecting non-test
 * source files only.
 */

const SRC_ROOT = resolve(__dirname, "../..");

const FORBIDDEN_PATTERNS = [
	/import\s+[^;]*\bgetScm\b/,
	/from\s+["'][^"']*lib\/scm\/detect/,
	/from\s+["'][^"']*semantic-graph\/jj/,
	/\bNotAJjRepoError\b/,
	/\bgetJjReachable\b/,
];

describe("SCM abstraction rip-out — grep audit (T6)", () => {
	const files = globSync(["**/*.ts"], {
		cwd: SRC_ROOT,
		ignore: ["**/__tests__/**", "**/*.test.ts", "**/node_modules/**", "**/dist/**"],
		absolute: true,
	});

	it("no production source file imports getScm, lib/scm/detect, or semantic-graph/jj", () => {
		const violations: { file: string; line: number; text: string }[] = [];
		for (const file of files) {
			const content = readFileSync(file, "utf-8");
			content.split("\n").forEach((line, idx) => {
				for (const pattern of FORBIDDEN_PATTERNS) {
					if (pattern.test(line)) {
						violations.push({ file, line: idx + 1, text: line.trim() });
					}
				}
			});
		}
		expect(
			violations,
			`Found references that should be gone after Phase 4 rip-out:\n${violations
				.map((v) => `  ${v.file.replace(SRC_ROOT, "src")}:${v.line} — ${v.text}`)
				.join("\n")}`,
		).toEqual([]);
	});

	it("lib/semantic-graph/jj.ts does not exist", () => {
		const path = resolve(SRC_ROOT, "lib/semantic-graph/jj.ts");
		expect(() => readFileSync(path, "utf-8")).toThrow();
	});

	it("lib/scm/detect.ts does not exist", () => {
		const path = resolve(SRC_ROOT, "lib/scm/detect.ts");
		expect(() => readFileSync(path, "utf-8")).toThrow();
	});
});
