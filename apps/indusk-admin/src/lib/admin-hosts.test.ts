import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import * as accept from "@/app/api/plans/accept/route";
import * as approve from "@/app/api/plans/approve/route";
import * as build from "@/app/api/plans/build/route";
import * as review from "@/app/api/plans/review/route";
import * as plans from "@/app/api/plans/route";
import * as events from "@/app/api/sessions/[id]/events/route";
import * as reply from "@/app/api/sessions/[id]/reply/route";
import * as say from "@/app/api/sessions/[id]/say/route";
import * as stop from "@/app/api/sessions/[id]/stop/route";
import * as sessions from "@/app/api/sessions/route";

/**
 * promise: nothing-ships-until-accepted — admin-plan-authoring A34.
 *
 * DNS rebinding: a page on another site whose name the attacker points at
 * 127.0.0.1 sends `Origin` and `Host` that both name that site, so comparing
 * the two lets it through. The admin's routes start the developer's `claude`,
 * stream what it says and accept plans; each must answer only on the admin's
 * own hosts. Every route under `app/api` is listed here, so a new one fails
 * this file until it is added.
 */

type Handler = (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

const ROUTES: Array<[string, "GET" | "POST", Handler]> = [
  ["plans", "POST", plans.POST as Handler],
  ["plans/accept", "POST", accept.POST as Handler],
  ["plans/approve", "POST", approve.POST as Handler],
  ["plans/build", "POST", build.POST as Handler],
  ["plans/review", "GET", review.GET as Handler],
  ["sessions", "POST", sessions.POST as Handler],
  ["sessions/[id]/events", "GET", events.GET as Handler],
  ["sessions/[id]/reply", "POST", reply.POST as Handler],
  ["sessions/[id]/say", "POST", say.POST as Handler],
  ["sessions/[id]/stop", "POST", stop.POST as Handler],
];

function call(
  handler: Handler,
  method: "GET" | "POST",
  host: string,
): Promise<Response> {
  const req = new NextRequest(`http://${host}/api/x?project=none&plan=none`, {
    method,
    headers: { host, origin: `http://${host}` },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  return handler(req, { params: Promise.resolve({ id: "no-such-session" }) });
}

describe("A34 — the admin answers only on its own hosts", () => {
  for (const [name, method, handler] of ROUTES) {
    it(`${method} ${name} refuses a rebound host`, async () => {
      const res = await call(handler, method, "evil.example:3996");
      expect(res.status).toBe(403);
    });

    it(`${method} ${name} serves the loopback host`, async () => {
      const res = await call(handler, method, "127.0.0.1:3996");
      expect(res.status).not.toBe(403);
    });
  }
});

it("A34 — every route under app/api is in the list above", () => {
  const api = join(__dirname, "..", "app", "api");
  const found = readdirSync(api, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => relative(".", join(f, "..")))
    .sort();
  expect(found).toEqual(ROUTES.map(([name]) => name).sort());
});
