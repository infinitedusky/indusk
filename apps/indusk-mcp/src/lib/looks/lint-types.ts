export type LintRule =
	| "raw-value"
	| "undefined-token"
	| "undeclared-token"
	| "redefined-token"
	| "external-reference"
	| "arbitrary-class"
	| "stock-class";

export interface Finding {
	/** Relative to the project root. */
	file: string;
	line: number;
	/** What is wrong: the raw value, the token's name, the class. */
	value: string;
	rule: LintRule;
	message: string;
}

export interface CssBlock {
	code: string;
	/** The 1-based line of `file` the block's first line is on. */
	startLine: number;
}
