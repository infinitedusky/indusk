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
 * own hosts. Every route module under `app/api` is imported here, and every
 * handler it exports is called, so a new route fails this file until it is added.
 */

type Handler = (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

const MODULES: Record<string, Record<string, unknown>> = {
  plans,
  "plans/accept": accept,
  "plans/approve": approve,
  "plans/build": build,
  "plans/review": review,
  sessions,
  "sessions/[id]/events": events,
  "sessions/[id]/reply": reply,
  "sessions/[id]/say": say,
  "sessions/[id]/stop": stop,
};

/** Every handler every route module exports, read from the module, so none is missed. */
const ROUTES: Array<[string, "GET" | "POST", Handler]> = Object.entries(
  MODULES,
).flatMap(([name, mod]) =>
  (["GET", "POST"] as const)
    .filter((m) => typeof mod[m] === "function")
    .map(
      (m) => [name, m, mod[m] as Handler] as [string, "GET" | "POST", Handler],
    ),
);

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

it("A34 — every route module under app/api is imported above", () => {
  const api = join(__dirname, "..", "app", "api");
  const found = readdirSync(api, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => relative(".", join(f, "..")))
    .sort();
  expect(found).toEqual(Object.keys(MODULES).sort());
});
