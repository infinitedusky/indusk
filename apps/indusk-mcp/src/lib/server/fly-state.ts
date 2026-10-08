import type { FlyCli } from "./fly.js";

/** What exists on Fly, read before anything is written. Built in Build Phase 2. */
export interface FlyState {
	cli: "ok" | "missing" | "signed-out";
	orgs: string[];
	app: { exists: boolean; org: string | null; volumes: string[]; ips: string[] };
}

export async function readFlyState(_fly: FlyCli, _app: string): Promise<FlyState> {
	throw new Error("readFlyState: not built yet");
}
