/** The person's signed-in `fly` CLI, behind one seam (server-provisioning ADR D2). Built in Build Phase 2. */
export interface FlyResult {
	status: number;
	stdout: string;
	stderr: string;
}

export interface FlyCli {
	run(args: readonly string[], opts?: { stdin?: string }): Promise<FlyResult>;
}

export function realFly(): FlyCli {
	throw new Error("realFly: not built yet");
}
