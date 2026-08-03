import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared test harness for the `run` suite (Phase 7).
 *
 * Extracted because four test files — gate, falsification, loop, swap — each
 * redeclared the same constants and three repeated the same temp-worktree
 * setup verbatim. Rule of three, exceeded.
 *
 * Named `*.test-support.ts` rather than `*.test.ts` so vitest's `include`
 * glob does not try to run a file with no tests in it.
 */

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root — four levels up from `src/lib/run/`. */
export const repoRoot = resolve(here, "../../../../..");

/** This repo's installed hooks — the REAL gate scripts, never mocked. */
export const hooksDir = join(repoRoot, ".claude/hooks");

/** Validator first, then gates — the PreToolUse chain order. */
export const realGateScripts = [
	join(hooksDir, "validate-impl-structure.js"),
	join(hooksDir, "check-gates.js"),
];

/** The guinea-pig reference plan every end-to-end test runs against. */
export const fixtureDir = resolve(here, "../../../fixtures/guinea-pig-semver");

/** Minimal stand-in for the AI SDK's ToolExecutionOptions second argument. */
export const execOptions = { toolCallId: "call-1", messages: [] };

export type Exec = (input: unknown, options: unknown) => Promise<unknown>;

/** Pull a tool's `execute` out of a ToolSet, failing loudly if absent. */
export function executeOf(toolSet: Record<string, unknown>, name: string): Exec {
	const candidate = (toolSet[name] as { execute?: Exec } | undefined)?.execute;
	if (!candidate) throw new Error(`tool ${name} has no execute`);
	return candidate;
}

/**
 * One scripted MockLanguageModelV4 step that calls a tool (dawn-hook-parity:
 * shared here because a fourth test file needed the loop.test.ts helpers —
 * loop.test.ts keeps its local copies until the cleanup ritual converges them).
 */
export function toolCallStep(toolName: string, input: Record<string, unknown>) {
	return {
		content: [
			{
				type: "tool-call" as const,
				toolCallId: `call-${toolName}-${Math.random().toString(36).slice(2, 8)}`,
				toolName,
				input: JSON.stringify(input),
			},
		],
		finishReason: { unified: "tool-calls" as const, raw: "tool_use" },
		usage: {
			inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 10, text: 10, reasoning: 0 },
		},
		warnings: [],
	};
}

/** The final scripted model step: plain text, no tool call. */
export function finishStep(text: string) {
	return {
		content: [{ type: "text" as const, text }],
		finishReason: { unified: "stop" as const, raw: "end_turn" },
		usage: {
			inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 10, text: 10, reasoning: 0 },
		},
		warnings: [],
	};
}

/** Working semver implementation the scripted model "writes" into the fixture. */
export const SEMVER_MJS = `const RE = /^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/;

export function parse(input) {
	const m = RE.exec(input);
	if (!m) throw new Error(\`invalid semver: \${input}\`);
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compare(a, b) {
	const pa = parse(a);
	const pb = parse(b);
	for (const key of ["major", "minor", "patch"]) {
		if (pa[key] < pb[key]) return -1;
		if (pa[key] > pb[key]) return 1;
	}
	return 0;
}

export function bump(version, level) {
	const v = parse(version);
	if (level === "major") return \`\${v.major + 1}.0.0\`;
	if (level === "minor") return \`\${v.major}.\${v.minor + 1}.0\`;
	if (level === "patch") return \`\${v.major}.\${v.minor}.\${v.patch + 1}\`;
	throw new Error(\`invalid level: \${level}\`);
}
`;

/** Green node:test suite for the fixture's T1–T3 rows. */
export const SEMVER_TEST_MJS = `import assert from "node:assert/strict";
import test from "node:test";
import { bump, compare, parse } from "./semver.mjs";

test("T1: parse yields fields and rejects malformed input", () => {
	assert.deepEqual(parse("1.2.3"), { major: 1, minor: 2, patch: 3 });
	for (const bad of ["01.2.3", "1.2", "1.x.3"]) {
		assert.throws(() => parse(bad));
	}
});

test("T2: compare orders by major, then minor, then patch", () => {
	assert.equal(compare("1.9.9", "2.0.0"), -1);
	assert.equal(compare("2.1.0", "2.0.9"), 1);
	assert.equal(compare("1.2.3", "1.2.3"), 0);
	assert.equal(compare("1.2.3", "1.2.4"), -1);
});

test("T3: bump increments the level and zeroes lower fields", () => {
	assert.equal(bump("1.2.3", "minor"), "1.3.0");
	assert.equal(bump("1.2.3", "major"), "2.0.0");
	assert.equal(bump("1.2.3", "patch"), "1.2.4");
});
`;

/** Thin CLI wrapper the scripted model "writes". */
export const CLI_MJS = `#!/usr/bin/env node
import { bump, compare, parse } from "./semver.mjs";

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "parse") console.log(JSON.stringify(parse(args[0])));
else if (cmd === "compare") console.log(compare(args[0], args[1]));
else if (cmd === "bump") console.log(bump(args[0], args[1]));
else {
	console.error("usage: semver parse <v> | compare <a> <b> | bump <v> <level>");
	process.exit(1);
}
`;

/** Trajectory table line for a row id in impl content — loud when absent. */
export function rowLine(content: string, id: string): string {
	const line = content.split("\n").find((l) => l.startsWith(`| ${id} |`));
	if (!line) throw new Error(`trajectory row ${id} not found in fixture`);
	return line;
}

/** The unchecked Phase 1 implementation items of the guinea-pig impl. */
export function phase1ImplItems(content: string): string[] {
	const start = content.indexOf("### Phase 1:");
	const end = content.indexOf("#### Phase 1 Verification");
	if (start === -1 || end === -1) throw new Error("fixture phase structure not found");
	return content
		.slice(start, end)
		.split("\n")
		.filter((l) => l.startsWith("- [ ]"));
}

/** The single Phase 1 Verification checklist line of the guinea-pig impl. */
export function phase1VerificationLine(content: string): string {
	const start = content.indexOf("#### Phase 1 Verification");
	const end = content.indexOf("#### Phase 1 Context");
	const line = content
		.slice(start, end)
		.split("\n")
		.find((l) => l.startsWith("- [ ]"));
	if (!line) throw new Error("fixture verification item not found");
	return line;
}

/**
 * The canonical scripted happy path over the guinea-pig fixture: tests-first
 * RED, states → written, implement, verify, states → passing, then checkoffs.
 * `itemwiseCheckoffs` checks each impl item in its own edit step (the /work
 * cadence — one checkoff event per item), which the commit-cadence tests need;
 * `false` batches them like loop.test.ts's T5 script.
 */
export function guineaPigHappyPathSteps(
	impl: string,
	options: { itemwiseCheckoffs?: boolean } = {},
) {
	const rowsBlock = [rowLine(impl, "T1"), rowLine(impl, "T2"), rowLine(impl, "T3")].join("\n");
	const implItems = phase1ImplItems(impl);
	const verifLine = phase1VerificationLine(impl);

	const checkoffSteps = options.itemwiseCheckoffs
		? implItems.map((line) =>
				toolCallStep("edit", {
					path: "impl.md",
					old_string: line,
					new_string: line.replace("- [ ]", "- [x]"),
				}),
			)
		: [
				toolCallStep("edit", {
					path: "impl.md",
					old_string: implItems.join("\n"),
					new_string: implItems.join("\n").replaceAll("- [ ]", "- [x]"),
				}),
			];

	return [
		toolCallStep("writeFile", { path: "semver.test.mjs", content: SEMVER_TEST_MJS }),
		toolCallStep("edit", {
			path: "impl.md",
			old_string: rowsBlock,
			new_string: rowsBlock.replaceAll("| ⬜ |", "| written |"),
		}),
		toolCallStep("writeFile", { path: "semver.mjs", content: SEMVER_MJS }),
		toolCallStep("writeFile", { path: "cli.mjs", content: CLI_MJS }),
		toolCallStep("bash", { command: "node --test semver.test.mjs" }),
		toolCallStep("edit", {
			path: "impl.md",
			old_string: rowsBlock.replaceAll("| ⬜ |", "| written |"),
			new_string: rowsBlock.replaceAll("| ⬜ |", "| passing |"),
		}),
		...checkoffSteps,
		toolCallStep("edit", {
			path: "impl.md",
			old_string: verifLine,
			new_string: verifLine.replace("- [ ]", "- [x]"),
		}),
		finishStep("Phase 1 complete: semver core implemented, tests green, items checked."),
	];
}

export interface TempWorktree {
	/** Absolute path to the worktree root. */
	root: string;
	/** Remove the worktree — call from `afterEach`. */
	cleanup: () => Promise<void>;
}

/**
 * A temp worktree carrying the real `.claude/hooks` and a pristine copy of the
 * guinea-pig fixture, so `resolveGateScripts` finds real scripts and the gate
 * has a real impl to have opinions about.
 *
 * @param prefix mkdtemp prefix, so a leaked directory names its own test
 * @param options.fixtureAt where the fixture lands: a subdirectory name, or
 *   `"root"` to copy it directly into the worktree root
 */
export async function makeGatedWorktree(
	prefix: string,
	options: { fixtureAt?: string | "root" } = {},
): Promise<TempWorktree> {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await mkdir(join(root, ".claude"), { recursive: true });
	await cp(hooksDir, join(root, ".claude/hooks"), { recursive: true });

	const fixtureAt = options.fixtureAt ?? "guinea-pig";
	await cp(fixtureDir, fixtureAt === "root" ? root : join(root, fixtureAt), { recursive: true });

	return {
		root,
		cleanup: () => rm(root, { recursive: true, force: true }),
	};
}
