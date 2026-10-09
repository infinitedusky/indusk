import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readConfig } from "../config.js";
import { WatcherBlind } from "../promises/probe.js";
import { JaegerUnreachable } from "../promises/telemetry.js";
import type { ConnectInput } from "./connect.js";
import { credentialEnvFor } from "./connect.js";
import { type DeployDeps, type DeployInput, deploy } from "./deploy.js";
import type { FlyCli, FlyResult } from "./fly.js";
import { secretsFile } from "./secrets-file.js";

/** The variable this project's credential is stored under. */
const storedVar = (root: string) => credentialEnvFor(root, "seat-holds");

/**
 * server-provisioning: `indusk server deploy` creates a project's recording
 * server in the person's own Fly account and connects the project. Fly is a
 * recorded fake that answers reads from a state and records every write.
 *
 * promise: a-fly-deploy-is-one-command
 * promise: a-second-run-updates-not-duplicates
 * promise: provisioning-refuses-what-it-cannot-do
 * promise: a-server-is-read-back-before-the-command-ends
 * promise: the-recording-server-runs-from-a-published-image
 * promise: provisioning-never-prints-a-secret
 */

interface FakeState {
	cli: "ok" | "missing" | "signed-out";
	orgs: string[];
	apps: { Name: string; Organization: { Slug: string } }[];
	volumes: { name: string }[];
	ips: { Type: string }[];
	/** Reads that exit non-zero, as `volumes list`. */
	failing?: string[];
}

const READS = ["auth whoami", "orgs list", "apps list", "volumes list", "ips list"];

function fakeFly(state: FakeState) {
	const calls: { args: string[]; stdin?: string }[] = [];
	const ok = (stdout: string): FlyResult => ({ status: 0, stdout, stderr: "" });
	const fly: FlyCli = {
		async run(args, opts) {
			calls.push({ args: [...args], stdin: opts?.stdin });
			const cmd = args.slice(0, 2).join(" ");
			if (state.failing?.includes(cmd))
				return { status: 1, stdout: "", stderr: `${cmd}: connection reset` };
			if (state.cli === "missing")
				return { status: 127, stdout: "", stderr: "fly: command not found" };
			if (cmd === "auth whoami") {
				return state.cli === "ok"
					? ok("me@example.com")
					: { status: 1, stdout: "", stderr: "not logged in" };
			}
			if (cmd === "orgs list")
				return ok(JSON.stringify(Object.fromEntries(state.orgs.map((o) => [o, o]))));
			if (cmd === "apps list") return ok(JSON.stringify(state.apps));
			if (cmd === "volumes list") return ok(JSON.stringify(state.volumes));
			if (cmd === "ips list") return ok(JSON.stringify(state.ips));
			// Fly may echo what it was sent; the secret must still not be printed.
			if (cmd === "secrets import") return ok(`Secrets are staged: ${opts?.stdin ?? ""}`);
			return ok("");
		},
	};
	const writes = () => calls.filter((c) => !READS.includes(c.args.slice(0, 2).join(" ")));
	return { fly, calls, writes };
}

const fresh = (): FakeState => ({ cli: "ok", orgs: ["personal"], apps: [], volumes: [], ips: [] });
const existing = (): FakeState => ({
	cli: "ok",
	orgs: ["personal"],
	apps: [{ Name: "indusk-seat-holds", Organization: { Slug: "personal" } }],
	volumes: [{ name: "indusk_telemetry" }],
	ips: [{ Type: "v4" }, { Type: "v6" }],
});

function project(server?: Record<string, string>): { root: string; home: string } {
	const root = mkdtempSync(join(tmpdir(), "sp-deploy-root-"));
	const home = mkdtempSync(join(tmpdir(), "sp-deploy-home-"));
	mkdirSync(join(root, ".indusk"));
	writeFileSync(
		join(root, ".indusk", "config.json"),
		`${JSON.stringify({ promises: { domains: ["demo"] }, ...(server ? { server } : {}) }, null, "\t")}\n`,
	);
	return { root, home };
}

function deps(fly: FlyCli, home: string, over: Partial<DeployDeps> = {}) {
	const printed: string[] = [];
	const connected: ConnectInput[] = [];
	const d: DeployDeps = {
		fly,
		secrets: secretsFile(join(home, "config.env")),
		print: (l) => printed.push(l),
		random: () => "pw-1",
		tempDir: () => mkdtempSync(join(tmpdir(), "sp-fly-")),
		async connect(input, out) {
			connected.push(input);
			out.line(`connected with ${input.credential}`);
			return { credentialEnv: "INDUSK_SERVER_SEAT_HOLDS_CREDENTIAL" };
		},
		...over,
	};
	return { d, printed, connected };
}

const input = (root: string, over: Partial<DeployInput> = {}): DeployInput => ({
	projectRoot: root,
	projectName: "seat-holds",
	version: "1.70.0",
	...over,
});
const WEBHOOK = "https://hooks.slack.com/services/T/B/x";
const verbs = (cs: { args: string[] }[]) => cs.map((c) => c.args.slice(0, 2).join(" "));

describe("deploy", () => {
	it("A5 — on a project with no server: app, volume, secrets, deploy, addresses, then connect, in that order", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		const { d, printed, connected } = deps(f.fly, home);
		await deploy(input(root), d);
		expect(verbs(f.writes())).toEqual([
			"apps create",
			"volumes create",
			"secrets import",
			"deploy -a",
			"ips allocate-v6",
			"ips allocate-v4",
		]);
		expect(connected).toEqual([
			{
				projectRoot: root,
				projectName: "seat-holds",
				queryUrl: "https://indusk-seat-holds.fly.dev:16687",
				otlpUrl: "https://indusk-seat-holds.fly.dev",
				credential: "indusk:pw-1",
			},
		]);
		expect(printed.some((l) => /\?\s*$/.test(l))).toBe(false);
	});

	it("A6 — the person's version, one machine, the public query address naming the app, the webhook when given", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		await deploy(input(root, { slackWebhook: WEBHOOK }), deps(f.fly, home).d);
		const dep = f.calls.find((c) => c.args[0] === "deploy");
		expect(dep?.args).toContain("ghcr.io/infinitedusky/indusk-always-on:1.70.0");
		expect(dep?.args).toContain("--ha=false");
		const config = readFileSync(dep?.args[dep.args.indexOf("-c") + 1] ?? "", "utf-8");
		expect(config).toContain('app = "indusk-seat-holds"');
		expect(config).toContain(
			'INDUSK_SERVER_PUBLIC_QUERY_URL = "https://indusk-seat-holds.fly.dev:16687"',
		);
		const sec = f.calls.find((c) => verbs([c])[0] === "secrets import");
		expect(sec?.stdin).toContain(`INDUSK_SERVER_SLACK_WEBHOOK=${WEBHOOK}`);
		expect(sec?.stdin).toContain("INDUSK_SERVER_PASSWORD=pw-1");
	});

	it("A7 — without a webhook it finishes and says announcements are off", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		const { d, printed } = deps(f.fly, home);
		await deploy(input(root), d);
		expect(printed.join("\n")).toMatch(/announcements are off/i);
		expect(f.calls.find((c) => verbs([c])[0] === "secrets import")?.stdin).not.toContain("SLACK");
	});

	it("A9 — nothing printed holds the password or the webhook, even when Fly echoes them", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		const { d, printed } = deps(f.fly, home);
		await deploy(input(root, { slackWebhook: WEBHOOK }), d);
		expect(printed.join("\n")).not.toContain("pw-1");
		expect(printed.join("\n")).not.toContain("services/T/B/x");
	});

	it("A10 — the only change under the project is its config, and it holds no secret", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		const git = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf-8" });
		git("init", "-q");
		git("add", ".");
		git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "start");
		await deploy(input(root, { slackWebhook: WEBHOOK }), deps(f.fly, home).d);
		expect(git("status", "--porcelain").stdout.trimEnd().split("\n")).toEqual([
			" M .indusk/config.json",
		]);
		const config = readFileSync(join(root, ".indusk", "config.json"), "utf-8");
		expect(config).not.toContain("pw-1");
		expect(config).not.toContain("services/T/B/x");
	});

	it("A11 — a second run creates nothing, redeploys, keeps the secrets, connects again", async () => {
		const f = fakeFly(existing());
		const { root, home } = project({
			provider: "fly",
			app: "indusk-seat-holds",
			org: "personal",
			region: "iad",
		});
		writeFileSync(join(home, "config.env"), `${storedVar(root)}=indusk:pw-old\n`);
		const { d, connected } = deps(f.fly, home);
		await deploy(input(root), d);
		expect(verbs(f.writes())).toEqual(["deploy -a"]);
		expect(connected[0]?.credential).toBe("indusk:pw-old");
	});

	it("A11 — a second run on a machine without the credential sets a new password, and nothing else is created", async () => {
		const f = fakeFly(existing());
		const { root, home } = project({
			provider: "fly",
			app: "indusk-seat-holds",
			org: "personal",
			region: "iad",
		});
		const { d, connected } = deps(f.fly, home);
		await deploy(input(root), d);
		expect(verbs(f.writes())).toEqual(["secrets import", "deploy -a"]);
		expect(connected[0]?.credential).toBe("indusk:pw-1");
	});

	it("A13 — the Fly CLI missing: refuses naming how to install it, and ran nothing that creates", async () => {
		const f = fakeFly({ ...fresh(), cli: "missing" });
		const { root, home } = project();
		await expect(deploy(input(root), deps(f.fly, home).d)).rejects.toThrow(
			/install.*fly auth login/is,
		);
		expect(f.writes()).toEqual([]);
	});

	it("A13 — not signed in: refuses naming fly auth login, and ran nothing that creates", async () => {
		const f = fakeFly({ ...fresh(), cli: "signed-out" });
		const { root, home } = project();
		await expect(deploy(input(root), deps(f.fly, home).d)).rejects.toThrow(/fly auth login/);
		expect(f.writes()).toEqual([]);
	});

	it("A13 — several organisations and none named: refuses naming --org and the choices", async () => {
		const f = fakeFly({ ...fresh(), orgs: ["personal", "skills-org"] });
		const { root, home } = project();
		await expect(deploy(input(root), deps(f.fly, home).d)).rejects.toThrow(
			/--org.*personal.*skills-org/s,
		);
		expect(f.writes()).toEqual([]);
	});

	it("A14 — the name is taken by an app not recorded as this project's server: refuses naming the app and --app", async () => {
		const f = fakeFly(existing());
		const { root, home } = project();
		await expect(deploy(input(root), deps(f.fly, home).d)).rejects.toThrow(
			/indusk-seat-holds.*--app/s,
		);
		expect(f.writes()).toEqual([]);
	});

	it("A17 — read-back fails: names what did not come back, records the server, says a second run finishes", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		let clock = 0;
		const { d } = deps(f.fly, home, {
			now: () => clock,
			sleep: async (ms: number) => {
				clock += ms;
			},
			async connect(i) {
				throw new WatcherBlind(i.queryUrl, i.otlpUrl, "nothing came back");
			},
		});
		const err = (await deploy(input(root), d).catch((e: Error) => e)) as Error;
		expect(err.message).toMatch(/watcher blind/);
		expect(err.message).toMatch(/indusk-seat-holds exists/);
		expect(err.message).toMatch(/run .*again/);
		expect((readConfig(root) as unknown as { server?: unknown }).server).toEqual({
			provider: "fly",
			app: "indusk-seat-holds",
			org: "personal",
			region: "iad",
		});
	});

	it("--build-from builds the image here, pushes it to the app's own Fly registry, and deploys that", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		const built: [string, string][] = [];
		const { d } = deps(f.fly, home, {
			stamp: () => "s1",
			async buildImage(tarball, tag) {
				built.push([tarball, tag]);
			},
		});
		await deploy(input(root, { buildFrom: "/tmp/indusk-mcp-1.70.0.tgz" }), d);
		expect(built).toEqual([
			["/tmp/indusk-mcp-1.70.0.tgz", "registry.fly.io/indusk-seat-holds:1.70.0-local-s1"],
		]);
		const dep = f.calls.find((c) => c.args[0] === "deploy");
		expect(dep?.args).toContain("registry.fly.io/indusk-seat-holds:1.70.0-local-s1");
		expect(dep?.args).not.toContain("--local-only");
	});

	it("A8's finding — a new server not reachable yet is waited for, then read back", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		let tries = 0;
		let clock = 0;
		const { d, printed } = deps(f.fly, home, {
			now: () => clock,
			sleep: async (ms: number) => {
				clock += ms;
			},
			async connect(i) {
				tries += 1;
				if (tries < 3) throw new JaegerUnreachable(i.queryUrl, "fetch failed");
				return { credentialEnv: "INDUSK_SERVER_SEAT_HOLDS_CREDENTIAL" };
			},
		});
		await deploy(input(root), d);
		expect(tries).toBe(3);
		expect(printed.join("\n")).toMatch(/not reachable yet/);
	});

	it("A8's finding — a server still unreachable after the wait is reported, with the way to finish", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		let clock = 0;
		let tries = 0;
		const { d } = deps(f.fly, home, {
			now: () => clock,
			sleep: async (ms: number) => {
				clock += ms;
			},
			async connect(i) {
				tries += 1;
				throw new JaegerUnreachable(i.queryUrl, "fetch failed");
			},
		});
		await expect(deploy(input(root), d)).rejects.toThrow(/could not be reached.*run .*again/s);
		expect(clock).toBeGreaterThanOrEqual(5 * 60_000);
		expect(tries).toBeGreaterThan(1);
	});

	it("A22 — a failed listing of an existing app's volumes or addresses refuses, and creates nothing", async () => {
		for (const failing of ["volumes list", "ips list"]) {
			const f = fakeFly({ ...existing(), failing: [failing] });
			const { root, home } = project({
				provider: "fly",
				app: "indusk-seat-holds",
				org: "personal",
				region: "iad",
			});
			writeFileSync(join(home, "config.env"), `${storedVar(root)}=indusk:pw-old\n`);
			await expect(deploy(input(root), deps(f.fly, home).d)).rejects.toThrow(new RegExp(failing));
			expect(f.writes(), failing).toEqual([]);
		}
	});

	it("A23 — a webhook given to an existing server is set on it, and its password kept", async () => {
		const f = fakeFly(existing());
		const { root, home } = project({
			provider: "fly",
			app: "indusk-seat-holds",
			org: "personal",
			region: "iad",
		});
		writeFileSync(join(home, "config.env"), `${storedVar(root)}=indusk:pw-old\n`);
		const { d, connected } = deps(f.fly, home);
		await deploy(input(root, { slackWebhook: WEBHOOK }), d);
		const sec = f.calls.find((c) => verbs([c])[0] === "secrets import");
		expect(sec?.stdin).toContain(`INDUSK_SERVER_SLACK_WEBHOOK=${WEBHOOK}`);
		expect(sec?.stdin ?? "").not.toContain("INDUSK_SERVER_PASSWORD");
		expect(connected[0]?.credential).toBe("indusk:pw-old");
	});

	it("A24 — a stored credential the server rejects is not waited on, and the refusal names --rotate", async () => {
		const f = fakeFly(existing());
		const { root, home } = project({
			provider: "fly",
			app: "indusk-seat-holds",
			org: "personal",
			region: "iad",
		});
		writeFileSync(join(home, "config.env"), `${storedVar(root)}=indusk:pw-stale\n`);
		let clock = 0;
		const { d } = deps(f.fly, home, {
			now: () => clock,
			sleep: async (ms: number) => {
				clock += ms;
			},
			async connect(i) {
				throw new JaegerUnreachable(i.queryUrl, `${i.queryUrl}/api/traces answered 401`);
			},
		});
		const err = (await deploy(input(root), d).catch((e: Error) => e)) as Error;
		expect(err.message).toMatch(/--rotate/);
		expect(clock, "waited on a refused login").toBe(0);
	});

	it("A20 — pulls the published image for its version; never builds", async () => {
		const f = fakeFly(fresh());
		const { root, home } = project();
		await deploy(input(root), deps(f.fly, home).d);
		const dep = f.calls.find((c) => c.args[0] === "deploy");
		expect(dep?.args).toContain("--image");
		expect(dep?.args.join(" ")).not.toMatch(/--dockerfile|--local-only|--remote-only|--build-arg/);
	});
});
