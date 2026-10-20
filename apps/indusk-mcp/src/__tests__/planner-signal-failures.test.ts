import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// For: so plans name their failure points from the start (Sandy, 2026-10-19)

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const planner = readFileSync(join(PKG, "skills", "planner.md"), "utf-8");

describe("A106 — the planner asks every way a clause could fail before its signal", () => {
	it("lists failure points under each clause and has the signal cover each", () => {
		expect(planner).toContain("- Fails when:");
		expect(planner).toMatch(/every way it could fail to hold/);
		expect(planner).toMatch(/covering each failure listed/);
	});
});
