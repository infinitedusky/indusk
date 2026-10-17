// clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced
//
// a-new-project-starts-instrumented, Build Phase 1: T10 - what the scaffold does with one
// file, decided from what is on disk, what InDusk recorded writing there and the newer
// rendering. A file whose content is not what InDusk recorded is never overwritten.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decideFile } from "./plan.js";

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
