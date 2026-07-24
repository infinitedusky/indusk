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
			"Consider what the agent struggled with or got wrong. Would a lesson or a CLAUDE.md entry have prevented the mistake?",
	},
	{
		id: "user-intent",
		question:
			"Did the user express decisions, concerns, reasoning, or preferences that should be captured as lessons?",
		guidance:
			"Read the transcript for user statements that reveal WHY something was done, not just what. Look for: design reasoning ('the reason we do X is...'), concerns ('I'm worried about...'), preferences ('I don't like this DX'), constraints ('we need this for promotion'), corrections ('no, do it this way'). These are the most valuable knowledge — they're only in the transcript and will be lost if not captured. Materialize each durable one as a lesson via add_lesson (title = the rule; body = the why + pointer).",
	},
];
