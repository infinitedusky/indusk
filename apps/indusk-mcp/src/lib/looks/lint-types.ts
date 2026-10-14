export type LintRule =
	| "raw-value"
	| "shadow-not-token"
	| "undefined-token"
	| "undeclared-token"
	| "redefined-token"
	| "external-reference"
	| "arbitrary-class"
	| "stock-class"
	| "duplicate-component"
	| "component-outside-file"
	| "no-story"
	| "not-in-catalog"
	| "no-approved-story"
	| "content-not-words-or-components"
	| "component-takes-no-content"
	| "component-drawn-in-mockup"
	| "needs-a-story";

export interface Finding {
	/** Relative to the project root. */
	file: string;
	line: number;
	/** What is wrong: the raw value, the token's name, the class. */
	value: string;
	rule: LintRule;
	message: string;
	/**
	 * Listed, never failed: something to do that breaks no rule — a component a
	 * mockup declares new and that has no story yet (`needs a story`).
	 */
	notice?: true;
}

export interface CssBlock {
	code: string;
	/** The 1-based line of `file` the block's first line is on. */
	startLine: number;
}
