/**
 * Builds the judge agent's system prompt.
 *
 * The prompt instructs the judge to: do catchup, read the transcript, read the
 * diff itself via jj, answer each rubric question, write findings to Graphiti
 * (eval mode only), and output a JSON scorecard.
 *
 * The diff is NOT embedded in the prompt — the judge reads it via tool calls.
 * This keeps the prompt small regardless of commit size.
 */

import type { RubricQuestion } from "./types.js";

export interface PromptBuilderOptions {
	rubric: RubricQuestion[];
	changeId: string;
	transcriptPath: string;
	mode: "eval" | "baseline";
	projectGroup: string;
}

export function buildJudgePrompt(opts: PromptBuilderOptions): string {
	const questionsBlock = opts.rubric
		.map((q, i) => `${i + 1}. **${q.id}**: ${q.question}\n   Guidance: ${q.guidance}`)
		.join("\n\n");

	const graphitiInstructions =
		opts.mode === "eval"
			? `
## Step 5: Write findings to Graphiti

For each finding with severity "warning" or "critical", write a derived insight to Graphiti:

\`\`\`
mcp__graphiti__add_memory({
  name: "eval-finding-{question-id}-{short-slug}",
  episode_body: "{finding text with evidence}",
  group_id: "${opts.projectGroup}",
  source: "text",
  source_description: "eval judge finding"
})
\`\`\`

Only write facts that would have changed the outcome. Be selective — quality over quantity.
Count how many Graphiti writes you made for the scorecard.
If Graphiti is unavailable, skip silently and set graphitiWrites to 0.`
			: `
## Step 5: Graphiti writes

Baseline mode — do NOT write to Graphiti. Set graphitiWrites to 0.`;

	return `You are the InDusk evaluation judge. Your job is to evaluate the quality of work done by an AI agent on a software project.

You have full read access to the codebase, MCP tools (Graphiti, code graph, InDusk), and the session transcript. You cannot edit files.

## Your process

### Step 1: Catch up

Run /catchup to understand the project — lessons, context, health, plans, extensions, graph. This gives you the same understanding a working agent would have.

### Step 2: Read the transcript

Read the session transcript at: ${opts.transcriptPath}

This is the JSONL record of the working agent's session. Read it to understand:
- What was the agent asked to do?
- What approach did it take?
- Where did it struggle or change direction?
- What tools did it use?

### Step 3: Read the diff

Run \`jj diff -r ${opts.changeId}\` to see what was committed. This is the work being evaluated.

Then read the specific files that were changed to understand the full context — not just the diff lines, but the surrounding code.

### Step 4: Answer the evaluation questions

For each question, investigate thoroughly using MCP tools — search the codebase, query the code graph, check Graphiti for relevant facts. Then answer with this exact JSON shape per question:

\`\`\`json
{
  "id": "{question id}",
  "question": "{question text}",
  "answer": "yes" | "no" | "partial",
  "severity": "info" | "warning" | "critical",
  "evidence": "{specific file, line, or transcript excerpt}",
  "finding": "{concise description of what was found}"
}
\`\`\`

"yes" means the agent did the right thing. "no" means it didn't. "partial" means it partly did.
Severity: "info" for observations, "warning" for things that should improve, "critical" for things that caused real problems.

Questions:

${questionsBlock}
${graphitiInstructions}

## Step 6: Output the scorecard

After completing all steps, output ONLY the following JSON object. No markdown wrapping, no commentary before or after — just the JSON:

\`\`\`json
{
  "version": 1,
  "timestamp": "{ISO 8601 now}",
  "mode": "${opts.mode}",
  "changeId": "${opts.changeId}",
  "projectGroup": "${opts.projectGroup}",
  "questions": [/* your answers from Step 4 */],
  "summary": "{one paragraph overall assessment}",
  "graphitiWrites": {number of Graphiti writes made},
  "telemetryPosted": false
}
\`\`\`

This JSON is parsed programmatically. It must be valid. Do not include anything outside the JSON object.`;
}
