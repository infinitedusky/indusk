// promise: a-mockup-is-approved-by-a-person — A34 (a composed mockup needs its componentsHash)
// promise: a-changed-component-reopens-its-mockups — A33 (a group approves stories, then mockups)
// promise: a-mockup-is-approved-by-a-person — A39 (the two routes read a request the same way)
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { withdraw } from "@infinitedusky/indusk-mcp/looks/approve";
import { readAppLooks } from "@infinitedusky/indusk-mcp/looks/overview";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveRequest,
  attrOf,
  demo,
  foundationHash,
  looksPage,
  mockupHash,
  PERSON,
  PROJECT,
  RECORD,
  root,
  rowOf,
  setUpComponentsProject,
  setUpProject,
  sha256,
  tearDownProject,
} from "@/__tests__/helpers/looks-page";
import { POST as approveRoute } from "@/app/api/looks/[app]/approve/route";
import { POST as unapproveRoute } from "@/app/api/looks/[app]/unapprove/route";

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

/**
 * storybook-components Build Phase 9, over the components fixture: the route's
 * half of what a composed mockup's approval binds. A33: a group holding a
 * reopened mockup and the stories it composes records the stories first. A34:
 * a composed mockup sent without its `componentsHash` is refused — the
 * stylesheets it inlines are outside `mockupHash`.
 */
describe("Build Phase 9 — a composed mockup's approval through the route", () => {
  beforeEach(() => {
    tearDownProject();
    setUpComponentsProject();
  });

  const MOCKUPS = ".indusk/mockups/demo";
  const sheetHash = (component: string) =>
    sha256(join(root, MOCKUPS, "components", `${component}.css`));

  /** What the page shows for a mockup and a story: the overview's hashes. */
  async function shownOf(mockup: string) {
    const looks = await readAppLooks(root, "demo");
    if ("problem" in looks) throw new Error(looks.problem);
    const m = looks.mockups.find((x) => x.name === mockup);
    if (!m) throw new Error(`no mockup ${mockup}`);
    return { looks, mockup: m };
  }

  // A33
  it("A33 one group Approve holding a reopened mockup and the stories it composes records the stories, then the mockup: every result is approved", async () => {
    // badge.ok re-rendered: the story and home.default, which composes it, read proposed.
    const snapshot = join(root, MOCKUPS, "components", "badge.ok.html");
    writeFileSync(
      snapshot,
      readFileSync(snapshot, "utf-8").replace(
        "var(--space-2)",
        "var(--space-3)",
      ),
    );
    const { mockup } = await shownOf("home.default");
    expect(mockup.approval).toBe("proposed");

    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockups: [
          {
            mockup: "home.default",
            mockupHash: mockup.hash,
            componentsHash: mockup.componentsHash,
          },
        ],
        stories: [
          {
            story: "badge.ok",
            snapshotHash: sha256(snapshot),
            stylesheetHash: sheetHash("badge"),
          },
        ],
        foundationHash: foundationHash(),
      }),
      demo,
    );
    const { results } = (await res.json()) as {
      results: Array<{ mockup: string; approved: boolean; reason?: string }>;
    };
    expect(
      results.map((r) => [r.mockup, r.approved]),
      JSON.stringify(results),
    ).toEqual([
      ["badge.ok", true],
      ["home.default", true],
    ]);
    expect((await shownOf("home.default")).mockup.approval).toBe("approved");
  });

  // A34
  it("A34 a composed mockup sent with its mockupHash and without its componentsHash is refused, single and in a group, naming the missing hash", async () => {
    const { looks, mockup } = await shownOf("home.default");
    // Taken back first, so an Approve would have something to write.
    const taken = await withdraw(
      root,
      "demo",
      "home.default",
      PERSON,
      "mockup",
      {
        foundationHash: looks.foundationHash,
        mockupHash: mockup.hash,
        componentsHash: mockup.componentsHash,
      },
    );
    expect(taken.withdrawn, JSON.stringify(taken)).toBe(true);
    const before = readFileSync(join(root, RECORD), "utf-8");

    const single = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.default",
        mockupHash: mockup.hash,
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(single.status).toBe(400);
    expect(((await single.json()) as { error: string }).error).toContain(
      "componentsHash",
    );

    const group = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockups: [{ mockup: "home.default", mockupHash: mockup.hash }],
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(group.status).toBe(400);
    expect(((await group.json()) as { error: string }).error).toContain(
      "componentsHash",
    );
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });
});

describe("A39 — the two routes read a request the same way", () => {
  const story = {
    project: PROJECT,
    kind: "story",
    story: "badge.ok",
    foundationHash: "x",
  };

  it("A39 a checkout with no worktree holding mockups is a 404 with the same text from both, a story body without snapshotHash a 400 from both, and neither route looks the checkout up itself", async () => {
    const gone = { ...story, snapshotHash: "x", checkout: "no-such-plan" };
    const a = await approveRoute(approveRequest(gone), demo);
    const u = await unapproveRoute(approveRequest(gone), demo);
    expect(a.status).toBe(404);
    expect(u.status).toBe(404);
    expect(((await u.json()) as { error: string }).error).toBe(
      ((await a.json()) as { error: string }).error,
    );

    for (const route of [approveRoute, unapproveRoute]) {
      const res = await route(approveRequest(story), demo);
      expect(res.status).toBe(400);
    }

    const routes = resolve(__dirname, "../../../api/looks/[app]");
    for (const route of ["approve", "unapprove"]) {
      expect(
        readFileSync(join(routes, route, "route.ts"), "utf-8"),
        `${route} reads its request through ../request`,
      ).not.toMatch(/looksCheckouts|request\.json\(\)/);
    }
  });
});
