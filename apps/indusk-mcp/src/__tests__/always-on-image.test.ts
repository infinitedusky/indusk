import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * day-always-on-deploy — A1: the image a person deploys builds from the
 * published package, and a container missing a setting says which.
 *
 * `day-always-on` asserted the server's refusals through the CLI; nobody had
 * built the image, because the published package predated `telemetry serve`
 * and the machine that wrote the Dockerfile had no docker daemon. This builds
 * it with the local daemon, pinned to the release the deploy will install,
 * and starts it once per required setting with that one left out.
 *
 * Skipped by name when no docker daemon answers — a machine without one
 * cannot say anything about the image, which is not the same as passing.
 */

const VERSION = "1.58.0";
const TAG = `indusk-always-on-test:${VERSION}`;
const DOCKERFILE = join(REPO_ROOT, "docker/Dockerfile.always-on");

const SETTINGS: Record<string, string> = {
	INDUSK_SERVER_VOLUME: "/data",
	INDUSK_SERVER_OTLP_PORT: "4318",
	INDUSK_SERVER_QUERY_PORT: "16686",
	INDUSK_SERVER_USER: "indusk",
	INDUSK_SERVER_PASSWORD: "image-test-password",
	INDUSK_SERVER_SLACK_WEBHOOK: "http://127.0.0.1:1/never",
};

const dockerAnswers = spawnSync("docker", ["info"], { encoding: "utf-8" }).status === 0;

describe.skipIf(!dockerAnswers)("A1 — the always-on image", () => {
	let built: { status: number | null; output: string };

	beforeAll(() => {
		const r = spawnSync(
			"docker",
			["build", "-f", DOCKERFILE, "--build-arg", `VERSION=${VERSION}`, "-t", TAG, REPO_ROOT],
			{ encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
		);
		built = { status: r.status, output: `${r.stdout}${r.stderr}` };
	}, 600_000);

	it(`builds from the published package (${VERSION})`, () => {
		expect(built.status, built.output.slice(-2_000)).toBe(0);
	});

	it.each(Object.keys(SETTINGS))(
		"a container without %s exits naming it",
		(missing) => {
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
});
