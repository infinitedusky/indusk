// clause: a-plan-is-found-in-the-archive/one-lookup
// promise: a-plan-is-found-in-the-archive
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveImplPath } from "./impl-parser.js";

it("T2 the impl of a plan that has been archived is found by name", () => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "impl-archive-")));
	const dir = join(root, ".indusk", "planning", "archive", "p");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "impl.md"), "---\ntitle: p\nstatus: completed\n---\n\n# p\n");
	expect(resolveImplPath(root, "p")).toBe(join(dir, "impl.md"));
});
