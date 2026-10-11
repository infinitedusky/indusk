// promise: a-mockup-is-approved-by-a-person
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as approveRoute } from "@/app/api/looks/[app]/approve/route";
import {
  approveRequest,
  attrOf,
  demo,
  foundationHash,
  looksPage,
  mockupHash,
  PROJECT,
  RECORD,
  root,
  rowOf,
  setUpProject,
  tearDownProject,
} from "./looks-test-helpers";

/**
 * ui-promises A29 and A30, the approve route's half: the route answers only a
 * browser on the admin's own page (fetch metadata), and an approval binds the
 * mockup the person was shown, as it binds the foundation. Over the same
 * fixture project as `looks.test.tsx`, node project, the route read and
 * written for real.
 */

beforeEach(setUpProject);
afterEach(tearDownProject);

describe("A29 — the approve route answers only a browser on the admin's own page", () => {
  it("A29 a POST that sets Host and Origin itself but carries no fetch metadata is refused, and nothing is written", async () => {
    const before = readFileSync(join(root, RECORD), "utf-8");
    const body = {
      project: PROJECT,
      mockup: "home.full",
      mockupHash: mockupHash("home.full"),
      foundationHash: foundationHash(),
    };
    for (const fetchSite of [null, "cross-site", "same-site", "none"]) {
      const res = await approveRoute(approveRequest(body, { fetchSite }), demo);
      expect(res.status, `Sec-Fetch-Site: ${fetchSite}`).toBe(403);
    }
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });
});

describe("A30 — an approval binds the mockup the person was shown", () => {
  it("A30 approving a mockup changed since the page showed it is refused, naming both hashes", async () => {
    const shownHash = mockupHash("home.full");
    const file = join(root, ".indusk/mockups/demo/screens/home.full.html");
    writeFileSync(
      file,
      `${readFileSync(file, "utf-8")}<!-- changed after the page read it -->\n`,
    );
    const before = readFileSync(join(root, RECORD), "utf-8");
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: shownHash,
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(409);
    const { error } = (await res.json()) as { error: string };
    expect(error).toContain(shownHash.slice(0, 8));
    expect(error).toContain(mockupHash("home.full").slice(0, 8));
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });

  it("A30 an approval that names no mockup hash is refused", async () => {
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(400);
  });

  it("A30 the page carries each proposed mockup's hash beside its checkbox, for a group approval", async () => {
    const html = await looksPage();
    const box =
      rowOf(html, "home.full").match(
        /<input[^>]*data-select-mockup[^>]*>/,
      )?.[0] ?? "";
    expect(attrOf(box, "data-mockup-hash")).toBe(mockupHash("home.full"));
  });
});
