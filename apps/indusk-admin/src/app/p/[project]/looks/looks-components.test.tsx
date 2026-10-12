// promise: mockups-render-in-the-cockpit — the components list and a story's frame.
// promise: a-mockup-is-approved-by-a-person — a story is approved by its snapshot hash.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveRequest,
  attrOf,
  demo,
  foundationHash,
  looksPage,
  PROJECT,
  RECORD,
  root,
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
  it("is framed from the admin's own /storybook, with Approve while it is proposed", async () => {
    const html = await looksPage({
      app: "demo",
      story: "badge.broken",
      device: "phone",
    });
    expect(html).toContain('data-testid="story-frame"');
    expect(html).toContain(
      'src="/storybook/iframe.html?id=components-badge--broken&amp;viewMode=story"',
    );
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
