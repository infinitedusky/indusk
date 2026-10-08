import { FLY_MISSING, type FlyCli } from "./fly.js";

/**
 * What exists on Fly, read before anything is written (server-provisioning
 * ADR D2). `planDeploy` decides from this alone, so its rules are unit tests
 * over recorded states.
 */
export interface FlyState {
	cli: "ok" | "missing" | "signed-out";
	orgs: string[];
	app: { exists: boolean; org: string | null; volumes: string[]; ips: string[] };
}

const NONE: FlyState["app"] = { exists: false, org: null, volumes: [], ips: [] };

function json<T>(text: string, fallback: T): T {
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback;
	}
}

export async function readFlyState(fly: FlyCli, app: string): Promise<FlyState> {
	const who = await fly.run(["auth", "whoami"]);
	if (who.status === FLY_MISSING) return { cli: "missing", orgs: [], app: NONE };
	if (who.status !== 0) return { cli: "signed-out", orgs: [], app: NONE };

	const orgs = Object.keys(
		json<Record<string, string>>((await fly.run(["orgs", "list", "--json"])).stdout, {}),
	);
	const apps = json<{ Name?: string; Organization?: { Slug?: string } }[]>(
		(await fly.run(["apps", "list", "--json"])).stdout,
		[],
	);
	const found = apps.find((a) => a.Name === app);
	if (!found) return { cli: "ok", orgs, app: NONE };

	const volumes = json<{ name?: string }[]>(
		(await fly.run(["volumes", "list", "-a", app, "--json"])).stdout,
		[],
	);
	const ips = json<{ Type?: string }[]>(
		(await fly.run(["ips", "list", "-a", app, "--json"])).stdout,
		[],
	);
	return {
		cli: "ok",
		orgs,
		app: {
			exists: true,
			org: found.Organization?.Slug ?? null,
			volumes: volumes.map((v) => v.name ?? "").filter(Boolean),
			ips: ips.map((i) => i.Type ?? "").filter(Boolean),
		},
	};
}
