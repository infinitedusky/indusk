import type { View } from "./view.js";

/** One place a promise lives: a test that proves it, or code that keeps it. */
export interface Location {
	kind: "test" | "site";
	path: string;
	/** The line its token is on, from zero; null when the file no longer carries it. */
	line: number | null;
}

export interface PanelPromise {
	name: string;
	kind: string;
	statement: string;
	/** The state as the markers word it: "broken (production)", "holding", … */
	state: string;
	tone: "broken" | "ok" | "unknown";
	/** For a broken promise: where, when it last broke, and what the span said. */
	source?: string;
	brokeAt?: string;
	symptom?: string;
	locations: Location[];
}

export interface PanelModel {
	broken: PanelPromise[];
	rest: PanelPromise[];
	notReading: boolean;
}

/**
 * The promises panel (vscode-extension ADR decision 7): every promise with its
 * state, broken ones first as cards, latest break first, then the rest by
 * name; each with its tests and sites at the line its token is on. `files`
 * holds the text of each listed file the editor could read.
 */
export function panelModel(_view: View | null, _files: Map<string, string>): PanelModel {
	return { broken: [], rest: [], notReading: true };
}
