import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeWatcher } from "../lib/promises/probe.js";
import { JaegerUnreachable, jaegerEndpoint } from "../lib/promises/telemetry.js";
import { freeLoopbackPort } from "../lib/telemetry/query-door.js";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * day-always-on-deploy — A1: a container missing a setting says which.
 *
 * It built the image from the published package until server-provisioning;
 * every release now builds it from its own tarball through
 * `scripts/release-image.sh` (A19 below), and both parts of this file share
 * that one build. The repository's `docker/Dockerfile.always-on` is a copy of
 * the package's template, pinned here.
 *
 * Skipped by name when no docker daemon answers — a machine without one
 * cannot say anything about the image, which is not the same as passing.
 */

const SETTINGS: Record<string, string> = {
	INDUSK_SERVER_VOLUME: "/data",
	INDUSK_SERVER_OTLP_PORT: "4318",
	INDUSK_SERVER_QUERY_PORT: "16686",
	INDUSK_SERVER_USER: "indusk",
	INDUSK_SERVER_PASSWORD: "image-test-password",
	INDUSK_SERVER_SLACK_WEBHOOK: "http://127.0.0.1:1/never",
};

const dockerAnswers = spawnSync("docker", ["info"], { encoding: "utf-8" }).status === 0;

const PKG = join(REPO_ROOT, "apps/indusk-mcp");
const TEMPLATE = join(PKG, "templates/server/Dockerfile");
const RELEASE_IMAGE = join(PKG, "scripts/release-image.sh");
const LOCAL_IMAGE = "indusk-always-on-release-test";
const version = JSON.parse(readFileSync(join(PKG, "package.json"), "utf-8")).version as string;
const TAG = `${LOCAL_IMAGE}:${version}`;

/** The release's own build, run once for the whole file, with the push off. */
let build: { status: number | null; output: string } | null = null;
function releaseBuild(): { status: number | null; output: string } {
	if (build) return build;
	if (!existsSync(RELEASE_IMAGE) || !existsSync(TEMPLATE)) {
		build = { status: null, output: "no release image script or template" };
		return build;
	}
	const r = spawnSync("bash", [RELEASE_IMAGE], {
		cwd: PKG,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_IMAGE_PUSH: "0", INDUSK_IMAGE: LOCAL_IMAGE },
		maxBuffer: 64 * 1024 * 1024,
	});
	build = { status: r.status, output: `${r.stdout}${r.stderr}` };
	return build;
}

describe("the repository's Dockerfile is the package's template", () => {
	it("docker/Dockerfile.always-on is byte-identical to templates/server/Dockerfile", () => {
		expect(readFileSync(join(REPO_ROOT, "docker/Dockerfile.always-on"), "utf-8")).toBe(
			readFileSync(TEMPLATE, "utf-8"),
		);
	});
});

describe.skipIf(!dockerAnswers)(
	"A1 — the always-on image refuses a missing setting by name",
	() => {
		beforeAll(() => {
			releaseBuild();
		}, 900_000);

		// The webhook is optional since server-provisioning A7: a server without it
		// records and announces nothing, so it is not among the settings a container
		// must have.
		it.each(Object.keys(SETTINGS).filter((k) => k !== "INDUSK_SERVER_SLACK_WEBHOOK"))(
			"a container without %s exits naming it",
			(missing) => {
				expect(releaseBuild().status, releaseBuild().output.slice(-2_000)).toBe(0);
				const env = Object.entries(SETTINGS)
					.filter(([k]) => k !== missing)
					.flatMap(([k, v]) => ["-e", `${k}=${v}`]);
				const r = spawnSync("docker", ["run", "--rm", ...env, TAG], {
					encoding: "utf-8",
					timeout: 60_000,
				});
				const output = `${r.stdout}${r.stderr}`;
				expect(r.status, output).not.toBe(0);
				expect(output).toContain(missing);
			},
			90_000,
		);
	},
);

/**
 * server-provisioning A19: the image a release publishes is built from that
 * release's own packed tarball, by the release's own image script, and runs
 * with a volume, its two ports and its two secrets — no checkout, no npm —
 * and answers a mark sent through it.
 *
 * The script runs with the push off (`INDUSK_IMAGE_PUSH=0`) and a local
 * image name, so this test never writes to a registry.
 *
 * promise: the-recording-server-runs-from-a-published-image
 */
describe.skipIf(!dockerAnswers)("A19 — the image the release builds runs and answers", () => {
	let built: { status: number | null; output: string } = { status: null, output: "" };
	let container: string | null = null;
	let ports = { otlp: 0, query: 0 };

	beforeAll(async () => {
		built = releaseBuild();
		if (built.status !== 0) return;
		ports = { otlp: await freeLoopbackPort(), query: await freeLoopbackPort() };
		const volume = mkdtempSync(join(tmpdir(), "a19-volume-"));
		const run = spawnSync(
			"docker",
			[
				"run",
				"-d",
				"--rm",
				"-v",
				`${volume}:/data`,
				"-p",
				`127.0.0.1:${ports.otlp}:4318`,
				"-p",
				`127.0.0.1:${ports.query}:16686`,
				"-e",
				"INDUSK_SERVER_VOLUME=/data",
				"-e",
				"INDUSK_SERVER_OTLP_PORT=4318",
				"-e",
				"INDUSK_SERVER_QUERY_PORT=16686",
				"-e",
				"INDUSK_SERVER_USER=indusk",
				"-e",
				"INDUSK_SERVER_PASSWORD=a19-password",
				"-e",
				"INDUSK_SERVER_SLACK_WEBHOOK=http://127.0.0.1:1/never",
				TAG,
			],
			{ encoding: "utf-8" },
		);
		container = run.status === 0 ? run.stdout.trim() : null;
		built.output += run.stderr;
	}, 900_000);

	afterAll(() => {
		if (container) spawnSync("docker", ["rm", "-f", container]);
	});

	it("the release has a server Dockerfile template and an image script", () => {
		expect(existsSync(TEMPLATE), "templates/server/Dockerfile").toBe(true);
		expect(existsSync(RELEASE_IMAGE), "scripts/release-image.sh").toBe(true);
	});

	it("the template installs a tarball it is given, never npm", () => {
		const dockerfile = existsSync(TEMPLATE) ? readFileSync(TEMPLATE, "utf-8") : "";
		expect(dockerfile).toMatch(/ARG TARBALL/);
		expect(dockerfile).not.toMatch(/npm install -g "@infinitedusky/);
	});

	it("builds the image for the package version and starts it", () => {
		expect(built.status, built.output.slice(-2_000)).toBe(0);
		expect(container, built.output.slice(-2_000)).not.toBeNull();
	});

	it("answers a mark sent through its intake, read back from its query API", async () => {
		expect(container).not.toBeNull();
		const target = {
			endpoint: jaegerEndpoint(`http://127.0.0.1:${ports.query}`, "indusk:a19-password"),
			intakeUrl: `http://127.0.0.1:${ports.otlp}`,
		};
		// A container that has just started is not listening yet: wait for it to
		// answer at all, then require the mark to come back.
		const deadline = Date.now() + 90_000;
		let last: unknown = null;
		while (Date.now() < deadline) {
			try {
				await probeWatcher(target, { project: "a19", waitMs: 30_000 });
				last = null;
				break;
			} catch (err) {
				last = err;
				if (!(err instanceof JaegerUnreachable)) break;
				await new Promise((r) => setTimeout(r, 2_000));
			}
		}
		const logs = container ? spawnSync("docker", ["logs", container], { encoding: "utf-8" }) : null;
		expect(
			last,
			`${String(last)}\n${logs?.stdout ?? ""}${logs?.stderr ?? ""}`.slice(-3_000),
		).toBeNull();
	}, 180_000);
});
