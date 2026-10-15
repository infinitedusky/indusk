import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProjectGroupId, readConfig, sanitizeGroupId } from "./config.js";

describe("sanitizeGroupId", () => {
	it("replaces hyphens with underscores (the chitin-sportsbook bug)", () => {
		expect(sanitizeGroupId("chitin-sportsbook")).toBe("chitin_sportsbook");
	});

	it("leaves already-safe ids unchanged", () => {
		expect(sanitizeGroupId("dusk")).toBe("dusk");
		expect(sanitizeGroupId("indusk_already_ok")).toBe("indusk_already_ok");
		expect(sanitizeGroupId("project123")).toBe("project123");
	});

	it("collapses multiple non-word characters into a single underscore", () => {
		expect(sanitizeGroupId("my--weird---name")).toBe("my_weird_name");
		expect(sanitizeGroupId("foo  bar")).toBe("foo_bar");
	});

	it("handles dots, slashes, and scoped package names", () => {
		expect(sanitizeGroupId("my.cool.project")).toBe("my_cool_project");
		expect(sanitizeGroupId("@scope/pkg")).toBe("scope_pkg");
		expect(sanitizeGroupId("@infinitedusky/indusk-mcp")).toBe("infinitedusky_indusk_mcp");
	});

	it("strips leading and trailing separators", () => {
		expect(sanitizeGroupId("-foo-")).toBe("foo");
		expect(sanitizeGroupId("___bar___")).toBe("bar");
	});

	it("preserves alphanumerics and underscores", () => {
		expect(sanitizeGroupId("CamelCase_123")).toBe("CamelCase_123");
	});
});

describe("getProjectGroupId", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "indusk-config-test-"));
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	it("falls back to sanitized basename when no config exists", () => {
		// tmpRoot looks like /tmp/indusk-config-test-XXXXXX → sanitized to indusk_config_test_XXXXXX
		const groupId = getProjectGroupId(tmpRoot);
		expect(groupId).toMatch(/^indusk_config_test_/);
		expect(groupId).not.toContain("-");
	});

	it("sanitizes a hyphenated directory basename", () => {
		const projectDir = join(tmpRoot, "chitin-sportsbook");
		mkdirSync(projectDir);
		expect(getProjectGroupId(projectDir)).toBe("chitin_sportsbook");
	});

	it("uses .indusk/config.json graphiti.groupId override when set", () => {
		const projectDir = join(tmpRoot, "chitin-sportsbook");
		mkdirSync(join(projectDir, ".indusk"), { recursive: true });
		writeFileSync(
			join(projectDir, ".indusk/config.json"),
			JSON.stringify({
				mode: "full",
				verify: {},
				detected: {},
				graphiti: { groupId: "my_custom_group" },
			}),
		);
		expect(getProjectGroupId(projectDir)).toBe("my_custom_group");
	});

	it("trusts the override as-is, even if it contains hyphens (caller's responsibility)", () => {
		// Explicit overrides are trusted — sanitization only applies to the basename fallback.
		const projectDir = join(tmpRoot, "any-dir");
		mkdirSync(join(projectDir, ".indusk"), { recursive: true });
		writeFileSync(
			join(projectDir, ".indusk/config.json"),
			JSON.stringify({
				mode: "full",
				verify: {},
				detected: {},
				graphiti: { groupId: "explicit-with-hyphens" },
			}),
		);
		expect(getProjectGroupId(projectDir)).toBe("explicit-with-hyphens");
	});
});

// promise: the-core-is-always-kept
describe("planning.documents_off", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "documents-off-config-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
	});
	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});
	const configWith = (documents_off: string[]) =>
		writeFileSync(
			join(root, ".indusk/config.json"),
			JSON.stringify({ mode: "full", verify: {}, detected: {}, planning: { documents_off } }),
		);

	it("reads a config that turns off documents other than the core", () => {
		configWith(["adr", "research"]);
		expect(readConfig(root)?.planning?.documents_off).toEqual(["adr", "research"]);
	});

	it("refuses a config that turns off the brief or the test plan, naming it", () => {
		configWith(["adr", "brief"]);
		expect(() => readConfig(root)).toThrow(/"brief"/);
		configWith(["test-plan"]);
		expect(() => readConfig(root)).toThrow(/"test-plan"/);
	});
});
