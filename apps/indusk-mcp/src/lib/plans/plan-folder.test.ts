// clause: a-plan-is-found-in-the-archive/one-lookup
// clause: a-plan-is-found-in-the-archive/active-first
// promise: a-plan-is-found-in-the-archive
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { planFolder } from "./plan-folder.js";

const project = () => mkdtempSync(join(tmpdir(), "plan-folder-"));

it("T1 the planning folder, else the archive, else none", () => {
	const root = project();
	mkdirSync(join(root, ".indusk/planning/a"), { recursive: true });
	mkdirSync(join(root, ".indusk/planning/archive/b"), { recursive: true });
	expect(planFolder(root, "a")).toBe(join(root, ".indusk/planning/a"));
	expect(planFolder(root, "b")).toBe(join(root, ".indusk/planning/archive/b"));
	expect(planFolder(root, "c")).toBeNull();
});

it("T6 a plan in both places is read from the planning folder", () => {
	const root = project();
	mkdirSync(join(root, ".indusk/planning/a"), { recursive: true });
	mkdirSync(join(root, ".indusk/planning/archive/a"), { recursive: true });
	expect(planFolder(root, "a")).toBe(join(root, ".indusk/planning/a"));
});
