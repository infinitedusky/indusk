// promise: mockups-render-in-the-cockpit
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type DevServer,
  makeHome,
  startNextDev,
} from "@/__tests__/helpers/next-dev";

/**
 * ui-promises A15, A16 — a contract with Next and Chromium, so the system
 * tier (`vitest.tiers.ts` `SYSTEM`; lesson: everyday-tests-never-wait): the
 * Looks page served by `next dev`, opened in a real browser, its mockup frame
 * measured. What the page offers is `looks.test.tsx`'s; this file asserts only
 * what a browser can say — the frame's size, and the colour the mockup is
 * drawn with.
 *
 * The carried body changed `--dusk`; the fixture's `home.empty` does not use
 * it, so the foundation value changed here is the one its card paints with,
 * `color.paper`.
 */

const FIXTURE = resolve(
  __dirname,
  "../../../../../../indusk-mcp/src/__tests__/fixtures/looks-app",
);
const PROJECT = "looks-browser";
const FOUNDATION = ".indusk/mockups/demo/foundation.tokens.json";

let base: string;
let root: string;
let server: DevServer;
let browser: Browser;

beforeAll(async () => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-looks-browser-")));
  root = join(base, "proj");
  cpSync(FIXTURE, root, { recursive: true });
  mkdirSync(join(root, ".indusk", "planning"), { recursive: true });
  writeFileSync(
    join(root, ".indusk", "config.json"),
    JSON.stringify({ mode: "full" }),
  );
  const home = makeHome([{ name: PROJECT, path: root }]);
  server = await startNextDev({ home });
  browser = await chromium.launch();
}, 90_000);

afterAll(async () => {
  await browser?.close();
  await server?.stop();
  rmSync(base, { recursive: true, force: true });
});

async function open(page: Page, mockup: string, device: string) {
  await page.goto(
    `${server.url}/p/${PROJECT}/looks?app=demo&mockup=${mockup}&device=${device}`,
    { waitUntil: "load", timeout: 60_000 },
  );
  const frame = page.locator('[data-testid="mockup-frame"]');
  await frame.waitFor({ timeout: 30_000 });
  return frame;
}

/** The computed background of the mockup's card, read inside the frame. */
async function cardBackground(page: Page): Promise<string> {
  const card = page
    .frameLocator('[data-testid="mockup-frame"]')
    .locator(".card");
  await card.waitFor({ timeout: 10_000 });
  return card.evaluate((el) => getComputedStyle(el).backgroundColor);
}

describe("A15 — a mockup opened at a reference device is drawn at its size", () => {
  it("A15 home.empty at phone is drawn in a 390 × 844 frame; at desktop, 1440 × 900", async () => {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    try {
      const phone = await (
        await open(page, "home.empty", "phone")
      ).boundingBox();
      expect(phone).toMatchObject({ width: 390, height: 844 });
      const desktop = await (
        await open(page, "home.empty", "desktop")
      ).boundingBox();
      expect(desktop).toMatchObject({ width: 1440, height: 900 });
    } finally {
      await page.close();
    }
  }, 120_000);
});

describe("A16 — a mockup is drawn with the foundation's tokens", () => {
  it("A16 a changed foundation value shows in the frame", async () => {
    const page = await browser.newPage();
    try {
      await open(page, "home.empty", "phone");
      expect(await cardBackground(page)).toBe("rgb(250, 247, 242)");

      const file = join(root, FOUNDATION);
      const foundation = JSON.parse(readFileSync(file, "utf-8"));
      foundation.color.paper.$value = {
        colorSpace: "srgb",
        components: [0, 0.5, 1],
        hex: "#0080ff",
      };
      writeFileSync(file, `${JSON.stringify(foundation, null, "\t")}\n`);

      await open(page, "home.empty", "phone");
      expect(await cardBackground(page)).toBe("rgb(0, 128, 255)");
    } finally {
      await page.close();
    }
  }, 120_000);
});
