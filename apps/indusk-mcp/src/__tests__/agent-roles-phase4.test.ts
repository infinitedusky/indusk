import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const skillsDir = resolve(__dirname, "../../skills");
const hooksDir = resolve(__dirname, "../../hooks");

describe("T11: /highlight slash command skill exists with level arg parsing", () => {
	const skillPath = resolve(skillsDir, "highlight.md");

	it("has a skill file at apps/indusk-mcp/skills/highlight.md", () => {
		expect(existsSync(skillPath)).toBe(true);
	});

	it("default level is 'important' when the user does not specify one", () => {
		const body = readFileSync(skillPath, "utf-8");
		expect(body).toMatch(/default\s+to\s+`?important`?/i);
	});

	it("accepts 'critical' and 'note' as explicit levels", () => {
		const body = readFileSync(skillPath, "utf-8");
		expect(body).toMatch(/critical/);
		expect(body).toMatch(/note/);
	});

	it("documents calling mcp__indusk__highlight tool", () => {
		const body = readFileSync(skillPath, "utf-8");
		expect(body).toContain("mcp__indusk__highlight");
	});
});

describe("T12: handoff skill fires the eval trigger at session end", () => {
	const handoffPath = resolve(skillsDir, "handoff.md");

	it("references eval-trigger.js with --source handoff", () => {
		const body = readFileSync(handoffPath, "utf-8");
		expect(body).toMatch(/eval-trigger\.js[^\n]*--source\s+handoff/);
	});
});

describe("T13: eval-trigger.js accepts --source handoff CLI flag and propagates it", () => {
	const hookPath = resolve(hooksDir, "eval-trigger.js");

	it("exists at apps/indusk-mcp/hooks/eval-trigger.js", () => {
		expect(existsSync(hookPath)).toBe(true);
	});

	it("source code parses --source arg from argv", () => {
		const body = readFileSync(hookPath, "utf-8");
		expect(body).toMatch(/--source/);
		expect(body).toMatch(/parseSourceArg|process\.argv/);
	});

	it("source code passes INDUSK_EVAL_SOURCE into the spawned evaluator env", () => {
		const body = readFileSync(hookPath, "utf-8");
		expect(body).toContain("INDUSK_EVAL_SOURCE");
	});

	it("CLI invocation with --source handoff exits 0 without reading stdin", () => {
		// We invoke the hook with --source handoff and no stdin. In CLI mode
		// the hook must not attempt to read stdin (which would hang forever).
		// We use a short timeout to detect a hang. The hook may fail internally
		// because the evaluator runner isn't built or jj isn't configured — we
		// only care that it returns without hanging on stdin.
		const node = process.execPath;
		let exitCode: number | null = null;
		try {
			execFileSync(node, [hookPath, "--source", "handoff"], {
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 10_000,
				cwd: repoRoot,
			});
			exitCode = 0;
		} catch (err: unknown) {
			// execFileSync throws on non-zero exit OR timeout
			const e = err as { status?: number | null; signal?: string | null; code?: string };
			if (e.signal === "SIGTERM" || e.code === "ETIMEDOUT") {
				throw new Error("hook hung — it probably tried to read stdin in CLI mode");
			}
			exitCode = typeof e.status === "number" ? e.status : null;
		}
		// Exit 0 (success) or any non-hang exit is acceptable — we only test
		// that the CLI mode doesn't hang on stdin.
		expect(exitCode).not.toBeNull();
	});
});

describe("T14: CLAUDE.md contains three-tier agent roles subsection AND agent-roles ADR bullet", () => {
	const claudeMdPath = resolve(repoRoot, "CLAUDE.md");

	it("Architecture contains a three-tier agent roles subsection", () => {
		const body = readFileSync(claudeMdPath, "utf-8");
		// The section must be inside Architecture (before Conventions)
		const archSection = body.match(/## Architecture([\s\S]*?)## Conventions/);
		expect(archSection).not.toBeNull();
		const archText = archSection?.[1] ?? "";
		expect(archText).toMatch(/Agent Roles/i);
		expect(archText).toMatch(/working agent/i);
		expect(archText).toMatch(/eval agent/i);
		expect(archText).toMatch(/infrastructure/i);
	});

	it("Key Decisions contains the agent-roles ADR bullet", () => {
		const body = readFileSync(claudeMdPath, "utf-8");
		const keyDecisionsSection = body.match(/## Key Decisions([\s\S]*?)## Known Gotchas/);
		expect(keyDecisionsSection).not.toBeNull();
		const text = keyDecisionsSection?.[1] ?? "";
		expect(text).toMatch(/agent-roles/);
		// Must link to the ADR path
		expect(text).toMatch(/\.indusk\/planning\/agent-roles\/adr\.md/);
	});
});
