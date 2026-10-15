// promise: a-mockup-is-approved-by-a-person
// promise: every-part-of-the-ui-is-covered
// promise: mockups-render-in-the-cockpit
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveRequest,
  attrOf,
  base,
  demo,
  foundationHash,
  git,
  looksPage,
  mockupHash,
  PERSON,
  PROJECT,
  RECORD,
  root,
  rowOf,
  sectionOf,
  setUpProject,
  sha256,
  shown,
  tearDownProject,
} from "@/__tests__/helpers/looks-page";
import { POST as approveRoute } from "@/app/api/looks/[app]/approve/route";

/**
 * ui-promises A1 (the cockpit's half), A2, A13, A14: the Looks page over the
 * package's looks fixture, read for real — a copy in a git repository on
 * `main`, registered in a temporary InDusk home — and Approve through its
 * route, which writes and commits the record there. Node, not the browser
 * project: the page and the route read and write files through the package,
 * which a browser cannot, and a mock of them would prove only the wiring.
 * The page is rendered to markup; the frame at a device's size is a browser's
 * to measure (A15, A16 — `looks-browser.contract.test.ts`, the system tier).
 *
 * The fixture (`apps/indusk-mcp/src/__tests__/fixtures/looks-app`):
 * `home.empty` approved, `home.full` proposed (its entry is for a stale
 * hash), `detail.default` drawn and never approved, `badge` rendered by the
 * app and shown by no mockup; devices `phone` and `desktop`.
 *
 * A29 and A30, the approve route's half, are in `looks-approve-binding.test.tsx`;
 * the fixture project and the page and request helpers are in `__tests__/helpers/looks-page.ts`.
 *
 * What the rows read:
 *   - a mockup:    `[data-testid="mockup-row"][data-mockup="<name>"]` with
 *                  `data-approval="approved|proposed"`
 *   - a device:    `a[data-testid="device-link"][data-device="<name>"]` inside it
 *   - uncovered:   `[data-testid="uncovered"]` holding one
 *                  `[data-testid="uncovered-item"][data-name="<name>"]` each
 */

beforeEach(setUpProject);
afterEach(tearDownProject);

describe("A1 — a mockup an agent drew reads proposed in the cockpit, and nothing is checked against it", () => {
  it("A1 home.full reads proposed; home.empty, approved, reads approved", async () => {
    const html = await looksPage();
    const full = rowOf(html, "home.full");
    expect(attrOf(full, "data-approval")).toBe("proposed");
    expect(full).toContain("proposed");
    expect(full, "a proposed mockup shows no check result").not.toMatch(
      /\b(held|broken)\b/,
    );
    expect(attrOf(rowOf(html, "home.empty"), "data-approval")).toBe("approved");
  });
});

describe("A2 — Approve in the cockpit makes a mockup the reference, recording who and when", () => {
  it("A2 approving home.full appends an entry bound to its hashes, by the person, committed on main; it then reads approved", async () => {
    const before = git("rev-parse", "main");
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: mockupHash("home.full"),
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);

    const entries = JSON.parse(readFileSync(join(root, RECORD), "utf-8"))
      .approvals as Array<Record<string, string>>;
    const entry = entries.at(-1);
    expect(entry).toMatchObject({
      mockup: "home.full",
      mockupHash: sha256(
        join(root, ".indusk/mockups/demo/screens/home.full.html"),
      ),
      foundationHash: foundationHash(),
      by: PERSON,
    });
    expect(Date.parse(entry?.at ?? "")).not.toBeNaN();
    expect(git("rev-parse", "main")).not.toBe(before);
    expect(git("show", "--name-only", "--format=", "main")).toBe(RECORD);

    const html = await looksPage();
    const full = rowOf(html, "home.full");
    expect(attrOf(full, "data-approval")).toBe("approved");
    expect(full).toContain(PERSON);
  });

  it("A2 an approval of a foundation other than the one on main is refused, and the record is unchanged", async () => {
    const before = readFileSync(join(root, RECORD), "utf-8");
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: mockupHash("home.full"),
        foundationHash: "0".repeat(64),
      }),
      demo,
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /foundation/,
    );
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });
});

describe("A2 — approval happens in the checkout the plan is worked in, never through main", () => {
  /** A plan worktree on `plan/looks` holding a mockup `main` does not, assigned to the plan. */
  function planWorktree(): string {
    const tree = join(base, "proj-plan");
    git("worktree", "add", "-q", "-b", "plan/looks", tree);
    const screens = ".indusk/mockups/demo/screens";
    cpSync(
      join(tree, screens, "detail.default.html"),
      join(tree, screens, "settings.default.html"),
    );
    execFileSync("git", ["add", "-A"], { cwd: tree });
    execFileSync("git", ["commit", "-qm", "a mockup only the plan holds"], {
      cwd: tree,
    });
    writeFileSync(
      join(root, ".git", "indusk-plan-worktrees.json"),
      `${JSON.stringify({
        version: 1,
        assignments: [
          {
            plan: "looks",
            path: tree,
            branch: "plan/looks",
            at: new Date().toISOString(),
          },
        ],
      })}\n`,
    );
    return tree;
  }

  it("A2 the page reads the plan's worktree when asked, and Approve commits on the plan's branch, leaving main as it was", async () => {
    const tree = planWorktree();
    const mainBefore = git("rev-parse", "main");

    expect(await looksPage()).not.toContain('data-mockup="settings.default"');
    const html = await looksPage({ checkout: "looks" });
    expect(attrOf(rowOf(html, "settings.default"), "data-approval")).toBe(
      "proposed",
    );
    expect(html).toContain('data-testid="looks-checkouts"');

    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "settings.default",
        mockupHash: mockupHash("settings.default", tree),
        foundationHash: sha256(
          join(tree, ".indusk/mockups/demo/foundation.tokens.json"),
        ),
        checkout: "looks",
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);

    const onBranch = execFileSync(
      "git",
      ["show", "--name-only", "--format=", "HEAD"],
      {
        cwd: tree,
        encoding: "utf-8",
      },
    ).trim();
    expect(onBranch).toBe(RECORD);
    expect(git("rev-parse", "main")).toBe(mainBefore);
    const after = await looksPage({ checkout: "looks" });
    expect(attrOf(rowOf(after, "settings.default"), "data-approval")).toBe(
      "approved",
    );
  });

  it("the page says which checkout it reads and how many looks are proposed in each", async () => {
    planWorktree();
    const proposedIn = (html: string) =>
      html.match(/data-select-mockup/g)?.length ?? 0;
    const own = await looksPage();
    const plan = await looksPage({ checkout: "looks" });
    // the plan's worktree holds one proposed look the project's own does not
    expect(proposedIn(plan)).toBe(proposedIn(own) + 1);

    const reading = (html: string) =>
      sectionOf(html, "looks-reading").replace(/<[^>]*>/g, "");
    expect(reading(own)).toContain("project checkout");
    expect(reading(own)).toContain(`${proposedIn(own)} proposed`);
    expect(reading(plan)).toContain("Reading Looks");
    expect(reading(plan)).not.toContain("plan looks");
    expect(reading(plan)).toContain(`${proposedIn(plan)} proposed`);

    // each checkout in the choice carries its own count
    const choice = sectionOf(own, "looks-checkouts").replace(/<[^>]*>/g, "");
    expect(choice).toContain(`project checkout`);
    expect(choice).toContain(`${proposedIn(own)} proposed`);
    expect(choice).toContain(`Looks · ${proposedIn(plan)} proposed`);
  });

  it("A2 a plan with no worktree holding mockups is refused, and so is a mockup the own checkout lacks", async () => {
    planWorktree();
    const hash = foundationHash();
    const unknown = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: mockupHash("home.full"),
        foundationHash: hash,
        checkout: "nope",
      }),
      demo,
    );
    expect(unknown.status).toBe(404);
    const missing = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "settings.default",
        mockupHash: "0".repeat(64),
        foundationHash: hash,
      }),
      demo,
    );
    expect(missing.status).toBe(409);
  });
});

describe("A2 — group approval records one entry per mockup, each as the person", () => {
  it("A2 only a proposed mockup has a checkbox; approving several records each bound to its own hash", async () => {
    const html = await looksPage();
    expect(rowOf(html, "home.full")).toContain("data-select-mockup");
    expect(rowOf(html, "detail.default")).toContain("data-select-mockup");
    expect(rowOf(html, "home.empty")).not.toContain("data-select-mockup");
    expect(html).toContain('data-testid="approve-selected"');

    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockups: [shown("home.full"), shown("detail.default")],
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ mockup: string; approved: boolean }>;
    };
    expect(body.results.map((r) => [r.mockup, r.approved])).toEqual([
      ["home.full", true],
      ["detail.default", true],
    ]);

    const entries = JSON.parse(readFileSync(join(root, RECORD), "utf-8"))
      .approvals as Array<Record<string, string>>;
    const mine = (name: string) =>
      entries.filter((e) => e.mockup === name).at(-1);
    expect(mine("home.full")).toMatchObject({
      by: PERSON,
      mockupHash: sha256(
        join(root, ".indusk/mockups/demo/screens/home.full.html"),
      ),
    });
    expect(mine("detail.default")).toMatchObject({
      by: PERSON,
      mockupHash: sha256(
        join(root, ".indusk/mockups/demo/screens/detail.default.html"),
      ),
    });
    expect(git("log", "--format=%s", "-2")).toMatch(/approved by/);
  });

  it("A2 one refused mockup does not undo the others, and is named", async () => {
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockups: [
          shown("home.full"),
          { mockup: "nope", mockupHash: "0".repeat(64) },
        ],
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(200);
    const { results } = (await res.json()) as {
      results: Array<{ mockup: string; approved: boolean; reason?: string }>;
    };
    expect(results.find((r) => r.mockup === "home.full")?.approved).toBe(true);
    const refused = results.find((r) => r.mockup === "nope");
    expect(refused?.approved).toBe(false);
    expect(refused?.reason).toMatch(/no mockup/);
  });
});

describe("A13 — an uncovered part shows uncovered, never held", () => {
  it("A13 detail (drawn, never approved) and badge (rendered, in no mockup) are listed under Uncovered", async () => {
    const html = await looksPage();
    const uncovered = sectionOf(html, "uncovered");
    const names = [
      ...uncovered.matchAll(
        /data-testid="uncovered-item"[^>]*data-name="([^"]*)"/g,
      ),
    ].map((m) => m[1]);
    expect(names).toEqual(expect.arrayContaining(["detail", "badge"]));
    expect(uncovered, "nothing uncovered reads held").not.toMatch(/\bheld\b/);
    expect(attrOf(rowOf(html, "detail.default"), "data-approval")).toBe(
      "proposed",
    );
  });
});

describe("the Looks page says which of its states it drew, for the look check", () => {
  it("reports looks.uncovered while any part is uncovered", async () => {
    const html = await looksPage();
    const section = html.match(/<section[^>]*data-testid="looks"[^>]*>/)?.[0];
    expect(attrOf(section ?? "", "data-look-state")).toBe("looks.uncovered");
  });
});

describe("A14 — each mockup, proposed or approved, opens at the app's reference devices", () => {
  it("A14 every mockup row offers phone and desktop, each a link that opens it there", async () => {
    const html = await looksPage();
    for (const mockup of ["home.empty", "home.full", "detail.default"]) {
      const row = rowOf(html, mockup);
      const devices = [
        ...row.matchAll(/<a[^>]*data-testid="device-link"[^>]*>/g),
      ].map((m) => ({
        device: attrOf(m[0], "data-device"),
        href: attrOf(m[0], "href")?.replaceAll("&amp;", "&") ?? "",
      }));
      expect(devices.map((d) => d.device)).toEqual(["phone", "desktop"]);
      for (const d of devices) {
        expect(d.href).toContain(`mockup=${mockup}`);
        expect(d.href).toContain(`device=${d.device}`);
      }
    }
  });

  it("A14 opening a mockup at a device draws it in a frame of that device's size", async () => {
    const html = await looksPage({
      app: "demo",
      mockup: "home.full",
      device: "phone",
    });
    const frame = html.match(
      /<iframe[^>]*data-testid="mockup-frame"[^>]*>/,
    )?.[0];
    expect(frame).toBeDefined();
    expect(attrOf(frame ?? "", "width")).toBe("390");
    expect(attrOf(frame ?? "", "height")).toBe("844");
  });
});

describe("the list puts the looks waiting for a person first, or shows only them", () => {
  /** The mockups' names in the order the page lists them, with their approval. */
  const listed = (html: string) =>
    [
      ...html.matchAll(
        /data-testid="mockup-row"[^>]*data-mockup="([^"]*)"[^>]*data-approval="([^"]*)"/g,
      ),
    ].map((m) => [m[1], m[2]]);

  it("lists proposed mockups before approved ones", async () => {
    const approvals = listed(await looksPage()).map(([, a]) => a);
    expect(approvals).toContain("proposed");
    expect(approvals).toContain("approved");
    expect(approvals.lastIndexOf("proposed")).toBeLessThan(
      approvals.indexOf("approved"),
    );
  });

  it("Show: Unapproved lists only the proposed mockups, and still lists what is uncovered", async () => {
    const html = await looksPage({ show: "unapproved" });
    const approvals = listed(html).map(([, a]) => a);
    expect(approvals.length).toBeGreaterThan(0);
    expect(approvals.every((a) => a === "proposed")).toBe(true);
    expect(html).toContain('data-testid="uncovered"');
  });

  it("offers Unapproved beside All, Mockups and Components, and keeps it when another choice is made", async () => {
    const html = await looksPage({ show: "unapproved" });
    expect(sectionOf(html, "looks-show")).toContain("Unapproved");
    expect(html).toMatch(/href="[^"]*show=unapproved[^"]*view=cascade/);
  });
});
