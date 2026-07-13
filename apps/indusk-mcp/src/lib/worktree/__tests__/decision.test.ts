import { describe, expect, it } from "vitest";
import { detectTreeContext, resolveWorktreeDecision } from "../decision.js";

/**
 * Test Trajectory for the worktree-visibility plan — Phase 2 helper rows.
 *
 *   T5 — resolveWorktreeDecision: `worktree: none` frontmatter → "skip";
 *        absent or any other value → "create".
 *   T6 — detectTreeContext: a cwd whose toplevel is the repo's main worktree is
 *        "trunk"; a cwd inside a linked worktree is "worktree".
 *
 * See .indusk/planning/worktree-visibility/impl.md.
 */

const FM = (worktree?: string) =>
	`---\ntitle: "P"\n${worktree === undefined ? "" : `worktree: ${worktree}\n`}---\n\n# P\n`;

describe("resolveWorktreeDecision (T5)", () => {
	it("returns 'skip' for worktree: none", () => {
		expect(resolveWorktreeDecision(FM("none"))).toBe("skip");
	});
	it("returns 'create' when the key is absent", () => {
		expect(resolveWorktreeDecision(FM(undefined))).toBe("create");
	});
	it("returns 'create' for any non-'none' value", () => {
		expect(resolveWorktreeDecision(FM("create"))).toBe("create");
		expect(resolveWorktreeDecision(FM("yes"))).toBe("create");
	});
	it("treats 'None' / whitespace case-insensitively", () => {
		expect(resolveWorktreeDecision(FM("None"))).toBe("skip");
		expect(resolveWorktreeDecision(FM('"none"'))).toBe("skip");
	});
	it("returns 'create' on unparseable content (safe default)", () => {
		expect(resolveWorktreeDecision("not markdown at all")).toBe("create");
	});
});

// T11 (Phase 4 falsification) — the opt-out must accept the natural falsy forms,
// not only the literal string "none". `worktree: false` parses to boolean false;
// `no`/`off` stay strings. All three should mean "skip".
describe("resolveWorktreeDecision opt-out coercion (T11)", () => {
	it("treats boolean `worktree: false` as skip", () => {
		expect(resolveWorktreeDecision(FM("false"))).toBe("skip");
	});
	it("treats YAML-falsy `no` / `off` as skip", () => {
		expect(resolveWorktreeDecision(FM("no"))).toBe("skip");
		expect(resolveWorktreeDecision(FM("off"))).toBe("skip");
	});
	it("still treats `create` and absent as create", () => {
		expect(resolveWorktreeDecision(FM("create"))).toBe("create");
		expect(resolveWorktreeDecision(FM(undefined))).toBe("create");
	});
});

describe("detectTreeContext (T6)", () => {
	// Fake git runner: main worktree is /wb/repo; a linked worktree is /wb/wtb.
	const runner =
		(topLevel: string) =>
		(args: string[]): string | null => {
			if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return `${topLevel}\n`;
			if (args[0] === "worktree" && args[1] === "list") {
				return "worktree /wb/repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /wb/wtb\nHEAD def\nbranch refs/heads/feature-b\n";
			}
			return null;
		};

	it("classifies the main worktree as trunk", () => {
		const ctx = detectTreeContext("/wb/repo/src", runner("/wb/repo"));
		expect(ctx.kind).toBe("trunk");
		expect(ctx.toplevel).toBe("/wb/repo");
	});
	it("classifies a linked worktree as worktree", () => {
		const ctx = detectTreeContext("/wb/wtb/src", runner("/wb/wtb"));
		expect(ctx.kind).toBe("worktree");
		expect(ctx.toplevel).toBe("/wb/wtb");
	});
	it("defaults to trunk with empty toplevel when not in a git repo", () => {
		const noRepo = (): string | null => null;
		const ctx = detectTreeContext("/tmp/nope", noRepo);
		expect(ctx.kind).toBe("trunk");
		expect(ctx.toplevel).toBe("");
	});
});
