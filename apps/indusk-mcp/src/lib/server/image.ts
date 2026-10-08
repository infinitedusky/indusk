import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeployRefused } from "./deploy.js";
import { DOCKERFILE_TEMPLATE } from "./fly-config.js";

/**
 * Build the recording server's image from a packed tarball through the
 * package's own template, and push it to the app's Fly registry — the real
 * `DeployDeps.buildImage` for `server deploy --build-from` (server-provisioning
 * Build Phase 3; moved out of the command at cleanup).
 */
export async function buildServerImage(tarball: string, tag: string): Promise<void> {
	const ctx = mkdtempSync(join(tmpdir(), "indusk-image-"));
	copyFileSync(tarball, join(ctx, "indusk.tgz"));
	const r = spawnSync(
		"docker",
		// Fly runs amd64; a build on Apple Silicon is arm64 unless told (A8 found it).
		[
			"build",
			"--platform",
			"linux/amd64",
			"-f",
			DOCKERFILE_TEMPLATE,
			"--build-arg",
			"TARBALL=indusk.tgz",
			"-t",
			tag,
			ctx,
		],
		{ stdio: "inherit" },
	);
	if (r.status !== 0)
		throw new DeployRefused(
			`docker build of ${tag} failed (exit ${r.status}); nothing was deployed.`,
		);
	const login = spawnSync("fly", ["auth", "docker"], { stdio: "inherit" });
	if (login.status !== 0)
		throw new DeployRefused("`fly auth docker` failed; the image was built and not pushed.");
	const push = spawnSync("docker", ["push", tag], { stdio: "inherit" });
	if (push.status !== 0) {
		throw new DeployRefused(
			`docker push of ${tag} failed (exit ${push.status}); nothing was deployed.`,
		);
	}
}
