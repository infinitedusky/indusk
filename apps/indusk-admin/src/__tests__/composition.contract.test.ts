// promise: mockups-render-in-the-cockpit — A30.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * storybook-components A30 — a composed mockup draws each component as its
 * story does. A25 asked only whether a component's rules were *present* in the
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
 * What is not compared, and why (each is the mockup's own page layout, which
 * is what a mockup is for, never the component's):
 *  - a computed value that differs in the *story* between two viewport widths
 *    (1280 and 1000) is container-driven — a root that fills its column,
 *    `margin-left: auto` computing to a pixel count — and is skipped;
 *  - a box's content width and height are compared only where the story's box
 *    is the same at both widths, and not on an inline root, whose box depends
 *    on the formatting context the mockup puts it in;
 *  - the root's `display` is compared without `inline-` (a flex or grid parent
 *    blockifies its child);
 *  - a border's style and colour only on a side with a width (below).
 * Everything else — padding, margin, border widths, background, colour, font,
 * flex alignment — is a computed value of the component's own rules and is
 * always compared.
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
] as const;

/** One element as the browser drew it: where it is in the component, and its computed values. */
interface Drawn {
  path: string;
  props: Record<string, string>;
  /** Content-box width and height, or null for an element that is not drawn. */
  size: { width: number; height: number } | null;
}

/** Runs in the page: the component root at `index` among the page's top-level `[data-component]`s, and its descendants. */
function readDrawn(args: {
  index: number;
  name: string;
  props: readonly string[];
}): Drawn[] | { problem: string } {
  const marked = Array.from(
    document.querySelectorAll<HTMLElement>("[data-component]"),
  ).filter((el) => !el.parentElement?.closest("[data-component]"));
  const root = marked[args.index];
  if (!root) {
    return {
      problem: `the page has ${marked.length} component roots, wanted index ${args.index}`,
    };
  }
  if (root.dataset.component !== args.name) {
    return {
      problem: `root ${args.index} is ${root.dataset.component}, wanted ${args.name}`,
    };
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

const WIDE = 1280;
const NARROW = 1000;

async function drawn(
  page: Page,
  index: number,
  name: string,
): Promise<Drawn[] | { problem: string }> {
  return page.evaluate(readDrawn, { index, name, props: PROPS });
}

async function story(
  page: Page,
  id: string,
  name: string,
): Promise<Drawn[] | { problem: string }> {
  await page.goto(
    `${origin}/storybook/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`,
    { waitUntil: "load", timeout: 60_000 },
  );
  await page.waitForSelector(`#storybook-root [data-component="${name}"]`, {
    timeout: 30_000,
  });
  await page.evaluate(() => document.fonts.ready);
  return drawn(page, 0, name);
}

/** A story's elements with `size` kept only where the box is the same at both widths. */
async function storyAt(
  browser: Browser,
  id: string,
  name: string,
): Promise<Drawn[] | { problem: string }> {
  const sizes: Array<Drawn[] | { problem: string }> = [];
  for (const width of [WIDE, NARROW]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
    });
    try {
      sizes.push(await story(page, id, name));
    } finally {
      await page.close();
    }
  }
  const [wide, narrow] = sizes;
  if (!wide || !narrow) return { problem: "no story read" };
  if ("problem" in wide) return wide;
  if ("problem" in narrow) return narrow;
  if (wide.length !== narrow.length) {
    return { problem: "the story's element count differs between widths" };
  }
  return wide.map((el, i) => {
    const other = narrow[i]?.size;
    const same =
      el.size !== null &&
      other !== null &&
      other !== undefined &&
      Math.abs(el.size.width - other.width) < 0.5 &&
      Math.abs(el.size.height - other.height) < 0.5;
    // A computed value that differs between the two widths in the story is
    // container-driven too (`margin-left: auto` computes to a pixel count):
    // it is the page's layout, not the component's, and is not compared.
    const props = { ...el.props };
    for (const p of PROPS) {
      if (el.props[p] !== narrow[i]?.props[p]) delete props[p];
    }
    return { ...el, props, size: same ? el.size : null };
  });
}

describe("A30 — a composed mockup draws each component as its story does", () => {
  it("A30 every component every admin mockup places has, on its root and each descendant, the story's computed values", async () => {
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
    const failures: string[] = [];
    let compared = 0;

    for (const mockup of looks.mockups) {
      const uses = app.mockups.find((m) => m.name === mockup.name)?.uses ?? [];
      const page = await browser.newPage({
        viewport: { width: WIDE, height: 900 },
      });
      try {
        await page.setContent(mockup.document, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        for (const [index, use] of uses.entries()) {
          const key = `${use.name}.${use.state}`;
          const where = `${mockup.name} / ${key}`;
          const id = ids.get(key);
          if (!id) {
            failures.push(`${where}: no story id in the catalog`);
            continue;
          }
          if (!stories.has(key)) {
            stories.set(key, await storyAt(browser, id, use.name));
          }
          const expected = stories.get(key);
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
                  p === "display" && i === 0 ? blockified : (v: string) => v;
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
            if (want.size && got.size && !inlineRoot) {
              for (const dim of ["width", "height"] as const) {
                if (Math.abs(want.size[dim] - got.size[dim]) > 1) {
                  failures.push(
                    `${where} ${want.path} content-${dim}: story ${want.size[dim]}px, mockup ${got.size[dim]}px`,
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
  }, 580_000);
});
