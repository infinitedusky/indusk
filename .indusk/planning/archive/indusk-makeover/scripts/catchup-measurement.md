# A5/A6 — Catchup Cost Measurement Procedure

Measures the token cost and the read-set of a fresh `/catchup`. Run at Phase 0
(red baseline), after Phase 4 (diet mechanism verified), and at Phase 6 (final
green — target ≤ ~15k tokens).

## Procedure

1. Open a **fresh** Claude Code session in this repo (context must not be warm —
   a resumed session under-counts because reads are cached in the transcript).
2. Run `/catchup` and let it complete.
3. Find the session transcript:
   `~/.claude/projects/-Users-the-dusky-code-sandbox-dusk*/<session-uuid>.jsonl`
   (newest file; confirm the first user message is the catchup invocation).
4. **A5 — token cost** of tool results during catchup (chars/4 approximation is
   fine per the test plan):

   ```bash
   jq -r 'select(.message.role == "user") | .message.content[]? |
          select(.type == "tool_result") | .content[]? |
          select(.type == "text") | .text' <transcript>.jsonl \
     | wc -c \
     | awk '{ printf "catchup tool-result chars=%d  ~tokens=%d\n", $1, $1/4 }'
   ```

   PASS when ~tokens ≤ 15000. (Baseline expectation pre-makeover: ~50–60k.)

5. **A6 — read-set** checks on the same transcript:

   ```bash
   # Graphiti calls during catchup — must be 0 post-Phase-4
   grep -c '"name":"mcp__graphiti__' <transcript>.jsonl
   # CLAUDE.md ingestions — must be ≤ 1 post-Phase-4 (the system-injected copy;
   # catchup itself must not re-Read it)
   grep -c 'CLAUDE.md' <transcript>.jsonl   # then eyeball: Read-tool calls targeting CLAUDE.md
   ```

   PASS when Graphiti call count is 0, catchup performed no `Read` of CLAUDE.md,
   and the catchup completed without erroring on the missing servers.

## Recording

Append each run to `baseline.md` in this plan folder: date, phase, ~tokens,
graphiti-call count, duplicate-CLAUDE.md-read yes/no.
