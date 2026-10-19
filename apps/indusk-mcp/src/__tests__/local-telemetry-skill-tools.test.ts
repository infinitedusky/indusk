// a-new-project-starts-instrumented, Test Phase 1: T19 - a regression guard over the
// local-telemetry skill's diagnosis pattern: every tool it tells a person to call exists,
// with the parameters it names. The log tool is `tail_logs`, whose inputs are read from
// the schema in src/tools/telemetry-tools.ts; the trace tools are Jaeger's own MCP tools,
// wired in by `indusk telemetry register`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

const PACKAGE = join(REPO_ROOT, "apps/indusk-mcp");
const SKILL = join(PACKAGE, "extensions/local-telemetry/skill.md");
const TOOLS_SOURCE = join(PACKAGE, "src/tools/telemetry-tools.ts");

/** Jaeger's bundled MCP tools, as telemetry-tools.ts's own header lists them. */
const JAEGER_TOOLS = [
	"search_traces",
	"get_span_details",
	"get_trace_topology",
	"get_critical_path",
	"get_trace_errors",
	"get_services",
	"get_span_names",
	"health",
];

/** The keys of the `TailLogsInput` schema, read from the source that registers the tool. */
function tailLogsParameters(): string[] {
	const source = readFileSync(TOOLS_SOURCE, "utf-8");
	const start = source.indexOf("const TailLogsInput = z.object({");
	const end = source.indexOf("\n});", start);
	expect(start, "TailLogsInput is where this test reads it").toBeGreaterThan(-1);
	return [...source.slice(start, end).matchAll(/^\t(\w+):\s*z\b/gm)].map((m) => m[1] as string);
}

describe("local-telemetry-skill-tools", () => {
	const skill = readFileSync(SKILL, "utf-8");
	const lines = skill.split("\n");

	it("T19: every tool the skill tells a person to call exists", () => {
		const real = new Set(["tail_logs", ...JAEGER_TOOLS]);
		const named = new Set<string>();
		for (const line of lines) {
			for (const m of line.matchAll(/\b([a-z]+(?:_[a-z]+)+)\(/g)) named.add(m[1] as string);
			const row = /^\|\s*`([a-z]+(?:_[a-z]+)*)`\s*\|/.exec(line);
			if (row) named.add(row[1] as string);
			const bullet = /^- \*\*[^*]+\*\*: `([a-z]+(?:_[a-z]+)*)\(/.exec(line);
			if (bullet) named.add(bullet[1] as string);
		}
		expect([...named].filter((n) => !real.has(n))).toEqual([]);
	});

	it("T19: every parameter the skill passes to tail_logs is one the tool takes", () => {
		const takes = new Set(tailLogsParameters());
		expect(takes.size, "the schema has parameters to compare against").toBeGreaterThan(0);
		const problems: string[] = [];
		lines.forEach((line, i) => {
			const at = line.indexOf("tail_logs");
			if (at < 0) return;
			for (const m of line.slice(at).matchAll(/\b([A-Za-z_]+)\s*:/g)) {
				if (!takes.has(m[1] as string)) problems.push(`skill.md:${i + 1} passes ${m[1]}`);
			}
		});
		expect(problems).toEqual([]);
	});
});
