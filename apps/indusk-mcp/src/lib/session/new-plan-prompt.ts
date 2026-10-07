/**
 * The first message a plan started from New plan sends its session
 * (workbench-plan-authoring D11). In the live check, given only
 * `/planner <type> <name>`, the agent planned from the title. The person has
 * said nothing yet, so the agent prepares on its own, says when it is ready,
 * and asks. Continue planning keeps `/planner <plan>`: by then the plan's
 * documents say what it is.
 */
export function newPlanPrompt(type: string, plan: string): string {
	return [
		`/planner ${type} ${plan}`,
		"",
		"This plan was just started from the admin, and the person has not described it yet.",
		"1. Prepare first, without asking anything: read `.indusk/planning/master.md` and `.indusk/current.md`, and run `indusk promises check`.",
		"2. Then say in one or two sentences that you are ready, and ask the person to describe what they want, in their own words.",
		`3. Do not infer or guess the plan from its name; "${plan}" is only a label. Write no plan document until they have described it.`,
	].join("\n");
}
