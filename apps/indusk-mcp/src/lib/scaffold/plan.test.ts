// clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced
//
// a-new-project-starts-instrumented, Build Phase 1: T10 - what the scaffold does with one
// file, decided from what is on disk, what InDusk recorded writing there and the newer
// rendering. A file whose content is not what InDusk recorded is never overwritten.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decideFile, scaffoldPlan } from "./plan.js";

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const NEW = "rendered v2";

describe("what the scaffold does with one file", () => {
	it.each([
		[{ current: null, recorded: null }, "create"],
		[{ current: null, recorded: h("rendered v1") }, "create"],
		[{ current: "rendered v1", recorded: h("rendered v1") }, "refresh"],
		[{ current: NEW, recorded: h(NEW) }, "refresh"],
		[{ current: NEW, recorded: h("rendered v1") }, "record"],
		[{ current: "edited", recorded: h("rendered v1") }, "beside"],
		[{ current: NEW, recorded: null }, "record"],
		[{ current: "someone else's", recorded: null }, "beside"],
	] as const)("T10: %j → %s", (file, action) => {
		expect(decideFile({ ...file, rendered: NEW }).action).toBe(action);
	});
	it("T10: never overwrites a file whose content is not what InDusk recorded", () => {
		for (const current of ["edited", "", "rendered v2 plus a line"]) {
			expect(decideFile({ current, recorded: h("rendered v1"), rendered: NEW }).action).not.toBe(
				"refresh",
			);
		}
	});
});

describe("the scaffold for a target, from what was read", () => {
	const target = (files: Record<string, string>) => ({
		name: "homework-gate",
		rel: "",
		exists: true,
		present: (f: string) => f in files,
		hasSrc: false,
		current: (p: string) => files[p] ?? null,
	});
	const reads = (record: Record<string, string>) => ({
		record,
		force: false,
		render: (template: string, service: string) => `${template} for ${service}`,
	});

	it("a target with no app marker gets no files; one with a package file gets the Node files", () => {
		expect(scaffoldPlan([target({ "README.md": "" })], reads({}))[0]?.runtime).toBeNull();
		const [node] = scaffoldPlan([target({ "package.json": "{}" })], reads({}));
		expect(node?.runtime).toBe("node");
		expect(node?.files.map((f) => [f.path, f.action])).toContainEqual([
			"instrumentation.ts",
			"create",
		]);
	});

	it("a recorded file already at the newest rendering is a refresh that changes nothing", () => {
		const rendered = "instrumentation.ts for homework-gate";
		const [node] = scaffoldPlan(
			[target({ "package.json": "{}", "instrumentation.ts": rendered })],
			reads({ "instrumentation.ts": h(rendered) }),
		);
		const file = node?.files.find((f) => f.path === "instrumentation.ts");
		expect(file).toMatchObject({ action: "refresh", current: true });
	});
});
