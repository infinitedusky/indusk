import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const evalDir = resolve(__dirname, "../lib/eval");
const hookPath = resolve(__dirname, "../../hooks/eval-trigger.js");

function readEvalSourceFiles(): Array<{ name: string; content: string }> {
	const files = readdirSync(evalDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
	return files.map((name) => ({ name, content: readFileSync(resolve(evalDir, name), "utf-8") }));
}

describe("T1: no source file under apps/indusk-mcp/src/lib/eval/ contains the word 'judge'", () => {
	it("eval/ sources are judge-free", () => {
		const offenders: string[] = [];
		for (const { name, content } of readEvalSourceFiles()) {
			// Skip matches inside comments marking historical references or changelog-style notes
			const stripped = content.replace(/\/\/[^\n]*historical[^\n]*\n/gi, "");
			if (/\bjudge\b/i.test(stripped)) {
				offenders.push(name);
			}
		}
		expect(offenders).toEqual([]);
	});
});

describe("T2: renamed files exist and old names do not", () => {
	const names = readdirSync(evalDir);

	it("evaluator-runner.ts exists; judge-runner.ts does not", () => {
		expect(names).toContain("evaluator-runner.ts");
		expect(names).not.toContain("judge-runner.ts");
	});

	it("persistent-evaluator.ts exists; persistent-judge.ts does not", () => {
		expect(names).toContain("persistent-evaluator.ts");
		expect(names).not.toContain("persistent-judge.ts");
	});

	it("evaluator-runner.test.ts exists; judge-runner.test.ts does not", () => {
		expect(names).toContain("evaluator-runner.test.ts");
		expect(names).not.toContain("judge-runner.test.ts");
	});
});

describe("T3: the eval-trigger hook resolves paths via the new filenames", () => {
	const hookBody = readFileSync(hookPath, "utf-8");

	it("candidate paths reference evaluator-runner.js, not judge-runner.js", () => {
		expect(hookBody).toContain("evaluator-runner.js");
		expect(hookBody).not.toContain("judge-runner.js");
	});

	it("persistent-evaluator path is derived correctly", () => {
		expect(hookBody).toContain("persistent-evaluator.js");
		expect(hookBody).not.toContain("persistent-judge.js");
	});

	it("hook body contains no 'judge' (case-insensitive) tokens", () => {
		expect(hookBody).not.toMatch(/\bjudge\b/i);
	});
});
