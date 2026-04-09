/**
 * Evaluation rubric — the v1 question set.
 *
 * The questions are the product. Adding a question here is adding a line.
 * The infrastructure (hook, agent spawn, logging) doesn't change.
 */

import type { RubricQuestion } from "./types.js";

export const V1_RUBRIC: RubricQuestion[] = [
	{
		id: "conventions",
		question: "Did the agent follow the project's conventions? (CLAUDE.md, skills, lessons)",
		guidance:
			"Check the diff against CLAUDE.md conventions, active lessons, and skill instructions. Look for naming violations, wrong tools used, skipped patterns.",
	},
	{
		id: "skipped-steps",
		question:
			"Did the agent skip steps it was instructed to follow? (plan gates, verification, skill instructions)",
		guidance:
			"Check the transcript for skipped verification, missing gate completions, or skill instructions that were acknowledged but not followed.",
	},
	{
		id: "better-approaches",
		question:
			"Were there better approaches available in the codebase? (existing utilities, patterns, components)",
		guidance:
			"Search the codebase for existing utilities or patterns that do what the agent built from scratch. Check imports in nearby files for reusable modules.",
	},
	{
		id: "missing-context",
		question:
			"Is there information missing from the graph that would have helped? (context sufficiency)",
		guidance:
			"Consider what the agent struggled with or got wrong. Would a Graphiti fact, a lesson, or a CLAUDE.md entry have prevented the mistake?",
	},
];
