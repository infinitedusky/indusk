import type { HealthDeps, SourceHealthRead } from "./health.js";
import type { Registry } from "./registry.js";
import type { PlanRow } from "./rows.js";
import type { SourceName, SourceRead } from "./sources.js";

// promise: a-promise-page-shows-its-proof, the-admin-keeps-what-it-heard

export interface ProofMark {
	service: string;
	operation: string;
	lastHeld: string | null;
	lastBroken: string | null;
}

export interface ProofDay {
	/** UTC day, `YYYY-MM-DD`. */
	day: string;
	held: number;
	broken: number;
}

export interface ProofEvent {
	/** ISO date or time the event happened. */
	at: string;
	kind: "declared" | "confirmed" | "changed" | "incident" | "fixed" | "note";
	text: string;
}

export interface Proof {
	rows: PlanRow[];
	unreadable: string[];
	marks: ProofMark[];
	seen: boolean;
	days: Partial<Record<SourceName, ProofDay[]>>;
	history: ProofEvent[];
	banner: { testsMissTheCase: boolean };
}

export interface ProofDeps extends HealthDeps {
	/** Where the recorder keeps what it heard; the project's home by default. */
	home?: string;
	health?: SourceHealthRead[];
	marks?: (projectRoot: string, registry: Registry) => Promise<SourceRead[]>;
}

export async function proofOf(
	_projectRoot: string,
	_name: string,
	_deps: ProofDeps = {},
): Promise<Proof | null> {
	return null;
}
