import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readConfig } from "../config.js";
import { WatcherBlind } from "../promises/probe.js";
import { resolveMarkSources, sourceNames } from "../promises/sources.js";
import { jaegerEndpoint } from "../promises/telemetry.js";
import { type ConnectDeps, connect } from "./connect.js";
import { secretsFile } from "./secrets-file.js";

/**
 * server-provisioning: `indusk server connect` points a project at a
 * recording server the person runs, wherever it runs.
 *
 * promise: a-project-connects-to-its-server-in-one-command
 * promise: a-second-run-updates-not-duplicates
 * promise: a-server-is-read-back-before-the-command-ends
 * promise: provisioning-never-prints-a-secret
 */

const VAR = "INDUSK_SERVER_SEAT_HOLDS_CREDENTIAL";
const server = {
	queryUrl: "https://x.fly.dev:16687",
	otlpUrl: "https://x.fly.dev",
	credential: "indusk:pw-1",
};
const previousHome = process.env.INDUSK_HOME;

beforeEach(() => {
	delete process.env[VAR];
});
afterEach(() => {
	if (previousHome === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = previousHome;
	delete process.env[VAR];
});

function project(): { root: string; home: string } {
	const root = mkdtempSync(join(tmpdir(), "sp-root-"));
	const home = mkdtempSync(join(tmpdir(), "sp-home-"));
	mkdirSync(join(root, ".indusk"));
	writeFileSync(
		join(root, ".indusk", "config.json"),
		`${JSON.stringify({ project: { name: "seat-holds" }, promises: { domains: ["demo"] } }, null, "\t")}\n`,
	);
	return { root, home };
}

function deps(
	home: string,
	opts: {
		probed?: { queryUrl: string; otlpUrl: string }[];
		blind?: boolean;
		printed?: string[];
	} = {},
): ConnectDeps {
	return {
		async probe(t) {
			opts.probed?.push({ queryUrl: t.queryUrl, otlpUrl: t.otlpUrl });
			if (opts.blind) throw new WatcherBlind(t.queryUrl, t.otlpUrl, "nothing came back");
		},
		secrets: secretsFile(join(home, "config.env")),
		out: { line: (l) => opts.printed?.push(l) },
	};
}

const input = (root: string, over: Partial<typeof server> = {}) => ({
	projectRoot: root,
	projectName: "seat-holds",
	...server,
	...over,
});

describe("connect", () => {
	it("A1 — names the server in the config by its addresses and the credential's variable, never the value", async () => {
		const { root, home } = project();
		await connect(input(root), deps(home));
		expect(readConfig(root)?.promises?.jaeger).toEqual({
			url: server.queryUrl,
			otlp_url: server.otlpUrl,
			credential_env: VAR,
		});
		expect(readConfig(root)?.promises?.domains).toEqual(["demo"]);
		expect(readFileSync(join(root, ".indusk", "config.json"), "utf-8")).not.toContain("pw-1");
	});

	it("A2 — stores the value in the secrets file under that variable, owner-only", async () => {
		const { root, home } = project();
		await connect(input(root), deps(home));
		expect(readFileSync(join(home, "config.env"), "utf-8")).toContain(`${VAR}=indusk:pw-1`);
		expect(statSync(join(home, "config.env")).mode & 0o777).toBe(0o600);
	});

	it("A3 — the next promise read has two sources, and production is the server, with no shell restart", async () => {
		const { root, home } = project();
		process.env.INDUSK_HOME = home;
		await connect(input(root), deps(home));
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
		await connect(input(root), deps(home));
		await connect(
			input(root, { queryUrl: "https://y.fly.dev:16687", credential: "indusk:pw-2" }),
			deps(home),
		);
		expect(readConfig(root)?.promises?.jaeger?.url).toBe("https://y.fly.dev:16687");
		const env = readFileSync(join(home, "config.env"), "utf-8");
		expect(env.match(new RegExp(`^${VAR}=`, "gm"))).toHaveLength(1);
		expect(env).toContain("pw-2");
		expect(env).not.toContain("pw-1");
	});

	it("A12 — a secrets file holding other variables keeps them", async () => {
		const { root, home } = project();
		writeFileSync(join(home, "config.env"), "INDUSK_DEPLOYED_CREDENTIAL=indusk:other\n");
		await connect(input(root), deps(home));
		expect(readFileSync(join(home, "config.env"), "utf-8")).toContain(
			"INDUSK_DEPLOYED_CREDENTIAL=indusk:other",
		);
	});

	it("A15 — a server whose mark does not come back is not named: watcher blind with both addresses, config unchanged", async () => {
		const { root, home } = project();
		const before = readFileSync(join(root, ".indusk", "config.json"), "utf-8");
		const err = await connect(input(root), deps(home, { blind: true })).catch((e: Error) => e);
		expect(err).toBeInstanceOf(WatcherBlind);
		expect(String((err as Error).message)).toContain(server.otlpUrl);
		expect(String((err as Error).message)).toContain(server.queryUrl);
		expect(readFileSync(join(root, ".indusk", "config.json"), "utf-8")).toBe(before);
		expect(() => statSync(join(home, "config.env"))).toThrow();
	});

	it("A16 — the read-back uses the addresses the project will use", async () => {
		const { root, home } = project();
		const probed: { queryUrl: string; otlpUrl: string }[] = [];
		await connect(input(root), deps(home, { probed }));
		expect(probed).toEqual([{ queryUrl: server.queryUrl, otlpUrl: server.otlpUrl }]);
	});

	it("A9 — nothing connect prints holds the credential", async () => {
		const { root, home } = project();
		const printed: string[] = [];
		await connect(input(root), deps(home, { printed }));
		expect(printed.length).toBeGreaterThan(0);
		expect(printed.join("\n")).not.toContain("pw-1");
	});

	it("A10 — the only change under the project is its config, and it holds no secret", async () => {
		const { root, home } = project();
		const git = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf-8" });
		git("init", "-q");
		git("add", ".");
		git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "start");
		await connect(input(root), deps(home));
		expect(git("status", "--porcelain").stdout.trimEnd().split("\n")).toEqual([
			" M .indusk/config.json",
		]);
		expect(readFileSync(join(root, ".indusk", "config.json"), "utf-8")).not.toContain("pw-1");
	});
});
