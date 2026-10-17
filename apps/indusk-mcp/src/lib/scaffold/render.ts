export function settingsValues(v: {
	service: string;
	project: string;
	address: { traces: string; logs: string } | null;
}): { service: string; project: string; traces: string; logs: string } {
	return { service: v.service, project: v.project, traces: "", logs: "" };
}
