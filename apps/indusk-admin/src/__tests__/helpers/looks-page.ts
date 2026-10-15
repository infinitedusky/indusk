import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { expect } from "vitest";
import { writeRegistry } from "@/__tests__/helpers/next-dev";
import LooksPage from "@/app/p/[project]/looks/page";

/**
 * What `looks.test.tsx` and `looks-approve-binding.test.tsx` share: the
 * package's looks fixture as a git project registered in a temporary InDusk
 * home, the Looks page rendered over it, the approve request as the browser
 * sends it, and the readers of the page's markup.
 */

const FIXTURE = resolve(
  __dirname,
  "../../../../indusk-mcp/src/__tests__/fixtures/looks-app",
);
/** The package's components fixture: an app with stories, a catalog and a composed mockup. */
export const COMPONENTS_FIXTURE = resolve(
  __dirname,
  "../../../../indusk-mcp/src/__tests__/fixtures/components-app",
);
export const PROJECT = "looks-proj";
export const RECORD = ".indusk/mockups/demo/approved.json";
export const PERSON = "Sandy Tester";

/** The temporary directory holding the project, its home and any sibling checkout a case adds. */
export let base: string;
/** The project the page and route read: a git copy of the fixture, rebuilt by `setUpProject`. */
export let root: string;
let previousHome: string | undefined;

export function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf-8" }).trim();
}

/** Build the fixture project; each test file calls it from `beforeEach`. */
export function setUpProject(): void {
  buildProject(FIXTURE);
}

/** The same project built from the components fixture (stories, a catalog, a composed mockup). */
export function setUpComponentsProject(): void {
  buildProject(COMPONENTS_FIXTURE);
}

function buildProject(fixture: string): void {
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-looks-")));
  root = join(base, "proj");
  const home = join(base, "home");
  mkdirSync(home, { recursive: true });
  cpSync(fixture, root, { recursive: true });
  mkdirSync(join(root, ".indusk", "planning"), { recursive: true });
  git("init", "-q", "-b", "main");
  git("config", "user.name", PERSON);
  git("config", "user.email", "sandy@example.com");
  git("add", "-A");
  git("commit", "-qm", "the looks fixture");
  writeRegistry(home, [{ name: PROJECT, path: root }]);
  previousHome = process.env.INDUSK_HOME;
  process.env.INDUSK_HOME = home;
}

/** Remove it and restore `INDUSK_HOME`; each test file calls it from `afterEach`. */
export function tearDownProject(): void {
  if (previousHome === undefined) delete process.env.INDUSK_HOME;
  else process.env.INDUSK_HOME = previousHome;
  rmSync(base, { recursive: true, force: true });
}

export async function looksPage(
  query: Record<string, string> = {},
): Promise<string> {
  const element = await LooksPage({
    params: Promise.resolve({ project: PROJECT }),
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(element as React.ReactElement);
}

/** The opening tag of the element carrying `attr="value"`, and everything up to its row's end. */
export function rowOf(html: string, mockup: string): string {
  const start = html.indexOf(`data-mockup="${mockup}"`);
  expect(start, `no row for ${mockup}`).toBeGreaterThan(-1);
  const open = html.lastIndexOf("<", start);
  const next = html.indexOf('data-testid="mockup-row"', start);
  return html.slice(open, next === -1 ? undefined : next);
}

export function attrOf(tag: string, name: string): string | null {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

export function sectionOf(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  expect(start, `no ${testId} section`).toBeGreaterThan(-1);
  const end = html.indexOf("</section>", start);
  return html.slice(start, end === -1 ? undefined : end);
}

export const sha256 = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

/**
 * A POST as the admin's page sends it: the browser sets `Origin` and the
 * fetch metadata (`Sec-Fetch-Site: same-origin`) itself, which page script
 * cannot. `fetchSite: null` leaves the header out, as `curl` does.
 */
export function approveRequest(
  body: Record<string, unknown>,
  { fetchSite = "same-origin" }: { fetchSite?: string | null } = {},
): NextRequest {
  return new NextRequest("http://127.0.0.1:3996/api/looks/demo/approve", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3996",
      origin: "http://127.0.0.1:3996",
      "content-type": "application/json",
      ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}),
    },
    body: JSON.stringify(body),
  });
}

export const demo = { params: Promise.resolve({ app: "demo" }) };
export const foundationHash = () =>
  sha256(join(root, ".indusk/mockups/demo/foundation.tokens.json"));
/** The hash of a mockup as the page showed it — its bytes in `tree` (the project's own checkout by default). */
export const mockupHash = (name: string, tree = root) =>
  sha256(join(tree, `.indusk/mockups/demo/screens/${name}.html`));
/** A group approval's body entry: each mockup with the hash the page showed. */
export const shown = (name: string) => ({
  mockup: name,
  mockupHash: mockupHash(name),
});
