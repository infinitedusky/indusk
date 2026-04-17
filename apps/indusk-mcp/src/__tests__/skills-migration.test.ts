import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(__dirname, "../../skills");

function skillBody(name: string): string {
	return readFileSync(join(skillsDir, `${name}.md`), "utf-8");
}

function findHighlightCall(
	body: string,
	tag: string,
): { raw: string; level: string | null } | null {
	const calls = body.matchAll(/mcp__indusk__highlight\(\{([\s\S]*?)\}\)/g);
	for (const match of calls) {
		const inner = match[1];
		const tagMatch = inner.match(/tag:\s*"([^"]+)"/);
		if (tagMatch && tagMatch[1] === tag) {
			const levelMatch = inner.match(/level:\s*"([^"]+)"/);
			return { raw: match[0], level: levelMatch ? levelMatch[1] : null };
		}
	}
	return null;
}

describe("T6: planner skill brief-accepted and adr-accepted triggers use the highlight tool at level: critical", () => {
	const body = skillBody("planner");

	it("calls highlight with tag='brief-accepted' and level='critical'", () => {
		const call = findHighlightCall(body, "brief-accepted");
		expect(call).not.toBeNull();
		expect(call?.level).toBe("critical");
	});

	it("calls highlight with tag='adr-accepted' and level='critical'", () => {
		const call = findHighlightCall(body, "adr-accepted");
		expect(call).not.toBeNull();
		expect(call?.level).toBe("critical");
	});
});

describe("T7: work skill correction trigger uses the highlight tool at level: important", () => {
	const body = skillBody("work");

	it("calls highlight with tag='correction' and level='important'", () => {
		const call = findHighlightCall(body, "correction");
		expect(call).not.toBeNull();
		expect(call?.level).toBe("important");
	});
});

describe("T8: retrospective skill retro-lesson trigger uses the highlight tool at level: important", () => {
	const body = skillBody("retrospective");

	it("calls highlight with tag='retro-lesson' and level='important'", () => {
		const call = findHighlightCall(body, "retro-lesson");
		expect(call).not.toBeNull();
		expect(call?.level).toBe("important");
	});
});

describe("T9: no process skill (planner/work/retro) references graph_capture or raw mcp__graphiti__add_memory", () => {
	const processSkills = ["planner", "work", "retrospective"] as const;

	for (const name of processSkills) {
		it(`${name}.md contains no graph_capture or mcp__graphiti__add_memory references`, () => {
			const body = skillBody(name);
			expect(body).not.toMatch(/graph_capture/);
			expect(body).not.toMatch(/mcp__graphiti__add_memory/);
		});
	}
});
