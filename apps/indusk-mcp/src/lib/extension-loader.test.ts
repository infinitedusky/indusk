import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	disableExtension,
	enableExtension,
	getEnabledExtensions,
	isEnabled,
	loadExtension,
	loadExtensions,
} from "./extension-loader.js";

const TEST_ROOT = join(import.meta.dirname, "__test_extensions__");
const EXT_DIR = join(TEST_ROOT, ".indusk/extensions");
const DIS_DIR = join(TEST_ROOT, ".indusk/extensions/.disabled");

const validManifest = {
	name: "test-ext",
	description: "A test extension",
	provides: {
		skill: true,
		health_checks: [{ name: "test", command: "echo ok" }],
	},
	detect: { dependency: "test-pkg" },
};

beforeEach(() => {
	mkdirSync(EXT_DIR, { recursive: true });
	mkdirSync(DIS_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("loadExtension", () => {
	it("parses a valid manifest", () => {
		const path = join(EXT_DIR, "test-ext.json");
		writeFileSync(path, JSON.stringify(validManifest));
		const result = loadExtension(path);
		expect(result).not.toBeNull();
		expect(result?.name).toBe("test-ext");
		expect(result?.provides.skill).toBe(true);
	});

	it("returns null for invalid JSON", () => {
		const path = join(EXT_DIR, "bad.json");
		writeFileSync(path, "not json");
		expect(loadExtension(path)).toBeNull();
	});

	it("returns null for missing required fields", () => {
		const path = join(EXT_DIR, "incomplete.json");
		writeFileSync(path, JSON.stringify({ name: "x" }));
		expect(loadExtension(path)).toBeNull();
	});
});

describe("loadExtensions", () => {
	it("finds enabled and disabled extensions", () => {
		writeFileSync(
			join(EXT_DIR, "enabled.json"),
			JSON.stringify({ ...validManifest, name: "enabled" }),
		);
		writeFileSync(
			join(DIS_DIR, "disabled.json"),
			JSON.stringify({ ...validManifest, name: "disabled" }),
		);

		const all = loadExtensions(TEST_ROOT);
		expect(all).toHaveLength(2);
		expect(all.find((e) => e.manifest.name === "enabled")?.enabled).toBe(true);
		expect(all.find((e) => e.manifest.name === "disabled")?.enabled).toBe(false);
	});

	it("returns empty array when no extensions directory", () => {
		rmSync(TEST_ROOT, { recursive: true, force: true });
		expect(loadExtensions(TEST_ROOT)).toEqual([]);
	});
});

describe("getEnabledExtensions", () => {
	it("only returns enabled extensions", () => {
		writeFileSync(join(EXT_DIR, "a.json"), JSON.stringify({ ...validManifest, name: "a" }));
		writeFileSync(join(DIS_DIR, "b.json"), JSON.stringify({ ...validManifest, name: "b" }));

		const enabled = getEnabledExtensions(TEST_ROOT);
		expect(enabled).toHaveLength(1);
		expect(enabled[0].manifest.name).toBe("a");
	});
});

describe("enable/disable", () => {
	it("disables an enabled extension", () => {
		writeFileSync(join(EXT_DIR, "x.json"), JSON.stringify({ ...validManifest, name: "x" }));
		expect(isEnabled(TEST_ROOT, "x")).toBe(true);

		disableExtension(TEST_ROOT, "x");
		expect(isEnabled(TEST_ROOT, "x")).toBe(false);
	});

	it("enables a disabled extension", () => {
		writeFileSync(join(DIS_DIR, "y.json"), JSON.stringify({ ...validManifest, name: "y" }));
		expect(isEnabled(TEST_ROOT, "y")).toBe(false);

		enableExtension(TEST_ROOT, "y");
		expect(isEnabled(TEST_ROOT, "y")).toBe(true);
	});
});
