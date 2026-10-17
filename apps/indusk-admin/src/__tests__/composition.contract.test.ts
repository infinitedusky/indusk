// promise: mockups-render-in-the-cockpit — A30, T7.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * storybook-components A30, and mockups-draw-components-as-stories T7 — a
 * composed mockup draws each component as its story does, at each reference
 * device of the app. A25 asked only whether a component's rules were *present* in the
 * mockup's document; a mockup's own unlayered resets (`button { padding: 0 }`)
 * beat a layered rule whatever its specificity, so the rules were present and
 * lost. This compares what the browser computed.
 *
 * For every mockup of the admin and every `<indusk-component>` it places, in
 * document order: the composed document (`readAppLooks`' `document`, the one
 * the cockpit's frame loads) is opened in Chromium, and the component's story
 * is opened in the built Storybook (`/storybook/iframe.html?id=…`, served from
 * `public/storybook` by a static server: nothing here needs `next dev`, so it
 * does not contend for `.next/`). The component's root and each descendant are
 * compared, in document order, property by property.
 *
 * Devices (T7). Every mockup is drawn at each of the app's reference devices'
 * widths, and the story is read at that same width, so a responsive class is
 * compared where it applies.
 *
 * Own words (T7). A mockup may give a component its own words
 * (component-content). The story is read with the mockup's words placed into
 * its leaf elements (those with no element child) before it is measured, so a
 * box holding the mockup's words is held to the story's box given those words,
 * never skipped.
 *
 * Sizes. A box's content width and height are compared with the story's root
 * drawn as wide as the mockup drew it (the root's width forced to the
 * mockup's), so a component that fills its column is held to the same width
 * and everything inside it, wrapping included, is compared like for like. The
 * root's own width is therefore not a finding, and an inline root's size —
 * which depends on the formatting context the mockup puts it in — is not
 * compared at all. A root placed in a flex or grid parent has its height set
 * by that parent (`align-self: stretch`: the nav fills the shell's row), so its
 * height is the page's; what is inside it is still compared.
 *
 * What else is not compared, and why (each is the mockup's own page layout,
 * which is what a mockup is for, never the component's):
 *  - a computed value that differs in the *story* between two viewport widths
 *    (1280 and 1000) is container-driven — `margin-left: auto` computing to a
 *    pixel count — and is skipped;
 *  - likewise a value that differs in the story once a sibling is placed on
 *    each side of its root (`first:border-t-0`: the story draws the component
 *    alone, so it is always the first child; a mockup puts a header above it);
 *  - the root's `display` is compared without `inline-` (a flex or grid parent
 *    blockifies its child);
 *  - a border's style and colour only on a side with a width (below).
 * Everything else — padding, margin, border widths, background, colour, font,
 * flex alignment, `box-sizing` — is a computed value of the component's own
 * rules and is always compared.
 *
 * A contract with Chromium and the built Storybook, so the system tier
 * (`vitest.tiers.ts` `SYSTEM`; lesson: everyday-tests-never-wait).
 */

const ADMIN = resolve(__dirname, "../..");
const REPO = resolve(ADMIN, "../..");
const STORYBOOK = join(ADMIN, "public/storybook");
const APP = "admin";

/** Computed properties compared on every element. */
const PROPS = [
  "display",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-top-left-radius",
  "background-color",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-align",
  "gap",
  "flex-direction",
  "flex-wrap",
  "align-items",
  "justify-content",
  "box-sizing",
] as const;

/** One element as the browser drew it: where it is in the component, and its computed values. */
interface Drawn {
  path: string;
  props: Record<string, string>;
  /** Content-box width and height, or null for an element that is not drawn. */
  size: { width: number; height: number } | null;
  /** The border-box width: the root's is what the story is drawn as wide as. */
  box: number;
  /** The `display` of the element's parent. */
  parentDisplay: string;
  /** The element's text, whitespace collapsed: a mockup may give a component its own words. */
  text: string;
}

/**
 * Runs in the page: the `index`th element marked as component `name`, in
 * document order, and its descendants. By name, not by position among the
 * page's top-level components: a component mockup places components inside
 * its own (component-content), so a placed component need not be top-level.
 */
function readDrawn(args: {
  index: number;
  name: string;
  props: readonly string[];
  /** Draw the root this many pixels wide (its border box), as a mockup's column did. */
  width?: number;
  /** The words to place into the leaf elements, by document-order index (the mockup's own). */
  words?: readonly string[];
}): Drawn[] | { problem: string } {
  const marked = Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-component=${JSON.stringify(args.name)}]`,
    ),
  );
  const root = marked[args.index];
  if (!root) {
    return {
      problem: `the page marks ${marked.length} ${args.name}, wanted number ${args.index + 1}`,
    };
  }
  if (args.width !== undefined) {
    root.style.boxSizing = "border-box";
    root.style.width = `${args.width}px`;
  }
  if (args.words) {
    // A leaf (no element child) holding other words than the mockup's is given
    // them, so its box is the story's box for the same words.
    const all = [root, ...Array.from(root.querySelectorAll("*"))];
    all.forEach((el, i) => {
      const want = args.words?.[i];
      if (want === undefined || el.children.length > 0) return;
      if ((el.textContent ?? "").replace(/\s+/g, " ").trim() !== want) {
        el.textContent = want;
      }
    });
  }
  const label = (el: Element, parent: string, n: number) =>
    `${parent}${parent ? " > " : ""}${el.tagName.toLowerCase()}${
      el.getAttribute("data-component")
        ? `[data-component=${el.getAttribute("data-component")}]`
        : ""
    }[${n}]`;
  const out: Drawn[] = [];
  const walk = (el: Element, parent: string, n: number) => {
    const path = label(el, parent, n);
    const cs = getComputedStyle(el);
    const props: Record<string, string> = {};
    for (const p of args.props) props[p] = cs.getPropertyValue(p);
    const rect = el.getBoundingClientRect();
    const drawn = cs.display !== "none" && cs.display !== "contents";
    const px = (v: string) => Number.parseFloat(v) || 0;
    out.push({
      path,
      props,
      box: rect.width,
      parentDisplay: el.parentElement
        ? getComputedStyle(el.parentElement).display
        : "",
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      size: drawn
        ? {
            width:
              rect.width -
              px(cs.paddingLeft) -
              px(cs.paddingRight) -
              px(cs.borderLeftWidth) -
              px(cs.borderRightWidth),
            height:
              rect.height -
              px(cs.paddingTop) -
              px(cs.paddingBottom) -
              px(cs.borderTopWidth) -
              px(cs.borderBottomWidth),
          }
        : null,
    });
    Array.from(el.children).forEach((child, i) => {
      walk(child, path, i);
    });
  };
  walk(root, "", 0);
  return out;
}

/**
 * A border's style and colour are compared only on a side the story draws a
 * border on. Tailwind's preflight (`*{border:0 solid}`) gives every element in
 * a story a computed `solid`, and a mockup's page has no preflight, so it reads
 * `none`; with a width of 0 neither is drawn and the two are the same picture.
 */
const BORDER_DRAWN =
  /^border-(top|right|bottom|left)-(style|color)$|^border-top-color$/;
function borderDrawn(el: Drawn, prop: string): boolean {
  const side = prop.match(/^border-(top|right|bottom|left)-/)?.[1] ?? "top";
  return Number.parseFloat(el.props[`border-${side}-width`] ?? "0") > 0;
}

/**
 * A component's root is placed by the mockup in a parent of its own — a flex
 * or grid container blockifies an `inline-flex` child to `flex` and `inline`
 * to `block` — so the root's `display` is compared without the `inline-`.
 * Only the root: a descendant's parent is the component's own.
 */
const blockified = (display: string) =>
  display === "inline" ? "block" : display.replace(/^inline-/, "");

/**
 * `start` and `end` are the logical names of `left` and `right`; in a
 * left-to-right page each draws the same, so a story's `start` and a
 * mockup's `left` are one value. The admin's pages are left to right.
 */
const logical = (value: string) =>
  value === "start" ? "left" : value === "end" ? "right" : value;

let server: Server;
let origin: string;
let browser: Browser;

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

beforeAll(async () => {
  if (!existsSync(join(STORYBOOK, "iframe.html"))) {
    const built = spawnSync("pnpm", ["run", "build:storybook"], {
      cwd: ADMIN,
      encoding: "utf-8",
    });
    expect(built.status, built.stderr).toBe(0);
  }
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const rel = normalize(
      decodeURIComponent(url.pathname).replace(/^\/storybook\//, "/"),
    );
    const file = join(STORYBOOK, rel);
    if (!file.startsWith(STORYBOOK) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    });
    res.end(readFileSync(file));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const addr = server.address();
  origin = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => {
    if (server) server.close(() => done());
    else done();
  });
});

/** How far a second viewport is from the device's, to drop a value the container drives. */
const WIDER_BY = 120;
/** The height of every read viewport; nothing here depends on it. */
const TALL = 900;

async function drawn(
  page: Page,
  index: number,
  name: string,
  width?: number,
  words?: readonly string[],
): Promise<Drawn[] | { problem: string }> {
  return page.evaluate(readDrawn, { index, name, props: PROPS, width, words });
}

async function story(
  page: Page,
  id: string,
  name: string,
  siblings: boolean,
  width?: number,
  words?: readonly string[],
): Promise<Drawn[] | { problem: string }> {
  await page.goto(
    `${origin}/storybook/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`,
    { waitUntil: "load", timeout: 60_000 },
  );
  await page.waitForSelector(
    `#storybook-root [data-component=${JSON.stringify(name)}]`,
    {
      timeout: 30_000,
    },
  );
  await page.evaluate(() => document.fonts.ready);
  if (siblings) {
    // A story draws its component alone, so `:first-child` and `:last-child`
    // always hold; a mockup places it among others. Siblings before and after
    // the root show which of its values depend on where it is placed.
    await page.evaluate((component) => {
      const root = document.querySelector(
        `#storybook-root [data-component=${JSON.stringify(component)}]`,
      );
      if (!root) return;
      root.before(document.createElement("span"));
      root.after(document.createElement("span"));
    }, name);
  }
  return drawn(page, 0, name, width, words);
}

/**
 * A story's computed values with every one that depends on where the component
 * is placed dropped: a value that differs between the story at two viewport
 * widths, or between the story alone and the story with a sibling on each side
 * of its root, belongs to the mockup's page layout and is not compared.
 */
async function storyProps(
  browser: Browser,
  id: string,
  name: string,
  device: number,
): Promise<Drawn[] | { problem: string }> {
  const reads: Array<Drawn[] | { problem: string }> = [];
  for (const [width, siblings] of [
    [device, false],
    [device + WIDER_BY, false],
    [device, true],
  ] as const) {
    const page = await browser.newPage({
      viewport: { width, height: TALL },
    });
    try {
      reads.push(await story(page, id, name, siblings));
    } finally {
      await page.close();
    }
  }
  const [base, ...others] = reads;
  if (!base) return { problem: "no story read" };
  if ("problem" in base) return base;
  for (const other of others) {
    if (!other) return { problem: "no story read" };
    if ("problem" in other) return other;
    if (other.length !== base.length) {
      return {
        problem: `the story's element count differs: ${base.length} against ${other.length}`,
      };
    }
  }
  return base.map((el, i) => {
    const props = { ...el.props };
    for (const other of others as Drawn[][]) {
      const o = other[i] as Drawn;
      for (const p of PROPS) {
        if (el.props[p] !== o.props[p]) delete props[p];
      }
    }
    return { ...el, props };
  });
}

/**
 * The story's boxes with its root drawn `width` px wide and the mockup's
 * `words` in its leaves, on a viewport wide enough not to wrap it.
 */
async function storySizes(
  browser: Browser,
  id: string,
  name: string,
  width: number,
  device: number,
  words: readonly string[],
): Promise<Drawn[] | { problem: string }> {
  const page = await browser.newPage({
    viewport: { width: Math.max(device, Math.ceil(width) + 64), height: TALL },
  });
  try {
    return await story(page, id, name, false, width, words);
  } finally {
    await page.close();
  }
}

describe("T7 — a composed mockup draws each component as its story does, at each device", () => {
  it("T7 (A30) every component every admin mockup places has, at each reference device, on its root and each descendant, the story's computed values and its box given the mockup's words", async () => {
    const { readAppLooks } = await import(
      "@infinitedusky/indusk-mcp/looks/overview"
    );
    const { readApp } = await import("@infinitedusky/indusk-mcp/looks/mockups");
    const looks = await readAppLooks(REPO, APP);
    if ("problem" in looks) throw new Error(looks.problem);
    const app = await readApp(REPO, APP);
    expect(looks.mockups.length, "the admin has mockups").toBeGreaterThan(0);

    const ids = new Map(looks.stories.map((s) => [s.name, s.id]));
    const stories = new Map<string, Drawn[] | { problem: string }>();
    const sizes = new Map<string, Drawn[] | { problem: string }>();
    const failures: string[] = [];
    let compared = 0;

    for (const device of app.devices)
      for (const mockup of looks.mockups) {
        const uses =
          app.mockups.find((m) => m.name === mockup.name)?.uses ?? [];
        const page = await browser.newPage({
          viewport: { width: device.width, height: device.height },
        });
        try {
          await page.setContent(mockup.document, { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          const seen = new Map<string, number>();
          for (const use of uses) {
            const index = seen.get(use.name) ?? 0;
            seen.set(use.name, index + 1);
            const key = `${use.name}.${use.state}`;
            const where = `${mockup.name} (${device.name}) / ${key}`;
            const id = ids.get(key);
            if (!id) {
              failures.push(`${where}: no story id in the catalog`);
              continue;
            }
            const storyKey = `${key}@${device.width}`;
            if (!stories.has(storyKey)) {
              stories.set(
                storyKey,
                await storyProps(browser, id, use.name, device.width),
              );
            }
            const expected = stories.get(storyKey);
            const actual = await drawn(page, index, use.name);
            if (!expected || "problem" in expected) {
              failures.push(
                `${where}: the story could not be read: ${expected && "problem" in expected ? expected.problem : "none"}`,
              );
              continue;
            }
            if ("problem" in actual) {
              failures.push(`${where}: ${actual.problem}`);
              continue;
            }
            const rootWidth = (actual[0] as Drawn).box;
            const words = actual.map((el) => el.text);
            const sizeKey = `${key}@${device.width}@${rootWidth}@${JSON.stringify(words)}`;
            if (!sizes.has(sizeKey)) {
              sizes.set(
                sizeKey,
                await storySizes(
                  browser,
                  id,
                  use.name,
                  rootWidth,
                  device.width,
                  words,
                ),
              );
            }
            const sized = sizes.get(sizeKey);
            if (
              !sized ||
              "problem" in sized ||
              sized.length !== expected.length
            ) {
              failures.push(`${where}: the story's sizes could not be read`);
              continue;
            }
            if (expected.length !== actual.length) {
              failures.push(
                `${where}: the story draws ${expected.length} elements, the mockup ${actual.length}`,
              );
              continue;
            }
            for (const [i, want] of expected.entries()) {
              const got = actual[i] as Drawn;
              compared++;
              for (const p of PROPS) {
                if (!(p in want.props)) continue;
                if (!BORDER_DRAWN.test(p) || borderDrawn(want, p)) {
                  const ask =
                    p === "display" && i === 0
                      ? blockified
                      : p === "text-align"
                        ? logical
                        : (v: string) => v;
                  if (
                    ask(want.props[p] as string) !== ask(got.props[p] as string)
                  ) {
                    failures.push(
                      `${where} ${want.path} ${p}: story ${want.props[p]}, mockup ${got.props[p]}`,
                    );
                  }
                }
              }
              // An inline root's box depends on the formatting context the
              // mockup puts it in (a flex parent blockifies it and it fills the
              // line), so its size is the page's, not the component's.
              const inlineRoot =
                i === 0 &&
                String(expected[0]?.props.display).startsWith("inline");
              const wantSize = (sized[i] as Drawn).size;
              const stretched = i === 0 && /flex|grid/.test(got.parentDisplay);
              // The story was read with the mockup's own words in its leaves
              // (component-content), so a box holding them is held to the
              // story's box for the same words.
              if (wantSize && got.size && !inlineRoot) {
                for (const dim of ["width", "height"] as const) {
                  if (dim === "height" && stretched) continue;
                  if (Math.abs(wantSize[dim] - got.size[dim]) > 1) {
                    failures.push(
                      `${where} ${want.path} content-${dim}: story ${wantSize[dim]}px, mockup ${got.size[dim]}px`,
                    );
                  }
                }
              }
            }
          }
        } finally {
          await page.close();
        }
      }

    expect(compared, "elements were compared").toBeGreaterThan(0);
    // The same difference in the same story recurs in every mockup that places
    // it; one line per difference, naming each mockup that shows it.
    const lines = new Map<string, string[]>();
    for (const f of failures) {
      const [mockup, rest] = f.split(" / ") as [string, string];
      lines.set(rest, [...(lines.get(rest) ?? []), mockup]);
    }
    const report = [...lines].map(
      ([line, mockups]) => `${line}  [mockups: ${mockups.join(", ")}]`,
    );
    expect(report, report.join("\n")).toEqual([]);
  }, 2_400_000);
});
