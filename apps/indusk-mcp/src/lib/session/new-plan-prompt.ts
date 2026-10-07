/**
 * The first message a plan started from New plan sends its session
 * (workbench-plan-authoring D11).
 */
export function newPlanPrompt(type: string, plan: string): string {
	return `/planner ${type} ${plan}`;
}
