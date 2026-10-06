import { describe, expect, it } from "vitest";
import { sameOrigin } from "../session-host";

/**
 * admin-plan-authoring ADR D2 — a route that can start the developer's
 * `claude` answers only the admin's own page. Its reason for being a rule:
 * without it any site the developer visits could POST to the loopback port
 * and start a session. Nothing promised names this; it guards the routes the
 * promises run through.
 */
describe("only the admin's own page may change a session", () => {
  it("the admin's own page, directly or through the Caddy route, is accepted", () => {
    expect(sameOrigin("http://localhost:3939", "localhost:3939")).toBe(true);
    expect(sameOrigin("https://indusk.dawn", "indusk.dawn")).toBe(true);
  });

  it("another site's page is refused", () => {
    expect(sameOrigin("https://evil.example", "localhost:3939")).toBe(false);
    expect(sameOrigin("http://localhost:3000", "localhost:3939")).toBe(false);
  });

  it("no Origin, a null one, or no Host is refused", () => {
    expect(sameOrigin(null, "localhost:3939")).toBe(false);
    expect(sameOrigin("null", "localhost:3939")).toBe(false);
    expect(sameOrigin("http://localhost:3939", null)).toBe(false);
  });
});
