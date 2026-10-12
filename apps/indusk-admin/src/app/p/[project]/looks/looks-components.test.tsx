// promise: mockups-render-in-the-cockpit — the components list and a story's frame.
// promise: a-mockup-is-approved-by-a-person — a story is approved by its snapshot hash,
// and a person takes an approval back (A29); the story frame is the snapshot a person
// approves, drawn from the selected checkout (A35).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readAppLooks } from "@infinitedusky/indusk-mcp/looks/overview";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveRequest,
  attrOf,
  base,
  demo,
  foundationHash,
  git,
  looksPage,
  PROJECT,
  RECORD,
  root,
  sectionOf,
  setUpComponentsProject,
  sha256,
  tearDownProject,
} from "@/__tests__/helpers/looks-page";
import { POST as approveRoute } from "@/app/api/looks/[app]/approve/route";

/**
 * storybook-components Build Phase 4, in the node project: what the Looks page
 * lists for an app's components and how a story is framed and approved. The
 * browser half — the frame's size, the composed mockup in Chromium — is
 * `looks-components.contract.test.ts`'s.
 */

const CATALOG = ".indusk/mockups/demo/components.json";
const snapshot = (name: string) =>
  join(root, `.indusk/mockups/demo/components/${name}.html`);
/** The badge's stylesheet hash, which a story's Approve sends with its snapshot's. */
const sheet = () =>
  sha256(join(root, ".indusk/mockups/demo/components/badge.css"));
const edit = (file: string) =>
  writeFileSync(file, `${readFileSync(file, "utf-8")}<!-- edited -->\n`);

beforeEach(() => {
  setUpComponentsProject();
  // The render step wrote no Storybook ids in this fixture's catalog.
  const catalog = JSON.parse(readFileSync(join(root, CATALOG), "utf-8"));
  for (const state of catalog.components[0].states) {
    state.id = `components-badge--${state.name}`;
  }
  writeFileSync(join(root, CATALOG), JSON.stringify(catalog, null, "\t"));
});
afterEach(tearDownProject);

/** The opening tag of a story's row. */
function rowOf(html: string, story: string): string {
  const start = html.indexOf(`data-story="${story}"`);
  expect(start, `no row for ${story}`).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<", start), html.indexOf(">", start));
}

describe("the components list", () => {
  it("lists each story under its component with its approval", async () => {
    const html = await looksPage();
    expect(attrOf(rowOf(html, "badge.ok"), "data-approval")).toBe("approved");
    expect(attrOf(rowOf(html, "badge.broken"), "data-approval")).toBe(
      "proposed",
    );
    expect(html).toContain('data-name="badge"');
  });

  it("shows a story approved once and changed since as changed", async () => {
    edit(snapshot("badge.ok"));
    const html = await looksPage();
    expect(attrOf(rowOf(html, "badge.ok"), "data-state")).toBe("changed");
  });
});

describe("what is shown: mockups, components, or both", () => {
  const stories = (html: string) => html.includes('data-testid="story-row"');
  const mockups = (html: string) => html.includes('data-testid="mockup-row"');

  it("draws both by default, and each alone on request", async () => {
    const both = await looksPage();
    expect(mockups(both) && stories(both)).toBe(true);

    const onlyMockups = await looksPage({ show: "mockups" });
    expect(mockups(onlyMockups)).toBe(true);
    expect(stories(onlyMockups)).toBe(false);

    const onlyComponents = await looksPage({ show: "components" });
    expect(stories(onlyComponents)).toBe(true);
    expect(mockups(onlyComponents)).toBe(false);
  });

  it("draws the same choice in the cascade", async () => {
    const onlyComponents = await looksPage({
      show: "components",
      view: "cascade",
    });
    expect(onlyComponents).toContain('data-testid="cascade-components"');
    expect(onlyComponents).not.toContain('data-testid="cascade-mockups"');
  });

  it("keeps show, view and checkout when another choice is made", async () => {
    const html = await looksPage({ show: "components", view: "cascade" });
    expect(html).toMatch(/href="[^"]*show=components[^"]*view=cascade/);
  });
});

describe("a story opened", () => {
  it("is framed from its snapshot's document (Build Phase 9, A35), with Approve while it is proposed", async () => {
    const html = await looksPage({
      app: "demo",
      story: "badge.broken",
      device: "phone",
    });
    expect(html).toContain('data-testid="story-frame"');
    expect(html).toContain(
      'data-testid="story-frame" title="badge.broken" srcDoc="',
    );
    expect(html).not.toContain('src="/storybook/iframe.html');
    expect(html).toContain('width="390"');
    expect(html).toContain('data-testid="approve-story"');
  });

  it("offers no Approve on a story already approved", async () => {
    const html = await looksPage({
      app: "demo",
      story: "badge.ok",
      device: "phone",
    });
    expect(html).toContain('data-testid="story-frame"');
    expect(html).not.toContain('data-testid="approve-story"');
  });
});

describe("approving a story", () => {
  const story = (name: string, snapshotHash: string) =>
    approveRequest({
      project: PROJECT,
      kind: "story",
      story: name,
      snapshotHash,
      stylesheetHash: sheet(),
      foundationHash: foundationHash(),
    });

  it("records an entry bound to the snapshot hash the page showed", async () => {
    const shown = sha256(snapshot("badge.broken"));
    const res = await approveRoute(story("badge.broken", shown), demo);
    expect(res.status).toBe(200);
    const record = JSON.parse(readFileSync(join(root, RECORD), "utf-8"));
    expect(record.approvals.at(-1)).toMatchObject({
      kind: "story",
      story: "badge.broken",
      snapshotHash: shown,
    });
  });

  it("approves a group of stories each on its own hash: one refused does not undo the ones recorded", async () => {
    const shownHash = sha256(snapshot("badge.broken"));
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        stories: [
          {
            story: "badge.broken",
            snapshotHash: shownHash,
            stylesheetHash: sheet(),
          },
          {
            story: "badge.ok",
            snapshotHash: "not-what-was-shown",
            stylesheetHash: sheet(),
          },
        ],
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(
      results.map((r: { mockup: string; approved: boolean }) => [
        r.mockup,
        r.approved,
      ]),
    ).toEqual([
      ["badge.broken", true],
      ["badge.ok", false],
    ]);
    const record = JSON.parse(readFileSync(join(root, RECORD), "utf-8"));
    expect(record.approvals.at(-1)).toMatchObject({
      kind: "story",
      story: "badge.broken",
      snapshotHash: shownHash,
    });
  });

  it("offers a checkbox on each proposed story, carrying the snapshot hash it drew", async () => {
    const html = await looksPage({ show: "components" });
    const row = rowOf(html, "badge.broken");
    expect(html.slice(html.indexOf(row))).toContain("data-select-story");
    expect(html).toContain(
      `data-snapshot-hash="${sha256(snapshot("badge.broken"))}"`,
    );
  });

  it("refuses a snapshot changed since the page showed it, and one sent without its hash", async () => {
    const shown = sha256(snapshot("badge.broken"));
    edit(snapshot("badge.broken"));
    const before = readFileSync(join(root, RECORD), "utf-8");
    const stale = await approveRoute(story("badge.broken", shown), demo);
    expect(stale.status).toBe(409);
    const missing = await approveRoute(
      approveRequest({
        project: PROJECT,
        kind: "story",
        story: "badge.broken",
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(missing.status).toBe(400);
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });
});

describe("A29 — Unapprove is offered on what is approved, never on what is proposed", () => {
  /** From the opening of the element carrying `marker` to the next one of its kind. */
  const segmentOf = (html: string, marker: string, testId: string): string => {
    const at = html.indexOf(marker);
    expect(at, `no ${marker}`).toBeGreaterThan(-1);
    const next = html.indexOf(`data-testid="${testId}"`, at + marker.length);
    return html.slice(at, next === -1 ? undefined : next);
  };

  /** The composed hash and the components' hash the page holds for a mockup. */
  async function mockupHashes(name: string) {
    const looks = await readAppLooks(root, "demo");
    if ("problem" in looks) throw new Error(looks.problem);
    const m = looks.mockups.find((x) => x.name === name);
    if (!m) throw new Error(`no mockup ${name}`);
    return { hash: m.hash, componentsHash: m.componentsHash };
  }

  it("an approved story opened offers Unapprove carrying its snapshot hash; a proposed one does not", async () => {
    const approved = sectionOf(
      await looksPage({ app: "demo", story: "badge.ok", device: "phone" }),
      "story-open",
    );
    const at = approved.indexOf('data-testid="unapprove-story"');
    expect(at, "no Unapprove on an approved story").toBeGreaterThan(-1);
    const tag = approved.slice(approved.lastIndexOf("<", at));
    expect(attrOf(tag.slice(0, tag.indexOf(">")), "data-snapshot-hash")).toBe(
      sha256(snapshot("badge.ok")),
    );
    expect(approved).not.toContain('data-testid="approve-story"');

    const proposed = sectionOf(
      await looksPage({ app: "demo", story: "badge.broken", device: "phone" }),
      "story-open",
    );
    expect(proposed).toContain('data-testid="approve-story"');
    expect(proposed).not.toContain('data-testid="unapprove-story"');
  });

  it("an approved mockup opened offers Unapprove carrying the hashes it drew; a proposed one does not", async () => {
    const approved = sectionOf(
      await looksPage({ app: "demo", mockup: "home.default", device: "phone" }),
      "mockup-open",
    );
    const at = approved.indexOf('data-testid="unapprove-mockup"');
    expect(at, "no Unapprove on an approved mockup").toBeGreaterThan(-1);
    const tag = approved.slice(approved.lastIndexOf("<", at));
    const open = tag.slice(0, tag.indexOf(">"));
    const shown = await mockupHashes("home.default");
    expect(attrOf(open, "data-mockup-hash")).toBe(shown.hash);
    expect(attrOf(open, "data-components-hash")).toBe(shown.componentsHash);
    expect(approved).not.toContain('data-testid="approve-mockup"');

    const proposed = sectionOf(
      await looksPage({ app: "demo", mockup: "home.empty", device: "phone" }),
      "mockup-open",
    );
    expect(proposed).toContain('data-testid="approve-mockup"');
    expect(proposed).not.toContain('data-testid="unapprove-mockup"');
  });

  it("the list offers it on an approved story row and an approved mockup row, and on no proposed one", async () => {
    const html = await looksPage();
    const row = (story: string) =>
      segmentOf(html, `data-story="${story}"`, "story-row");
    expect(row("badge.ok")).toContain('data-testid="unapprove-story"');
    expect(row("badge.broken")).not.toContain('data-testid="unapprove-story"');
    const mockup = (name: string) =>
      segmentOf(html, `data-mockup="${name}"`, "mockup-row");
    expect(mockup("home.default")).toContain('data-testid="unapprove-mockup"');
    expect(mockup("home.empty")).not.toContain(
      'data-testid="unapprove-mockup"',
    );
  });

  it("the cascade offers it beside each approved look, and on no proposed one", async () => {
    const html = await looksPage({ view: "cascade" });
    const item = (marker: string) => segmentOf(html, marker, "cascade-item");
    expect(item('data-story="badge.ok"')).toContain(
      'data-testid="unapprove-story"',
    );
    expect(item('data-story="badge.broken"')).not.toContain(
      'data-testid="unapprove-story"',
    );
    expect(item('data-mockup="home.default"')).toContain(
      'data-testid="unapprove-mockup"',
    );
    expect(item('data-mockup="home.empty"')).not.toContain(
      'data-testid="unapprove-mockup"',
    );
  });
});

describe("the components list puts stories waiting for a person first, or shows only them", () => {
  const order = (html: string) =>
    [
      ...html.matchAll(
        /data-testid="story-row"[^>]*data-story="([^"]*)"[^>]*data-approval="([^"]*)"/g,
      ),
    ].map((m) => [m[1], m[2]]);

  it("lists the proposed story before the approved one", async () => {
    const rows = order(await looksPage({ show: "components" }));
    expect(rows.map(([name]) => name).indexOf("badge.broken")).toBeLessThan(
      rows.map(([name]) => name).indexOf("badge.ok"),
    );
  });

  it("Show: Unapproved lists the proposed story and not the approved one", async () => {
    const rows = order(await looksPage({ show: "unapproved" }));
    expect(rows.map(([name]) => name)).toContain("badge.broken");
    expect(rows.map(([name]) => name)).not.toContain("badge.ok");
  });

  it("the cascade shows the same choice", async () => {
    const html = await looksPage({ show: "unapproved", view: "cascade" });
    expect(html).toContain('data-story="badge.broken"');
    expect(html).not.toContain('data-story="badge.ok"');
  });
});

describe("A35 — the story a person approves is the snapshot they were shown", () => {
  const MARK = "HAND-EDITED-IN-THE-PLAN";

  /** A plan worktree on `plan/looks`, assigned to the plan, whose `badge.broken` snapshot was edited by hand. */
  function planWorktree(): string {
    const tree = join(base, "proj-plan");
    git("worktree", "add", "-q", "-b", "plan/looks", tree);
    // The fixture's catalog carries no Storybook ids; the plan's gets the same ones as main's.
    writeFileSync(join(tree, CATALOG), readFileSync(join(root, CATALOG)));
    const file = join(
      tree,
      ".indusk/mockups/demo/components/badge.broken.html",
    );
    writeFileSync(
      file,
      readFileSync(file, "utf-8").replace(/>([^<]*)</, `>${MARK}<`),
    );
    execFileSync("git", ["add", "-A"], { cwd: tree });
    execFileSync("git", ["commit", "-qm", "a snapshot edited by hand"], {
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

  /** The story frame's opening tag. */
  const frameOf = (html: string): string => {
    const at = html.indexOf('data-testid="story-frame"');
    expect(at, "no story frame").toBeGreaterThan(-1);
    return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1);
  };

  it("A35 the frame loads a document drawn from the selected checkout's snapshot, its component's stylesheet and the foundation's tokens, never the admin's own /storybook build", async () => {
    planWorktree();
    const frame = frameOf(
      await looksPage({
        checkout: "looks",
        app: "demo",
        story: "badge.broken",
        device: "phone",
      }),
    );
    expect(frame, "the hand edit in the plan's checkout is drawn").toContain(
      MARK,
    );
    expect(frame).toContain("data-foundation");
    expect(frame).toContain("data-component-style=&quot;badge&quot;");
    expect(frame, "not the admin's own Storybook build").not.toContain(
      "/storybook/iframe.html",
    );

    // The project's own checkout draws its own snapshot, without the plan's edit.
    const own = frameOf(
      await looksPage({ app: "demo", story: "badge.broken", device: "phone" }),
    );
    expect(own).not.toContain(MARK);
    expect(own).toContain("data-foundation");
  });
});
