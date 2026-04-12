/**
 * Types for the context beam query pipeline.
 *
 * The beam radiates outward from a target file, collecting context from
 * multiple data sources with distance-based relevance decay.
 */

export interface BeamItem {
	source: "semantic-graph" | "graphiti" | "eval" | "cgc";
	distance: 0 | 1 | 2;
	detail: "full" | "summary" | "name";
	content: string;
	metadata: {
		path?: string;
		relationship?: string;
		timestamp?: string;
		severity?: string;
		factId?: string;
	};
}

export interface BeamTraceStep {
	query: string;
	source: string;
	durationMs: number;
	resultCount: number;
	results: string[];
}

export interface BeamResult {
	target: string;
	items: BeamItem[];
	trace?: BeamTraceStep[];
	durationMs: number;
}

export interface QueryContext {
	projectRoot: string;
	projectName: string;
	targetPath: string;
	targetAbsolutePath: string;
	targetRelativePath: string;
	neighbors: string[];
	trace: boolean;
}

export interface QueryStep {
	name: string;
	source: "semantic-graph" | "graphiti" | "eval" | "cgc";
	distance: 0 | 1 | 2;
	maxResults: number;
	detail: "full" | "summary" | "name";
	execute: (ctx: QueryContext) => Promise<BeamItem[]>;
}
