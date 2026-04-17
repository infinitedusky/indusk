---
name: highlight
description: Flag a moment in the session as worth remembering. Writes a highlight to the queue so the eval agent can materialize it into a structured Graphiti episode.
---

You are flagging something the user wants captured — an observation, a decision, a surprise, a lesson that isn't an official retrospective yet. Write a highlight to the queue. The eval agent will process it into a structured Graphiti episode on the next `jj describe` or at session end.

## Invocation

The user runs `/highlight {free-form text} [level: critical|important|note]`.

- If no level is specified, **default to `important`**.
- If the user's phrasing clearly signals weight (`critical`, `important`, `note`, or synonyms like `major`, `minor`), use that.
- If the user passes `level=critical` / `level=note` explicitly, honor it.

## Process

1. **Parse the input.** Extract the note text. If the user wrote `/highlight level=critical decide X over Y`, strip the `level=` prefix out of the note.

2. **Choose a tag.** Tags categorize the highlight for the eval agent. Pick one of:
   - `observation` — general flag (default)
   - `decision` — an informal decision the user wants recorded
   - `surprise` — something unexpected
   - `correction` — a mid-session correction (but the work skill already does this on `context learn`; prefer that path)
   - A user-supplied tag if the message contains one (`tag=architecture` etc.)

3. **Write the highlight** via the InDusk MCP:

   ```
   mcp__indusk__highlight({
     tag: "{chosen tag}",
     note: "{the user's text, cleaned of any level= or tag= prefixes}",
     level: "{critical|important|note}"
   })
   ```

4. **Confirm to the user** with the generated ID and a one-line summary:

   > "Highlighted as `h-20260417-007` (level: critical, tag: decision). The eval agent will pick this up on the next `jj describe` or at session end."

## Rules

- **Default level is `important`.** Only bump to `critical` if the user explicitly says so or the content is clearly an architectural / decision-level moment.
- **Do not write the Graphiti episode yourself.** The whole point of highlights is that the working agent flags and moves on; the eval agent handles materialization.
- **If `mcp__indusk__highlight` is unavailable**, degrade gracefully: tell the user "highlights queue unavailable — InDusk MCP may be down" and do not fail.
- **One highlight per invocation.** If the user flags multiple things at once, ask them to split or pick the most important one to flag.

## Cross-reference

See [`apps/indusk-docs/src/reference/tools/highlights.md`](../../indusk-docs/src/reference/tools/highlights.md) for the full highlights system — file format, level → Graphiti edge weight mapping, eval agent processing, and trigger points across other skills.
