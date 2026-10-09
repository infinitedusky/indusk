import type { HealthLine } from "@infinitedusky/indusk-mcp/promises/health";

/** What the editor knows after its latest health line (vscode-extension). Built in Build Phase 2. */
export type { HealthLine };

/** A promise's state as the editor words it. */
export type Shown =
	| "holding"
	| "broken"
	| "fixed"
	| "not seen"
	| "known violated"
	| "watched by the tests"
	| "unreadable"
	| "not reading";

export interface View {
	line: HealthLine;
	/** Two cadences passed without a line. */
	notReading: boolean;
}
