import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Fly configuration for one project's server, rendered per run from the
 * package's template (server-provisioning ADR D7). The repository's
 * `docker/fly.always-on.toml` is the documented reference for people
 * deploying by hand; this template is what ships.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
export const FLY_TEMPLATE = join(packageRoot, "templates/server/fly.toml");

export const DEFAULT_REGION = "iad";

export function publicAddresses(app: string): { queryUrl: string; otlpUrl: string } {
	return { queryUrl: `https://${app}.fly.dev:16687`, otlpUrl: `https://${app}.fly.dev` };
}

export function renderFlyConfig(opts: { app: string; region: string }): string {
	return readFileSync(FLY_TEMPLATE, "utf-8")
		.replaceAll("{{app}}", opts.app)
		.replaceAll("{{region}}", opts.region);
}

export function writeFlyConfig(dir: string, opts: { app: string; region: string }): string {
	const path = join(dir, "fly.toml");
	writeFileSync(path, renderFlyConfig(opts));
	return path;
}
