// promise: a-mockup-composes-approved-components — A7.
// promise: mockups-render-in-the-cockpit — A18.

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type DevServer,
  makeHome,
  startNextBuilt,
} from "@/__tests__/helpers/next-dev";

/**
 * storybook-components A7 and A18 — a contract with Next, the built Storybook
 * and Chromium, so the system tier (`vitest.tiers.ts` `SYSTEM`; lesson:
 * everyday-tests-never-wait). What the page offers and approves is
 * `looks.test.tsx`'s; this file asserts only what a browser can say.
 *
 * A7 opens the package's components fixture's `home.default`, which names
 * `badge` in state `ok`, and reads the frame: the element drawn is the
 * snapshot's, not a reference. A18 opens each story of this repo's admin: the
 * frame is the size of its component, and choosing a reference device sets the
 * frame to the device's width — served from the admin's own `/storybook` with
 * no Storybook server.
 */

const ADMIN = resolve(__dirname, "../../../../..");
const REPO = resolve(ADMIN, "../..");
const FIXTURE = resolve(
  ADMIN,
  "../indusk-mcp/src/__tests__/fixtures/components-app",
);
const FIXTURE_PROJECT = "components-fixture";
const REPO_PROJECT = "dusk-repo";

let base: string;
let server: DevServer;
let browser: Browser;

beforeAll(async () => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-looks-components-")));
  const fixtureRoot = join(base, "proj");
  cpSync(FIXTURE, fixtureRoot, { recursive: true });
  // The admin serves its Storybook from `public/storybook`; build it when this
  // checkout has none (it is git-ignored). No Storybook server is started.
  if (!existsSync(join(ADMIN, "public/storybook/iframe.html"))) {
    const built = spawnSync("pnpm", ["run", "build:storybook"], {
      cwd: ADMIN,
      encoding: "utf-8",
    });
    expect(built.status, built.stderr).toBe(0);
  }
  const home = makeHome([
    { name: FIXTURE_PROJECT, path: fixtureRoot },
    { name: REPO_PROJECT, path: REPO },
  ]);
  server = await startNextBuilt({ home });
  browser = await chromium.launch();
}, 400_000);

afterAll(async () => {
  await browser?.close();
  await server?.stop();
  rmSync(base, { recursive: true, force: true });
});

async function goto(page: Page, project: string, query: string) {
  await page.goto(`${server.url}/p/${project}/looks?${query}`, {
    waitUntil: "load",
    timeout: 90_000,
  });
}

describe("A7 — a mockup that names a component shows its approved snapshot", () => {
  it("A7 home.default shows the badge.ok snapshot where it names the badge", async () => {
    const snapshot = readFileSync(
      join(FIXTURE, ".indusk/mockups/demo/components/badge.ok.html"),
      "utf-8",
    );
    const text = snapshot.replace(/<[^>]*>/g, "").trim();
    const page = await browser.newPage();
    try {
      await goto(
        page,
        FIXTURE_PROJECT,
        "app=demo&mockup=home.default&device=phone",
      );
      const frame = page.frameLocator('[data-testid="mockup-frame"]');
      const badge = frame.locator('[data-component="badge"]').first();
      await badge.waitFor({ timeout: 30_000 });
      expect(await badge.innerText()).toBe(text);
      expect(
        await frame.locator("indusk-component").count(),
        "no reference is left in what the frame draws",
      ).toBe(0);
    } finally {
      await page.close();
    }
  }, 180_000);
});

interface Catalog {
  components: Array<{ name: string; states: Array<{ name: string }> }>;
}

describe("A18 — each story opens on the Looks page at its component's size, and at each device's width on request, served by the admin", () => {
  it("A18 every story of the admin is framed to its component, and takes each reference device's width when chosen", async () => {
    const devices = JSON.parse(
      readFileSync(join(REPO, ".indusk/mockups/admin/devices.json"), "utf-8"),
    ).devices as Array<{ name: string; width: number; height: number }>;
    const catalog = JSON.parse(
      readFileSync(
        join(REPO, ".indusk/mockups/admin/components.json"),
        "utf-8",
      ),
    ) as Catalog;
    const stories = catalog.components.flatMap((c) =>
      c.states.map((s) => `${c.name}.${s.name}`),
    );
    expect(stories.length, "the admin has stories").toBeGreaterThan(0);

    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    try {
      for (const story of stories) {
        await goto(
          page,
          REPO_PROJECT,
          `app=admin&story=${encodeURIComponent(story)}`,
        );
        const frame = page.locator('[data-testid="story-frame"]');
        await frame.waitFor({ timeout: 30_000 });
        // Build Phase 9 (A35): the frame is the story's snapshot as the
        // checkout holds it, drawn by the admin itself — not its /storybook build.
        expect(
          await frame.getAttribute("src"),
          `${story}: the frame loads no Storybook build`,
        ).toBeNull();
        expect(
          await frame.getAttribute("srcdoc"),
          `${story}: the frame is the snapshot's document`,
        ).toContain('id="storybook-root"');
        const component = page
          .frameLocator('[data-testid="story-frame"]')
          .locator("#storybook-root > *")
          .first();
        await component.waitFor({ timeout: 30_000 });
        // The frame is fitted once the story has drawn: no wider or taller
        // than its component and the padding around it.
        await expect
          .poll(
            async () => {
              const f = await frame.boundingBox();
              const c = await component.boundingBox();
              if (!f || !c) return "no box";
              // The component's box is the page's; the frame's own origin
              // is subtracted to read it as the story document does.
              const left = c.x - f.x;
              const top = c.y - f.y;
              const wide = left + c.width + left;
              const tall = top + c.height + top;
              // A component that fills its viewport (the shell) is drawn as
              // tall as the frame it is given, so it reaches the frame's
              // bottom edge; the frame is then its content's height, read at
              // a one-pixel viewport, and is not compared to the box.
              const fillsFrame = c.y + c.height >= f.y + f.height - 2;
              return Math.abs(f.width - wide) <= 2 &&
                (Math.abs(f.height - tall) <= 2 || fillsFrame)
                ? "fitted"
                : `frame ${f.width}x${f.height}, component ${wide}x${tall}`;
            },
            {
              message: `${story}: the frame is its component's size`,
              timeout: 10_000,
            },
          )
          .toBe("fitted");
        for (const device of devices) {
          // The page is drawn before it is hydrated, and a click before then
          // is lost; choosing the same device again is the same choice.
          await expect
            .poll(
              async () => {
                await page
                  .locator(
                    `[data-testid="frame-device"][data-device="${device.name}"]`,
                  )
                  .click();
                return (await frame.boundingBox())?.width;
              },
              { message: `${story} at ${device.name}`, timeout: 15_000 },
            )
            .toBe(device.width);
        }
      }
    } finally {
      await page.close();
    }
  }, 580_000);
});
