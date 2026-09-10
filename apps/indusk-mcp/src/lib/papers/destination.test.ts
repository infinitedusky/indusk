import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { paperProject } from "../../__tests__/helpers/papers-fixture.js";
import { DestinationError, resolveDestination } from "./destination.js";

/**
 * Destination resolution, unit-covered here so Build Phase 3's publish tests
 * can only fail on publish logic (writing-skill Build Phase 2 Verification).
 * A12's CLI-level cases cover the same rule from the outside.
 */
const dest = (over: Record<string, unknown>) => ({
	name: "blog",
	dir: "writing",
	index: "writing/index.md",
	...over,
});

describe("resolveDestination", () => {
	it("refuses naming papers.destinations when none is configured", () => {
		const { root } = paperProject({ docs: {} });
		expect(() => resolveDestination(root)).toThrow(/papers\.destinations/);
		expect(() => resolveDestination(root)).toThrow(DestinationError);
	});

	it("expands ~ and resolves a relative path against the project root", () => {
		const { root } = paperProject({
			docs: {},
			config: { papers: { destinations: [dest({ path: "~/site" })] } },
		});
		expect(resolveDestination(root).root).toBe(resolve(homedir(), "site"));

		const { root: rel } = paperProject({
			docs: {},
			config: { papers: { destinations: [dest({ path: "../site" })] } },
		});
		expect(resolveDestination(rel).root).toBe(resolve(rel, "../site"));
	});

	it("picks the only destination without a name, and refuses an ambiguous choice listing the names", () => {
		const { root } = paperProject({
			docs: {},
			config: {
				papers: { destinations: [dest({ path: "/a" }), dest({ name: "other", path: "/b" })] },
			},
		});
		expect(() => resolveDestination(root)).toThrow(/blog, other/);
		expect(resolveDestination(root, "other").root).toBe("/b");
		expect(() => resolveDestination(root, "nope")).toThrow(/No destination named "nope"/);
	});

	it("resolves a declared repo through the workbench's declarations", () => {
		const { root } = paperProject({
			docs: {},
			config: {
				worktree: { shape: "workbench", repos_root: ".", repos: [{ name: "site" }] },
				papers: { destinations: [dest({ repo: "site" })] },
			},
		});
		expect(resolveDestination(root).root).toBe(join(root, "site"));
	});

	it("refuses a repo outside a workbench, saying only paths are accepted", () => {
		const { root } = paperProject({
			docs: {},
			config: { papers: { destinations: [dest({ repo: "site" })] } },
		});
		expect(() => resolveDestination(root)).toThrow(/only paths are accepted/);
	});

	it("refuses a repo the workbench does not declare, listing what it does", () => {
		const { root } = paperProject({
			docs: {},
			config: {
				worktree: { shape: "workbench", repos_root: ".", repos: [{ name: "career" }] },
				papers: { destinations: [dest({ repo: "site" })] },
			},
		});
		expect(() => resolveDestination(root)).toThrow(/does not declare \(declared: career\)/);
	});

	it("defaults the frontmatter map to title and description", () => {
		const { root } = paperProject({
			docs: {},
			config: { papers: { destinations: [dest({ path: "/a" })] } },
		});
		expect(resolveDestination(root).frontmatter).toEqual({
			title: "title",
			description: "description",
		});
	});
});
