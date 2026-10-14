import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// promise: a-new-project-is-written-only-under-its-parent

/**
 * The route the start page saves "where new projects go" through
 * (new-project-flow Build Phase 7, A35): it keeps the package's own setting,
 * the one `indusk new-project parent` writes, and refuses a path that is not
 * absolute. The session host is stood in for, as the other route tests do.
 */
vi.mock("@/lib/session-host", () => ({
  adminOnly: () => null,
  refuse: (status: number, message: string) =>
    Response.json({ error: message }, { status }),
}));

let home: string;
const previousHome = process.env.INDUSK_HOME;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "new-project-parent-"));
  process.env.INDUSK_HOME = home;
});
afterEach(() => {
  if (previousHome === undefined) delete process.env.INDUSK_HOME;
  else process.env.INDUSK_HOME = previousHome;
  rmSync(home, { recursive: true, force: true });
});

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/new-projects/parent/route");
  return POST(
    new NextRequest("http://127.0.0.1:3996/api/new-projects/parent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
};

describe("the parent route", () => {
  it("saves an absolute folder in the setting the command writes", async () => {
    const dir = join(home, "code");
    const res = await post({ parent: dir });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ parent: dir });
    const saved = JSON.parse(
      readFileSync(join(home, "new-projects.json"), "utf-8"),
    );
    expect(saved.parent).toBe(dir);
  });

  it("refuses a relative path and an empty one, saving nothing", async () => {
    for (const parent of ["code", "", 3]) {
      const res = await post({ parent });
      expect(res.status, String(parent)).toBe(400);
    }
    expect(() => readFileSync(join(home, "new-projects.json"))).toThrow();
  });
});
