export interface BrokenPromise {
	promise: string;
	source: string;
	sourceLabel: string;
	statement: string;
	symptom?: string;
	traceId?: string;
	tests: string[];
}

export function fixPrompt(_broken: BrokenPromise): string {
	return "";
}
