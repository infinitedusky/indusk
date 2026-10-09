import type { View } from "./view.js";

export interface Marker {
	line: number;
	promise: string;
	text: string;
	tone: "broken" | "ok" | "unknown" | "proves";
}

/** The end-of-line markers for one file. Built in Build Phase 2. */
export function markers(_file: { path: string; text: string }, _view: View | null): Marker[] {
	throw new Error("markers: not built yet");
}
