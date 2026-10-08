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

/**
 * A read Fly did not answer. Never taken for "nothing there": an empty volume
 * list read from a failed call made a second run create a second volume and
 * buy a second IPv4 (server-provisioning A22).
 */
export class FlyReadFailed extends Error {
	constructor(args: readonly string[], status: number, stderr: string) {
		super(
			`\`fly ${args.join(" ")}\` failed (exit ${status}): ${stderr.trim() || "no output"}. Nothing was created; run this again when Fly answers.`,
		);
		this.name = "FlyReadFailed";
	}
}

async function read<T>(fly: FlyCli, args: string[]): Promise<T> {
	const r = await fly.run(args);
	if (r.status !== 0) throw new FlyReadFailed(args, r.status, r.stderr);
	try {
		return JSON.parse(r.stdout) as T;
	} catch {
		throw new FlyReadFailed(
			args,
			0,
			`answered with something that is not JSON: ${r.stdout.slice(0, 120)}`,
		);
	}
}

const NONE: FlyState["app"] = { exists: false, org: null, volumes: [], ips: [] };

export async function readFlyState(fly: FlyCli, app: string): Promise<FlyState> {
	const who = await fly.run(["auth", "whoami"]);
	if (who.status === FLY_MISSING) return { cli: "missing", orgs: [], app: NONE };
	if (who.status !== 0) return { cli: "signed-out", orgs: [], app: NONE };

	const orgs = Object.keys(await read<Record<string, string>>(fly, ["orgs", "list", "--json"]));
	const apps = await read<{ Name?: string; Organization?: { Slug?: string } }[]>(fly, [
		"apps",
		"list",
		"--json",
	]);
	const found = apps.find((a) => a.Name === app);
	if (!found) return { cli: "ok", orgs, app: NONE };

	const volumes = await read<{ name?: string }[]>(fly, ["volumes", "list", "-a", app, "--json"]);
	const ips = await read<{ Type?: string }[]>(fly, ["ips", "list", "-a", app, "--json"]);
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
