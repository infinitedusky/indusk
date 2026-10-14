// promise: a-plan-page-shows-the-parts-of-its-brief
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type DevServer,
  makeHome,
  startNextDev,
} from "@/__tests__/helpers/next-dev";

/**
 * cockpit-redraw A10 — every screen this plan names reads approved, and the
 * running admin holds it by value at each reference device, in a real browser.
 * A contract with Next, the built Storybook and Chromium, so the system tier
 * (`vitest.tiers.ts` `SYSTEM`; lesson: everyday-tests-never-wait).
 *
 * The project is this repository itself, registered as `dusk` in a throwaway
 * registry: the screens declare their pages under `/p/dusk/...`. A named
 * screen that the check never opened fails (`was never checked`) rather than
 * passing by omission.
 */

const ADMIN = resolve(__dirname, "../..");
const REPO = resolve(ADMIN, "../..");
const SCREENS = [
  "nav.expanded",
  "nav.wide",
  "brief.writing",
  "brief.approved",
  "plan.parts",
  "plan.working",
  "plan.needs-you",
  "plan.released",
];
const STORIES = ["nav-handle.default", "nav-handle.dragging"];

let server: DevServer;

beforeAll(async () => {
  if (!existsSync(join(ADMIN, "public/storybook/iframe.html"))) {
    const built = spawnSync("pnpm", ["run", "build:storybook"], {
      cwd: ADMIN,
      encoding: "utf-8",
      timeout: 570_000,
    });
    expect(built.status, built.stderr).toBe(0);
  }
  server = await startNextDev({
    home: makeHome([{ name: "dusk", path: REPO }]),
  });
}, 600_000);

afterAll(async () => {
  await server?.stop();
});

describe("A10 — cockpit-redraw's screens are approved and held", () => {
  it("A10 every screen cockpit-redraw names is approved and held by value", async () => {
    const { readAppLooks } = await import(
      "@infinitedusky/indusk-mcp/looks/overview"
    );
    const { readApp } = await import("@infinitedusky/indusk-mcp/looks/mockups");
    const { readApprovals, readStoryApprovals } = await import(
      "@infinitedusky/indusk-mcp/looks/approvals"
    );
    const { checkApp } = await import("@infinitedusky/indusk-mcp/looks/check");

    const read = await readAppLooks(REPO, "admin");
    if ("problem" in read) throw new Error(read.problem);
    for (const n of SCREENS)
      expect(read.mockups.find((m) => m.name === n)?.approval, n).toBe(
        "approved",
      );
    for (const n of STORIES)
      expect(read.stories.find((s) => s.name === n)?.approval, n).toBe(
        "approved",
      );

    const whole = await readApp(REPO, "admin");
    const named = [...SCREENS, ...STORIES];
    // Open only what this plan names: the whole admin is held at landing by
    // `indusk looks check admin`, and opening every look here would be that
    // run again inside a test.
    const app = {
      ...whole,
      screens: whole.screens
        .map((sc) => ({
          ...sc,
          states: sc.states.filter((st) =>
            SCREENS.includes(`${sc.name}.${st}`),
          ),
        }))
        .filter((sc) => sc.states.length > 0),
      stories: whole.stories.filter((st) => STORIES.includes(st.name)),
    };
    const { results, unchecked } = await checkApp(
      app,
      readApprovals(app),
      server.url,
      readStoryApprovals(app),
    );
    const of = (r: { screen: string; state: string }) =>
      `${r.screen}.${r.state}`;
    for (const n of named)
      expect(
        results.some((r) => of(r) === n),
        `${n} was never checked`,
      ).toBe(true);
    expect(
      results.filter(
        (r) => named.includes(of(r)) && r.verdict.state === "broken",
      ),
    ).toEqual([]);
    expect(
      unchecked.filter(
        (u) =>
          named.includes(u.mockup) ||
          STORIES.some((s) => u.mockup === `story ${s}`),
      ),
    ).toEqual([]);
  }, 580_000);
});
