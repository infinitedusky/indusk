import type { View } from "./view.js";

/**
 * Each look as the editor shows it (ui-promises A24): read from the health
 * line, which carries the package's `readLookStanding` rows — the same the
 * admin's dashboard reads — so the editor's state and word for a look are the
 * admin's. Nothing is decided here: the order (broken first), the state and
 * its word all come from the line.
 */

export interface ShownLook {
	app: string;
	/** `<screen>.<state>`, or a component's name. */
	look: string;
	device: string | null;
	state: "broken" | "held" | "unchecked" | "uncovered";
	word: string;
	tone: "broken" | "ok" | "unknown";
	symptom?: string;
}

const TONE: Record<ShownLook["state"], ShownLook["tone"]> = {
	broken: "broken",
	held: "ok",
	unchecked: "unknown",
	uncovered: "unknown",
};

/** The looks on the latest line, in its order; none without a line or with none on it. */
export function lookStates(view: View | null): ShownLook[] {
	return (view?.line.looks ?? []).map((r) => ({
		app: r.app,
		look: r.look,
		device: r.device,
		state: r.standing,
		word: r.word,
		tone: TONE[r.standing] ?? "unknown",
		...(r.symptom ? { symptom: r.symptom } : {}),
	}));
}
