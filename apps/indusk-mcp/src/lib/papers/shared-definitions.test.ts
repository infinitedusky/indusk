import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A30 (writing-skill cleanup): the `published` block's read shape has exactly
 * one definition. The parser derives staleness from it, the publish step
 * reads and writes it, and the provenance module writes it; three modules
 * that must agree on the same keys, which is the class of fact this codebase
 * pins by count rather than by behaviour (see shape/shared-definitions.test.ts
 * and shared-resolution.test.ts). A second `data.published as {…}` narrowing
 * anywhere under src/lib is a copy that will diverge silently.
 */

const LIB = join(__dirname, "..");
const PROVENANCE = join(LIB, "papers/provenance.ts");

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
		else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
	}
	return out;
}

/** Field names declared in `interface <name> { … }` of a source text. */
function interfaceFields(source: string, name: string): string[] {
	const body = new RegExp(`interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source)?.[1] ?? "";
	return [...body.matchAll(/^\s*([a-z_]+)\??:/gm)].map((m) => m[1]).sort();
}

describe("A30: the published block's read shape", () => {
	it("is defined once, in papers/provenance.ts", () => {
		const provenance = readFileSync(PROVENANCE, "utf-8");
		expect(provenance).toMatch(/export interface PublishedRecord\b/);
		expect(provenance).toMatch(/export function readPublishedRecord\(/);
	});

	it("is narrowed nowhere else under src/lib", () => {
		const offenders = sourceFiles(LIB)
			.filter((f) => f !== PROVENANCE)
			.filter((f) =>
				/\.published as \{|\bpublished as \{|interface Recorded\b/.test(readFileSync(f, "utf-8")),
			);
		expect(offenders.map((f) => f.slice(LIB.length + 1))).toEqual([]);
	});

	it("carries every key the write shape carries, so the reader and the writer agree", () => {
		const provenance = readFileSync(PROVENANCE, "utf-8");
		const written = interfaceFields(provenance, "Provenance");
		const read = interfaceFields(provenance, "PublishedRecord");
		expect(written.length).toBeGreaterThan(0);
		expect(read).toEqual(written);
	});

	it("is what the parser and the publish step read through", () => {
		const users = sourceFiles(LIB).filter(
			(f) => f !== PROVENANCE && /readPublishedRecord\(/.test(readFileSync(f, "utf-8")),
		);
		const names = users.map((f) => f.slice(LIB.length + 1)).sort();
		expect(names).toContain("papers/publish.ts");
		expect(names.some((n) => n === "papers/summary.ts" || n === "plan-parser.ts")).toBe(true);
	});
});
