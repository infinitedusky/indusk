---
title: "Server provisioning — run your own recording server, connected in one command"
date: 2026-10-08
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Server provisioning — run your own recording server, connected in one command

## Goal

Two commands under `indusk server` — `connect`, provider-free, and `deploy`, Fly only — and a server image every release publishes, so a person who runs InDusk from GitHub gives a project its own recording server in one command on Fly or in one command after starting the image anywhere. Decided in the [ADR](adr.md); promised in the [brief](brief.md); proven by the [test plan](test-plan.md)'s 21 assertions.

## Scope

### In Scope
- `indusk server connect` and `indusk server deploy`, their seams, refusals and redaction
- The project's `server` config block and the per-project credential in `~/.indusk/config.env`
- The image built from the release tarball and pushed to GitHub's registry by `pnpm release`; the Dockerfile as a package template; `deploy --build-from` for an unreleased build
- The guide "run your own server", the reference page for both commands, the changelog
- One live deploy to Fly and one live connect of the demo app, recorded with cost

### Out of Scope
- Any provider but Fly; teardown; the GitHub connection ([workbench-watch-provisioning](../workbench-watch-provisioning/brief.md)); a hosted service

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A18, A19, A21 red; the register with every deferred body | `package.json` `release`, `docker/Dockerfile.always-on`, the docs tree |
| Build Phase 1 | `lib/server/redact.ts`, `lib/server/secrets-file.ts`, `lib/server/connect.ts`, `bin/commands/server.ts` (`connect`), `server connect` in `cli.ts` | `lib/promises/probe.ts` (`probeWatcher`), `lib/config.ts` (`ensureConfigBlock`, `promises.jaeger`), `lib/infra-config.ts` |
| Build Phase 2 | `lib/server/fly.ts` (`FlyCli`, real + recorded), `lib/server/fly-state.ts`, `lib/server/plan-deploy.ts`, `lib/server/deploy.ts`, `templates/server/fly.toml`, the `server` config block, `server deploy` | Build Phase 1's connect, redact and secrets; `fly` v0.4.x |
| Build Phase 3 | `templates/server/Dockerfile` (from a tarball), `scripts/release-image.sh`, the `release` script order, `deploy --build-from`, `docker/Dockerfile.always-on` pinned to the template | Docker on the release machine; `pnpm pack` |
| Build Phase 4 | the live record: duration, cost, the bill line; the demo app connected | Fly, the person's account, Build Phases 1–3 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | After connect is given a server's query address, intake address and credential, the project's config names that server as its production source — two addresses and the credential variable's name, never the credential | Build Phase 1 | Build Phase 1 | written | unit | promise: a-project-connects-to-its-server-in-one-command | apps/indusk-mcp/src/lib/server/connect.test.ts |
| A2 | After connect, the credential's value is in the machine's secrets file under the variable the config names, readable by the owner only | Build Phase 1 | Build Phase 1 | written | unit | promise: a-project-connects-to-its-server-in-one-command | apps/indusk-mcp/src/lib/server/connect.test.ts |
| A3 | After connect, a promise read on the project shows two sources, local and production, and production is the server just named | Build Phase 1 | Build Phase 1 | written | unit | promise: a-project-connects-to-its-server-in-one-command | apps/indusk-mcp/src/lib/server/connect.test.ts |
| A4 | Connecting the demo app to the deployed server and opening the admin shows that server's promises on the Promises page | Build Phase 3 | Build Phase 4 | planned | live check | promise: a-project-connects-to-its-server-in-one-command | apps/indusk-mcp/e2e/server-live.e2e.test.ts |
| A5 | Deploy on a project with no server creates the app, the volume, the secrets, the deployment and the addresses, then connects, in that order, asking nothing it did not say up front | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-fly-deploy-is-one-command | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A6 | The server deploy creates runs the person's `indusk` version, as one machine, with its public query address naming the app, and a Slack webhook when one was given | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-fly-deploy-is-one-command | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A7 | Deploy without a Slack webhook finishes and says announcements are off | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-fly-deploy-is-one-command | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A8 | A real deploy to Fly ends with the project connected and its first production read alive, within ten minutes, for a cost the plan records | Build Phase 3 | Build Phase 4 | planned | live check | promise: a-fly-deploy-is-one-command | apps/indusk-mcp/e2e/server-live.e2e.test.ts |
| A9 | Nothing either command prints, on success or any failure, contains the password or the webhook | Build Phase 1 | Build Phase 2 | written | unit | promise: provisioning-never-prints-a-secret | apps/indusk-mcp/src/lib/server/redact.test.ts, apps/indusk-mcp/src/lib/server/connect.test.ts, apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A10 | After either command, the only change under the project is its config, and nothing in it contains the password or the webhook | Build Phase 1 | Build Phase 2 | written | unit | promise: provisioning-never-prints-a-secret | apps/indusk-mcp/src/lib/server/connect.test.ts, apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A11 | Deploy on a project whose server exists creates no app, volume or address, redeploys the current version, keeps the secrets, and connects again | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-second-run-updates-not-duplicates | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A12 | Connect on a project that already names a server replaces the source and the stored credential; one of each remains | Build Phase 1 | Build Phase 1 | written | unit | promise: a-second-run-updates-not-duplicates | apps/indusk-mcp/src/lib/server/connect.test.ts |
| A13 | With the Fly CLI missing or not signed in, deploy refuses, naming what is missing and the command that fixes it, and has run nothing that creates | Build Phase 2 | Build Phase 2 | planned | unit | promise: provisioning-refuses-what-it-cannot-do | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A14 | When the app name is taken and not recorded as this project's server, deploy refuses, naming the app and how to choose another, and has created nothing | Build Phase 2 | Build Phase 2 | planned | unit | promise: provisioning-refuses-what-it-cannot-do | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A15 | Connect to a server whose mark does not come back ends non-zero, saying watcher blind with the intake and the reader it tried, and leaves the project's config unchanged | Build Phase 1 | Build Phase 1 | written | unit | promise: a-server-is-read-back-before-the-command-ends | apps/indusk-mcp/src/lib/server/connect.test.ts |
| A16 | The read-back goes through the addresses the project will use, never an internal or loopback one | Build Phase 1 | Build Phase 1 | written | unit | promise: a-server-is-read-back-before-the-command-ends | apps/indusk-mcp/src/lib/server/connect.test.ts |
| A17 | Deploy whose read-back fails ends non-zero naming what did not come back, and says the server exists so a second run can finish | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-server-is-read-back-before-the-command-ends | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A18 | The release command publishes the image tagged with the version, and a release whose image push fails is not a release | Test Phase 1 | Build Phase 3 | written | unit | promise: the-recording-server-runs-from-a-published-image | apps/indusk-mcp/src/__tests__/release-script.test.ts |
| A19 | The image built the way the release builds it starts with a volume, its two ports and its two secrets, and answers a mark sent through it, with no checkout on the host | Test Phase 1 | Build Phase 3 | written | contract | promise: the-recording-server-runs-from-a-published-image | apps/indusk-mcp/src/__tests__/always-on-image.test.ts |
| A20 | Deploy pulls the published image for its version rather than building one | Build Phase 2 | Build Phase 2 | planned | unit | promise: the-recording-server-runs-from-a-published-image | apps/indusk-mcp/src/lib/server/deploy.test.ts |
| A21 | The guide's "run your own server" page names every server setting without a default, the volume, the two ports and the connect command | Test Phase 1 | Build Phase 3 | written | unit | a regression guard over the guide — a server setting added without a line in it is the 2026-10-04 deploy again | apps/indusk-mcp/src/__tests__/server-guide.test.ts |

### Deferred Verification

- **Fly's CLI keeps the flags and defaults deploy relies on**
  - reason: a third party's tool, changed without notice (`fly launch` rewrote the config on 2026-10-04); no test of ours can hold it still
  - would require: Fly to publish a contract for its CLI, or a recorded `fly` per version to replay
  - mitigation: A8 re-run at any release that touches `lib/server/deploy.ts` or the template, and every refusal names the Fly command and its output so the person sees which call changed; recorded in [known-issues.md](../known-issues.md) under Releases at close

## Checklist

### Test Phase 1: The release, the image and the guide, red; the rest registered

**Goal**: author the three rows whose subjects exist today, red on their own assertion, and register every other row with the body it will have, so the review can ask whether each compiles at its phase and asserts what it claims.

- [x] Create/confirm this plan's worktree (`indusk worktree create server-provisioning`, which records the assignment so the admin and plan tools read the plan from it; a worktree made another way needs `indusk worktree assign server-provisioning <path>`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter. Created 2026-10-08 at `dusk-worktrees/server-provisioning`.
- [x] A18 in `src/__tests__/release-script.test.ts`: the pinned step list gains `bash scripts/release-image.sh` between `npm whoami` and the publish step, so a failed push stops the release before npm has the version; RED today (the step is absent)
- [x] A19 in `src/__tests__/always-on-image.test.ts` (system tier): a second describe builds the image from a `pnpm pack` tarball through `templates/server/Dockerfile` (`--build-arg TARBALL=`), starts it with a volume, the two ports and the two secrets, sends a mark through the intake and reads it back from the query API with `probeWatcher`; RED today (no template, and the Dockerfile installs from npm)
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] A21 in `src/__tests__/server-guide.test.ts`: reads every `INDUSK_SERVER_*` name from `lib/telemetry/` whose read has no default and asserts each appears in `apps/docs/src/guide/run-your-own-server.md`, along with `INDUSK_SERVER_VOLUME`, both ports and the words `indusk server connect`; RED today (the page does not exist)

#### Deferred to Build Phase 1

- **A1, A2, A3, A12, A15, A16** — their subject is `connect` from `lib/server/connect.ts` and its `ConnectDeps`, which Build Phase 1 introduces; a file importing it today fails to load, not to assert. Body reviewed:

  ```typescript
  // apps/indusk-mcp/src/lib/server/connect.test.ts
  // promise: a-project-connects-to-its-server-in-one-command
  // promise: a-second-run-updates-not-duplicates
  // promise: a-server-is-read-back-before-the-command-ends
  import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  import { describe, expect, it } from "vitest";
  import { readConfig } from "../config.js";
  import { resolveMarkSources, sourceNames } from "../promises/sources.js"; // confirmed at Test Phase 1's review: the reader of promises.jaeger
  import { jaegerEndpoint } from "../promises/telemetry.js";
  import { WatcherBlind } from "../promises/probe.js";
  import { type ConnectDeps, connect } from "./connect.js";
  import { secretsFile } from "./secrets-file.js";

  const server = { queryUrl: "https://x.fly.dev:16687", otlpUrl: "https://x.fly.dev", credential: "indusk:pw-1" };
  function project(): { root: string; home: string } {
    const root = mkdtempSync(join(tmpdir(), "sp-root-"));
    const home = mkdtempSync(join(tmpdir(), "sp-home-"));
    writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ project: { name: "seat-holds" }, promises: {} }), { flag: "wx" }); // mkdir .indusk first at authoring
    return { root, home };
  }
  function deps(home: string, probed: { queryUrl: string; otlpUrl: string }[] = [], blind = false): ConnectDeps {
    return {
      async probe(t) { probed.push({ queryUrl: t.queryUrl, otlpUrl: t.otlpUrl }); if (blind) throw new WatcherBlind(t.queryUrl, t.otlpUrl, "nothing came back"); }, // (where = the query API, intake)
      secrets: secretsFile(join(home, "config.env")),
      out: { line() {} },
    };
  }

  describe("connect", () => {
    it("A1 — names the server in the config by its addresses and the credential's variable, never the value", async () => {
      const { root, home } = project();
      await connect({ projectRoot: root, projectName: "seat-holds", ...server }, deps(home));
      const config = readConfig(root);
      expect(config?.promises?.jaeger).toEqual({ url: server.queryUrl, otlp_url: server.otlpUrl, credential_env: "INDUSK_SERVER_SEAT_HOLDS_CREDENTIAL" });
      expect(readFileSync(join(root, ".indusk", "config.json"), "utf-8")).not.toContain("pw-1");
    });
    it("A2 — stores the value in the secrets file under that variable, owner-only", async () => {
      const { root, home } = project();
      await connect({ projectRoot: root, projectName: "seat-holds", ...server }, deps(home));
      expect(readFileSync(join(home, "config.env"), "utf-8")).toContain("INDUSK_SERVER_SEAT_HOLDS_CREDENTIAL=indusk:pw-1");
      expect(statSync(join(home, "config.env")).mode & 0o777).toBe(0o600);
    });
    it("A3 — the next promise read has two sources, and production is the server, with no shell restart", async () => {
      // The production source read its credential from the process environment only (sources.ts resolveProduction);
      // the shell exported it. Here the variable is NOT in process.env: the read must find it in the secrets file
      // connect wrote, under INDUSK_HOME, or "the admin shows the server's promises on the next read" is false.
      const { root, home } = project();
      process.env.INDUSK_HOME = home; // restored in afterEach at authoring
      delete process.env.INDUSK_SERVER_SEAT_HOLDS_CREDENTIAL;
      await connect({ projectRoot: root, projectName: "seat-holds", ...server }, deps(home));
      expect(sourceNames(root)).toEqual(["local", "production"]);
      const production = (await resolveMarkSources(root)).find((s) => s.name === "production");
      expect(production?.ok, production && !production.ok ? production.error.message : "").toBe(true);
      if (production?.ok) {
        expect(production.source.endpoint.queryUrl).toBe(jaegerEndpoint(server.queryUrl).queryUrl);
        expect(production.source.intakeUrl).toBe(server.otlpUrl);
      }
    });
    it("A12 — connecting again replaces the source and the stored credential; one of each remains", async () => {
      const { root, home } = project();
      await connect({ projectRoot: root, projectName: "seat-holds", ...server }, deps(home));
      await connect({ projectRoot: root, projectName: "seat-holds", ...server, queryUrl: "https://y.fly.dev:16687", credential: "indusk:pw-2" }, deps(home));
      expect(readConfig(root)?.promises?.jaeger?.url).toBe("https://y.fly.dev:16687");
      const env = readFileSync(join(home, "config.env"), "utf-8");
      expect(env.match(/INDUSK_SERVER_SEAT_HOLDS_CREDENTIAL=/g)).toHaveLength(1);
      expect(env).toContain("pw-2"); expect(env).not.toContain("pw-1");
    });
    it("A15 — a server whose mark does not come back is not named: non-zero, watcher blind with both addresses, config unchanged", async () => {
      const { root, home } = project();
      const before = readFileSync(join(root, ".indusk", "config.json"), "utf-8");
      const r = await connect({ projectRoot: root, projectName: "seat-holds", ...server }, deps(home, [], true)).catch((e) => e);
      expect(String(r.message)).toMatch(/watcher blind/);
      expect(String(r.message)).toContain(server.otlpUrl); expect(String(r.message)).toContain(server.queryUrl);
      expect(readFileSync(join(root, ".indusk", "config.json"), "utf-8")).toBe(before);
    });
    it("A16 — the read-back uses the addresses the project will use", async () => {
      const { root, home } = project(); const probed: { queryUrl: string; otlpUrl: string }[] = [];
      await connect({ projectRoot: root, projectName: "seat-holds", ...server }, deps(home, probed));
      expect(probed).toEqual([{ queryUrl: server.queryUrl, otlpUrl: server.otlpUrl }]);
    });
  });
  ```

- **A9** (the connect half; the deploy half joins in Build Phase 2) — its subject is the redacting writer `lib/server/redact.ts` introduces. Body reviewed:

  ```typescript
  // apps/indusk-mcp/src/lib/server/redact.test.ts
  // promise: provisioning-never-prints-a-secret
  import { describe, expect, it } from "vitest";
  import { redactingWriter } from "./redact.js";

  describe("A9 — the redacting writer", () => {
    it("replaces every secret wherever it appears, including inside a provider's own output", () => {
      const lines: string[] = [];
      const out = redactingWriter((l) => lines.push(l), ["pw-1", "https://hooks.slack.com/services/T/B/x"]);
      out.line("fly: set INDUSK_SERVER_PASSWORD=pw-1 and INDUSK_SERVER_SLACK_WEBHOOK=https://hooks.slack.com/services/T/B/x");
      out.line("error: pw-1 rejected");
      expect(lines.join("\n")).not.toContain("pw-1");
      expect(lines.join("\n")).not.toContain("hooks.slack.com/services/T/B/x");
      expect(lines[0]).toContain("INDUSK_SERVER_PASSWORD=[redacted]");
    });
  });
  ```

- **A10** (the connect half) — the same `connect` subject; the deploy half in Build Phase 2. Body reviewed:

  ```typescript
  // in connect.test.ts
  it("A10 — the only change under the project is its config, and it holds no secret", async () => {
    const { root, home } = project(); // made a git repo with one commit at authoring (git init; add; commit)
    await connect({ projectRoot: root, projectName: "seat-holds", ...server }, deps(home));
    const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf-8" }).stdout.trim().split("\n");
    expect(status).toEqual([" M .indusk/config.json"]);
    expect(readFileSync(join(root, ".indusk", "config.json"), "utf-8")).not.toContain("pw-1");
  });
  ```

#### Deferred to Build Phase 2

- **A5, A6, A7, A11, A13, A14, A17, A20**, and the deploy halves of **A9** and **A10** — their subject is `deploy`, `planDeploy` and the `FlyCli` seam from `lib/server/`, which Build Phase 2 introduces. Body reviewed:

  ```typescript
  // apps/indusk-mcp/src/lib/server/deploy.test.ts
  // promise: a-fly-deploy-is-one-command
  // promise: a-second-run-updates-not-duplicates
  // promise: provisioning-refuses-what-it-cannot-do
  // promise: a-server-is-read-back-before-the-command-ends
  // promise: the-recording-server-runs-from-a-published-image
  // promise: provisioning-never-prints-a-secret
  import { describe, expect, it } from "vitest";
  import { type DeployDeps, deploy } from "./deploy.js";
  import { type FlyCli } from "./fly.js";
  import { WatcherBlind } from "../promises/probe.js";

  /** A Fly that answers reads from a state and records every write; stdin kept for the secrets check. */
  function fakeFly(state: { whoami: string | null; apps: string[]; volumes: string[]; ips: string[] }) {
    const calls: { args: string[]; stdin?: string }[] = [];
    const fly: FlyCli = {
      async run(args, opts) {
        calls.push({ args, stdin: opts?.stdin });
        const cmd = args.slice(0, 2).join(" ");
        if (cmd === "auth whoami") return { status: state.whoami ? 0 : 1, stdout: state.whoami ?? "", stderr: state.whoami ? "" : "not logged in" };
        if (cmd === "apps list") return { status: 0, stdout: JSON.stringify(state.apps.map((Name) => ({ Name }))), stderr: "" };
        if (cmd === "volumes list") return { status: 0, stdout: JSON.stringify(state.volumes.map((name) => ({ name }))), stderr: "" };
        if (cmd === "ips list") return { status: 0, stdout: JSON.stringify(state.ips.map((Type) => ({ Type }))), stderr: "" };
        if (cmd === "secrets import") return { status: 0, stdout: `Secrets are staged: ${opts?.stdin}`, stderr: "" }; // echoes the secret back, as Fly's output might
        return { status: 0, stdout: "", stderr: "" };
      },
    };
    return { fly, calls, writes: () => calls.filter((c) => !["auth", "apps list", "volumes list", "ips list"].some((r) => c.args.join(" ").startsWith(r))) };
  }
  const wanted = { projectRoot: "<tmp root>", projectName: "seat-holds", app: "indusk-seat-holds", org: "personal", region: "iad", version: "1.70.0", slackWebhook: null as string | null };
  function deps(fly: FlyCli, extra: Partial<DeployDeps> = {}): DeployDeps & { printed: string[] } {
    const printed: string[] = [];
    return { fly, random: () => "pw-1", async probe() {}, out: { line: (l: string) => printed.push(l) }, printed, ...extra } as DeployDeps & { printed: string[] };
  }

  describe("deploy", () => {
    it("A5 — on a project with no server: app, volume, secrets, deploy, addresses, then connect, in that order, no question asked", async () => {
      const f = fakeFly({ whoami: "me", apps: [], volumes: [], ips: [] });
      const d = deps(f.fly); const connected: unknown[] = []; d.connect = async (i) => { connected.push(i); return { credentialEnv: "X" }; };
      await deploy(wanted, d);
      expect(f.writes().map((c) => c.args.slice(0, 2).join(" "))).toEqual(["apps create", "volumes create", "secrets import", "deploy", "ips allocate-v6", "ips allocate-v4"]);
      expect(connected).toHaveLength(1);
      expect(d.printed.some((l) => /\?$/.test(l))).toBe(false);
    });
    it("A6 — the person's version, one machine, the public address names the app, the webhook when given", async () => {
      const f = fakeFly({ whoami: "me", apps: [], volumes: [], ips: [] });
      await deploy({ ...wanted, slackWebhook: "https://hooks.slack.com/services/T/B/x" }, deps(f.fly));
      const dep = f.calls.find((c) => c.args[0] === "deploy")!;
      expect(dep.args).toContain("--image"); expect(dep.args).toContain("ghcr.io/infinitedusky/indusk-always-on:1.70.0"); expect(dep.args).toContain("--ha=false");
      const sec = f.calls.find((c) => c.args.join(" ").startsWith("secrets import"))!;
      expect(sec.stdin).toContain("INDUSK_SERVER_SLACK_WEBHOOK=https://hooks.slack.com/services/T/B/x");
      // the generated config is passed with -c; read it back at authoring and assert INDUSK_SERVER_PUBLIC_QUERY_URL = "https://indusk-seat-holds.fly.dev:16687"
    });
    it("A7 — without a webhook it finishes and says announcements are off", async () => {
      const f = fakeFly({ whoami: "me", apps: [], volumes: [], ips: [] }); const d = deps(f.fly);
      await deploy(wanted, d);
      expect(d.printed.join("\n")).toMatch(/announcements are off/i);
      expect(f.calls.find((c) => c.args.join(" ").startsWith("secrets import"))!.stdin).not.toContain("SLACK");
    });
    it("A9 — nothing printed holds the password or the webhook, even when Fly echoes them", async () => {
      const f = fakeFly({ whoami: "me", apps: [], volumes: [], ips: [] }); const d = deps(f.fly);
      await deploy({ ...wanted, slackWebhook: "https://hooks.slack.com/services/T/B/x" }, d);
      expect(d.printed.join("\n")).not.toContain("pw-1"); expect(d.printed.join("\n")).not.toContain("services/T/B/x");
    });
    it("A10 — the only change under the project is its config", async () => { /* same shape as connect's A10, over a git-initialised root */ });
    it("A11 — a second run creates nothing, redeploys, keeps the secrets, connects again", async () => {
      const f = fakeFly({ whoami: "me", apps: ["indusk-seat-holds"], volumes: ["indusk_telemetry"], ips: ["v4", "v6"] });
      await deploy({ ...wanted, recordedApp: "indusk-seat-holds" }, deps(f.fly));
      expect(f.writes().map((c) => c.args[0])).toEqual(["deploy"]);
    });
    it("A13 — not signed in: refuses naming fly auth login, and ran nothing that creates", async () => {
      const f = fakeFly({ whoami: null, apps: [], volumes: [], ips: [] });
      await expect(deploy(wanted, deps(f.fly))).rejects.toThrow(/fly auth login/);
      expect(f.writes()).toEqual([]);
    });
    it("A14 — the name is taken by something not recorded as this project's server: refuses naming the app and --app", async () => {
      const f = fakeFly({ whoami: "me", apps: ["indusk-seat-holds"], volumes: [], ips: [] });
      await expect(deploy({ ...wanted, recordedApp: null }, deps(f.fly))).rejects.toThrow(/indusk-seat-holds.*--app/s);
      expect(f.writes()).toEqual([]);
    });
    it("A17 — read-back fails: non-zero naming what did not come back, the server recorded, a second run finishes", async () => {
      const f = fakeFly({ whoami: "me", apps: [], volumes: [], ips: [] });
      const d = deps(f.fly, { async probe(t) { throw new WatcherBlind(t.queryUrl, t.otlpUrl, "nothing came back"); } });
      const err = await deploy(wanted, d).catch((e) => e);
      expect(String(err.message)).toMatch(/watcher blind/); expect(String(err.message)).toMatch(/exists.*run .*again/s);
      // and readConfig(root).server equals { provider: "fly", app: "indusk-seat-holds", org: "personal", region: "iad" }
    });
    it("A20 — pulls the published image for its version; never builds", async () => {
      const f = fakeFly({ whoami: "me", apps: [], volumes: [], ips: [] }); const d = deps(f.fly);
      await deploy(wanted, d);
      const dep = f.calls.find((c) => c.args[0] === "deploy")!;
      expect(dep.args).toContain("--image"); expect(dep.args.join(" ")).not.toMatch(/--dockerfile|--local-only|--remote-only|--build-arg/);
    });
  });
  ```

#### Deferred to Build Phase 3

- **A4, A8** — live checks against Fly, run by hand with `INDUSK_LIVE_FLY=1`; their subject is `deploy --build-from`, which Build Phase 3 introduces so an unreleased build can be deployed before any release publishes the image. Body reviewed:

  ```typescript
  // apps/indusk-mcp/e2e/server-live.e2e.test.ts
  // promise: a-fly-deploy-is-one-command
  // promise: a-project-connects-to-its-server-in-one-command
  import { describe, expect, it } from "vitest";
  // Skipped by name without INDUSK_LIVE_FLY=1 and a signed-in fly; costs money while the app exists.
  describe.skipIf(process.env.INDUSK_LIVE_FLY !== "1")("live — a server on Fly in one command", () => {
    it("A8 — deploy --build-from <packed tarball> --app indusk-sp-live ends connected and alive within ten minutes", async () => {
      // spawn the built CLI: `indusk server deploy --app indusk-sp-live --build-from <tarball>` in a scratch project;
      // assert exit 0, the project's promises.jaeger names https://indusk-sp-live.fly.dev:16687, and
      // `indusk promises status` reads production without "watcher blind"; record the wall time to the plan.
      expect(true).toBe(false); // replaced by the assertions above at authoring
    }, 10 * 60_000);
    it("A4 — connect the demo app to that server; the admin's Promises page lists its promises", async () => {
      // `indusk server connect` in examples/seat-holds, then fetch the admin's /p/<name>/promises and assert the
      // production source and the seat-holds promise appear.
      expect(true).toBe(false);
    });
  });
  ```

#### Test Phase 1 Verification

- [x] (A18: no image step, no script; A21: no page, nine names missing; A19, through the system config on this machine with Docker 28: no template, no script, so no build and no container — four assertion failures, no load error; the one ENOENT in A18 is a read over the filesystem boundary of a file that does not exist) A18, A19 and A21 are authored, and each red one fails on its own assertion (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/release-script.test.ts src/__tests__/server-guide.test.ts`; A19 by `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/always-on-image.test.ts` on a machine where `docker info` answers)
- [x] (reviewed: the sources reader is `sourceNames` + `resolveMarkSources`, and A3's body now reads production with the variable absent from the environment — which found that nothing loads `~/.indusk/config.env`, an item added to Build Phase 1; `WatcherBlind` takes `(where, intake, reason)`, corrected in two bodies; `readConfig`, `jaegerEndpoint` and `probeWatcher` exist as named; the deploy bodies compile against the seams Build Phase 2 introduces; A4 and A8 bodies are placeholders that state their real assertions in comments, to be written at Build Phase 3) Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims — in particular the exported name of the sources reader for A3, confirmed against `lib/promises/sources.ts`

### Build Phase 1: Connect

**Goal**: the provider-free command — name a server, store its credential on the machine, read it back first — and the redaction and secrets-file pieces deploy will share.

- [ ] `lib/server/redact.ts`: `redactingWriter(sink: (line: string) => void, secrets: string[]): { line(text: string): void }` replacing every secret with `[redacted]`; every line both commands print goes through it
- [ ] `lib/server/secrets-file.ts`: `secretsFile(path): { set(name, value): void; get(name): string | undefined; path }` over `~/.indusk/config.env` — one `NAME=value` per line, a set replaces the line of that name, the file written durably with mode `0o600`; `lib/infra-config.ts` keeps reading it
- [ ] `lib/server/connect.ts`: `connect(input: { projectRoot, projectName, queryUrl, otlpUrl, credential }, deps: ConnectDeps)` — probes first through `deps.probe` (the real one is `probeWatcher` with the public addresses), throws `WatcherBlind` unchanged when it does not return and writes nothing; then writes `promises.jaeger` `{ url, otlp_url, credential_env: INDUSK_SERVER_<PROJECT>_CREDENTIAL }` through `ensureConfigBlock`, and the value through the secrets file; a second connect replaces both (A12)
- [ ] (found at Test Phase 1's review) `lib/promises/sources.ts` `resolveProduction` reads the credential from the process environment only, and nothing loads `~/.indusk/config.env` — the deployed dusk server works because the shell exports its variable. Read the variable from the environment first, else from the secrets file (`secretsFile(join(induskHome(), "config.env")).get(name)`), so a project connected by `server connect` reads production on the next read, in the admin too, with no shell restart (A3); the refusal when neither has it names both places
- [ ] `bin/commands/server.ts` `serverConnect(opts)` and `server connect <query-url> --intake <otlp-url> [--credential-env NAME]` registered in `bin/cli.ts`; the credential from `--credential-env`'s variable or a hidden prompt, never an argument; exit 2 on `WatcherBlind` with its message
- [ ] A1, A2, A3, A9 (connect half), A10 (connect half), A12, A15, A16 authored from the register, red first, then green

#### Build Phase 1 Verification

- [ ] A1, A2, A3, A12, A15, A16 pass; A9 and A10 pass for connect and stay `written` until Build Phase 2 adds deploy (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/server && pnpm exec vitest related src/lib/server/connect.ts src/lib/server/secrets-file.ts src/bin/commands/server.ts src/bin/cli.ts`)
- [ ] `pnpm exec tsc --noEmit -p apps/indusk-mcp/tsconfig.json` and `pnpm exec biome check apps/indusk-mcp/src/lib/server apps/indusk-mcp/src/bin/commands/server.ts` clean

#### Build Phase 1 Context

- [ ] root (Key Decisions): `- Server provisioning: connect is provider-free, Fly is the one-command fast path into the person's own account, the image is published with each release; no hosted service — see /decisions/server-provisioning` — always-on because it is the product's boundary with every host, which every plan touching the server or the release must know
- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`, "One home per fact"): `lib/server/secrets-file.ts` is the one writer of `~/.indusk/config.env` and `lib/infra-config.ts` its reader; with one entry there moved down a tier to make room (the file is at 16376 of 16384 bytes)

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/server.md`: `connect` — its arguments, what it writes where, the refusal wording, the credential never on the command line; `apps/docs/src/changelog.md` Unreleased: Added `indusk server connect`

### Build Phase 2: Deploy on Fly

**Goal**: one command into the person's own Fly account, decided by a pure planner over recorded Fly state, ending in connect.

- [ ] `lib/server/fly.ts`: `FlyCli { run(args, { stdin? }) → { status, stdout, stderr } }`; `realFly()` spawns `fly` with stdin piped, and answers `{ status: 127 }` naming the CLI when it is not on PATH
- [ ] `lib/server/fly-state.ts`: `readFlyState(fly, app) → FlyState { signedIn, apps, volumes, ips }` from `fly auth whoami`, `fly apps list --json`, and for an existing app `fly volumes list -a <app> --json` and `fly ips list -a <app> --json`
- [ ] `lib/server/plan-deploy.ts`: `planDeploy(state, wanted) → Step[] | Refusal` — refuses when not signed in (naming `fly auth login`) or when the app exists and is not the project's recorded one (naming the app and `--app`); otherwise the steps that are missing, in order: `apps create`, `volumes create`, `secrets import` (only when the app is new or `--rotate`), `deploy --image ghcr.io/infinitedusky/indusk-always-on:<version> --ha=false -c <generated>`, `ips allocate-v6`, `ips allocate-v4 --yes`
- [ ] `templates/server/fly.toml` and `renderFlyConfig({ app, region })` → the reference configuration with the app's name and public query URL; written to a temporary directory per run
- [ ] `lib/config.ts`: the `server` block `{ provider: "fly"; app: string; org: string; region: string }`, written through `ensureConfigBlock` after the app exists and before the read-back, so a failed read-back still leaves a second run its identity (A17)
- [ ] `lib/server/deploy.ts`: `deploy(wanted, deps: DeployDeps { fly, probe, connect, secrets, out, random })` — generates the password (`random()`, 24 bytes hex in the real deps), sends both secrets on stdin, runs the plan, prints through the redacting writer, prints "announcements are off" without a webhook, records the `server` block, then calls `connect` with the public addresses; a `WatcherBlind` from connect becomes a message that names what did not come back and says the server exists and a second run finishes
- [ ] `server deploy [--app] [--org] [--region] [--slack-webhook-env NAME] [--version] [--rotate]` in `bin/commands/server.ts` and `cli.ts`; defaults: `indusk-<project>`, the account's only org (refuse naming `--org` when there are several), the template's region, the running version
- [ ] A5, A6, A7, A11, A13, A14, A17, A20 and the deploy halves of A9 and A10 authored from the register, red first, then green
- [ ] (found in Test Phase 1) The server refuses to start without `INDUSK_SERVER_SLACK_WEBHOOK` (`readServerSettings` and `readPassSettings` in `lib/telemetry/server.ts` call `required`), so A7's deploy without a webhook would deploy a server that never starts. Make the webhook optional in both readers — no webhook means the pass records and announces nothing, and the server logs once that announcements are off — and change `always-on-image.test.ts`'s "a container without %s exits naming it" case so the webhook is not among the settings a container must have

#### Build Phase 2 Verification

- [ ] A5, A6, A7, A9, A10, A11, A13, A14, A17, A20 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/server && pnpm exec vitest related src/lib/server/deploy.ts src/lib/server/plan-deploy.ts src/lib/server/fly.ts src/lib/config.ts`)
- [ ] `pnpm exec tsc --noEmit -p apps/indusk-mcp/tsconfig.json` and biome clean over `src/lib/server`, `src/bin/commands/server.ts`, `templates/server`

#### Build Phase 2 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`, "Promises and telemetry"): `planDeploy` is pure over a recorded `FlyState` and every Fly write goes through `FlyCli`; a new Fly call is added to the state reader and the planner, never spawned from a command — with the entry compressed to rule + pointer

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/server.md`: `deploy` — every flag, the order of steps, every refusal and its wording, the `server` config block; `apps/docs/src/guide/run-your-own-server.md` (first version): on Fly in one command, then connect; `apps/docs/src/guide/always-on.md` "On Fly": the hand procedure stays, with a line pointing at the command; changelog: Added `indusk server deploy`

### Build Phase 3: The image, published with the release

**Goal**: the release builds the server's image from its own tarball and pushes it first; an unreleased build can still be deployed for a live check.

- [ ] `templates/server/Dockerfile`: `ARG TARBALL`, `COPY ${TARBALL} /tmp/indusk.tgz`, `npm install -g /tmp/indusk.tgz`; `docker/Dockerfile.always-on` becomes a copy pinned equal to the template by `always-on-image.test.ts` (the repo's documented reference, the package's the one that ships)
- [ ] `apps/indusk-mcp/scripts/release-image.sh`: (A19 runs it with `INDUSK_IMAGE_PUSH=0` and `INDUSK_IMAGE=<local name>`, so it honours both: the push is skipped when the first is `0`, and the second replaces `ghcr.io/infinitedusky/indusk-always-on` for the tags; it builds the package first, since `pnpm pack` alone does not) `pnpm pack` to a temp dir, `docker build -f templates/server/Dockerfile --build-arg TARBALL=<tgz> -t ghcr.io/infinitedusky/indusk-always-on:<version> -t …:latest`, `docker push` both tags; exits non-zero naming `docker login ghcr.io` when the push is refused for auth
- [ ] `package.json` `release`: `bash scripts/release-guard.sh && pnpm -w test:system && npm whoami && bash scripts/release-image.sh && npm_config_loglevel=warn pnpm publish --no-git-checks && node scripts/record-release.js` (A18 goes green)
- [ ] `deploy --build-from <tarball>`: builds the image locally through the same template and runs `fly deploy --local-only` with the built tag instead of `--image`; A20's rule holds for the default path only, and the flag's help says it is for an unreleased build
- [ ] A4 and A8 authored in `e2e/server-live.e2e.test.ts` from the register, `written`, skipped by name without `INDUSK_LIVE_FLY=1`

#### Build Phase 3 Verification

- [ ] A18 and A21 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/release-script.test.ts src/__tests__/server-guide.test.ts`); A19 passes in the system tier on this machine (`pnpm exec vitest run --config vitest.system.config.ts src/__tests__/always-on-image.test.ts`, Docker 28 present); A4 and A8 flip to `written`

#### Build Phase 3 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`, "Releases" entry, compressed): the release pushes the server image before `pnpm publish`, so a failed push publishes nothing; the release machine needs Docker and `docker login ghcr.io` once

#### Build Phase 3 Document

- [ ] `apps/docs/src/guide/run-your-own-server.md`: the "anywhere" section — the published image's name, what the server needs (every setting without a default, the volume, the two ports), a `docker run` and a compose example, then connect (A21 goes green); `apps/docs/src/reference/cli/telemetry-server.md`: the image is built from the release's tarball and published as `ghcr.io/infinitedusky/indusk-always-on:<version>`; `apps/indusk-mcp/skills/retrospective.md` Step 11: a project that publishes an image logs in to its registry before `pnpm release`; changelog: Changed, the release builds and pushes the image first

### Build Phase 4: Live on Fly

**Goal**: the one real run of each live check, recorded with its duration and cost, and the demo app connected to a server this plan made.

- [ ] A8: in a scratch project, `indusk server deploy --app indusk-sp-live --build-from <tarball>` with `fly` signed in; record in this file the wall time, each Fly step's duration, and the cost line from `fly` (machine, volume, dedicated IPv4) — run `INDUSK_LIVE_FLY=1 pnpm exec vitest run --config vitest.system.config.ts e2e/server-live.e2e.test.ts`
- [ ] A4: `indusk server connect` in `examples/seat-holds` against `indusk-sp-live`; open the admin's Promises page for it and record that the production source and the seat-holds promise appear
- [ ] Destroy the scratch app by hand (`fly apps destroy indusk-sp-live`) so it stops costing money, and record that teardown stays manual (the brief's Not promised)

#### Build Phase 4 Verification

- [ ] A4 and A8 pass, each recorded above with its result, duration and cost; the row states set `passing` in the same edit

#### Build Phase 4 Context

- [ ] current.md (Project, shared): one line — the demo's step 5 is built; what a server costs per month on Fly from the recorded bill; the deployed dusk server unchanged

#### Build Phase 4 Document

- [ ] `apps/docs/src/guide/run-your-own-server.md`: an "Observed" note with the recorded duration and monthly cost of a server on Fly, dated

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/server/{redact,secrets-file,connect,fly,fly-state,plan-deploy,deploy}.ts` | new |
| `apps/indusk-mcp/src/bin/commands/server.ts`, `src/bin/cli.ts` | new command group `server` with `connect` and `deploy` |
| `apps/indusk-mcp/src/lib/config.ts` | the `server` block |
| `apps/indusk-mcp/templates/server/{Dockerfile,fly.toml}` | new, shipped in the package |
| `apps/indusk-mcp/scripts/release-image.sh`, `apps/indusk-mcp/package.json` | the image step before publish |
| `docker/Dockerfile.always-on`, `docker/fly.always-on.toml` | the repo's references, pinned to the templates |
| `apps/indusk-mcp/src/__tests__/{release-script,always-on-image,server-guide}.test.ts`, `src/lib/server/*.test.ts`, `e2e/server-live.e2e.test.ts` | the rows |
| `apps/docs/src/guide/run-your-own-server.md`, `reference/cli/server.md`, `guide/always-on.md`, `reference/cli/telemetry-server.md`, `changelog.md` | docs |
| `apps/indusk-mcp/skills/retrospective.md` | the registry login before a release that publishes an image |
| `CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `.indusk/current.md` | context |

## Dependencies

- `fly` signed in on the machine that runs Build Phase 4 (v0.4.111 is, as `agcorsillo@gmail.com`, org `personal`)
- Docker on the machine that runs A19 and `release-image.sh` (28.5.0 is here); `docker login ghcr.io` once before the first release that publishes the image — Sandy's, with a token that can write packages
- The dusk server on Fly stays as it is; the live check uses its own app

## Notes

- Whether `--org` defaults to the account's only org or is always asked is decided in Build Phase 2 by what `fly orgs list --json` returns for an account with one.
- The decisions page `decisions/server-provisioning.md` is the retrospective's Step 8, not a build item.
