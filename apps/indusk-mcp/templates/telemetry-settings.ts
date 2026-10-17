export interface Rendered {
	service: string;
	project: string;
	traces: string;
	logs: string;
}
export const RENDERED: Rendered = { service: "", project: "", traces: "", logs: "" };
export function telemetrySettings(
	_env: Record<string, string | undefined>,
	_r: Rendered = RENDERED,
): {
	serviceName: string;
	tracesUrl: string;
	logsUrl: string;
	testRun: boolean;
	resource: Record<string, string>;
} {
	return { serviceName: "", tracesUrl: "", logsUrl: "", testRun: false, resource: {} };
}
