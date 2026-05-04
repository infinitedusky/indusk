/**
 * Builds the evaluator agent's system prompt.
 *
 * The prompt instructs the evaluator to: do catchup, read the transcript, read the
 * diff itself via jj, answer each rubric question, write findings to Graphiti
 * (eval mode only), and output a JSON scorecard.
 *
 * The diff is NOT embedded in the prompt — the evaluator reads it via tool calls.
 * This keeps the prompt small regardless of commit size.
 */

import type { RubricQuestion } from "./types.js";

export interface PromptBuilderOptions {
	rubric: RubricQuestion[];
	changeId: string;
	transcriptPath: string;
	mode: "eval" | "baseline";
	projectGroup: string;
	/**
	 * SCM the project uses. Controls which command the evaluator is told to
	 * run to inspect the diff: `jj diff -r ${changeId}` for jj, `git show
	 * ${changeId}` for git. Defaults to `"jj"` for backward-compat with
	 * pre-1.28.x callers that don't pass the field.
	 */
	scm?: "jj" | "git";
}

export function buildEvaluatorPrompt(opts: PromptBuilderOptions): string {
	const scm = opts.scm ?? "jj";
	const diffCommand =
		scm === "git" ? `git show ${opts.changeId}` : `jj diff -r ${opts.changeId}`;
	const questionsBlock = opts.rubric
		.map((q, i) => `${i + 1}. **${q.id}**: ${q.question}\n   Guidance: ${q.guidance}`)
		.join("\n\n");

	const highlightsInstructions =
		opts.mode === "eval"
			? `### Step 4: Process unprocessed highlights

Before answering the rubric, process the working agent's highlights queue. Highlights are the working agent's flagged moments — brief acceptances, ADR acceptances, corrections, retrospective lessons — and the eval agent is responsible for materializing them into structured Graphiti episodes.

Call \`mcp__indusk__highlights_unprocessed\` to get the list. For each highlight, the level drives effort and Graphiti edge weight:

- **critical** (architectural decision, accepted ADR, accepted brief): extract full context from the transcript and the changed files, write a structured Graphiti episode with weight **1.0**.
- **important** (correction, retro lesson, confirmed pattern): extract context, write a Graphiti episode with weight **0.6**.
- **note** (observation, partially-formed thought): consider it. Write a low-weight (**0.3**) episode if it adds signal; skip if it's already captured in an existing episode.

Write each episode using \`mcp__indusk__graph_capture\` so it attaches to the relevant file anchor in the semantic graph — not raw \`mcp__graphiti__add_memory\`. Pick the group sensibly: \`${opts.projectGroup}\` for project-specific facts, \`shared\` for cross-project conventions (e.g., "always use pnpm ce"). Use the level to set the edge weight in the body's metadata section so downstream context-beam queries can rank by importance.

After processing each highlight (whether you wrote an episode or decided to skip), call \`mcp__indusk__highlight_mark_processed\` with the highlight ID and the action:
- \`action: "wrote-episode"\`, \`detail: "{episode name}"\` — if you wrote an episode.
- \`action: "skipped"\`, \`detail: "{brief reason}"\` — if you decided not to (e.g., already captured, or not meaningful enough).

**Highlights are additive context, not a constraint.** Continue reading the full transcript and inferring knowledge independently — highlights ensure important moments aren't missed, but they don't bound your analysis. The transcript may contain insights the working agent didn't flag.

If \`mcp__indusk__highlights_unprocessed\` is unavailable, skip this step silently and continue.`
			: `### Step 4: Highlights (baseline mode)

Baseline mode — do NOT process highlights or write to Graphiti. Skip to Step 5.`;

	const graphitiInstructions =
		opts.mode === "eval"
			? `
### Step 6: Write findings to the knowledge graph

For each finding with severity "warning" or "critical", write it using \`mcp__indusk__graph_capture\`. This dual-writes to both Graphiti AND the semantic graph, connecting the finding to the existing file anchor — so the context beam can find it later.

**Use \`graph_capture\`, NOT \`mcp__graphiti__add_memory\`.** graph_capture attaches the finding to the file's existing node in the graph. add_memory creates a disconnected episode.

For each finding, identify the **primary file** it relates to and pass it as \`file_path\`. Include all relevant file paths in the body text too.

\`\`\`
mcp__indusk__graph_capture({
  name: "eval-finding-{question-id}-{short-slug}",
  body: "In {file1} and {file2}: {finding text with evidence}",
  file_path: "{primary file path}",
  relation: "eval-finding",
  group_id: "${opts.projectGroup}"
})
\`\`\`

Only write facts that would have changed the outcome. Be selective — quality over quantity.
Count how many graph_capture calls you made for the scorecard (this count includes any highlight episodes written in Step 4).
If the tool is unavailable, skip silently and set graphitiWrites to 0.`
			: `
### Step 6: Graphiti writes

Baseline mode — do NOT write to Graphiti. Set graphitiWrites to 0.`;

	return `You are the InDusk eval agent (evaluator). Your job is to evaluate the quality of work done by an AI agent on a software project.

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

Run \`${diffCommand}\` to see what was committed. This is the work being evaluated.

Then read the specific files that were changed to understand the full context — not just the diff lines, but the surrounding code.

${highlightsInstructions}

### Step 5: Answer the evaluation questions

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

### Step 7: Output the scorecard

After completing all steps, output ONLY the following JSON object. No markdown wrapping, no commentary before or after — just the JSON:

\`\`\`json
{
  "version": 1,
  "timestamp": "{ISO 8601 now}",
  "mode": "${opts.mode}",
  "changeId": "${opts.changeId}",
  "projectGroup": "${opts.projectGroup}",
  "questions": [/* your answers from Step 5 */],
  "summary": "{one paragraph overall assessment}",
  "graphitiWrites": {number of Graphiti writes made},
  "telemetryPosted": false
}
\`\`\`

This JSON is parsed programmatically. It must be valid. Do not include anything outside the JSON object.

═══════════════════════════════════════════════════════════════════
**FINAL REMINDER — OUTPUT FORMAT**

Your final response must be a single raw JSON object. Nothing else. No prose before, no prose after, no markdown code fences. The parent process pipes your stdout directly into \`JSON.parse()\` — any character that isn't part of the JSON object will fail the parse and your scorecard will be lost.

❌ DO NOT do this:
  Now I've got everything I need. Here's the scorecard:
  {"version":1,...}

❌ DO NOT do this:
  \`\`\`json
  {"version":1,...}
  \`\`\`

✅ DO this — start your response with \`{\` and end with \`}\`, nothing else:
  {"version":1,"timestamp":"2026-04-19T18:00:00.000Z","mode":"${opts.mode}","changeId":"${opts.changeId}","projectGroup":"${opts.projectGroup}","questions":[...],"summary":"...","graphitiWrites":3,"telemetryPosted":false}

The first character of your output must be \`{\`. The last character must be \`}\`. Begin now.`;
}
