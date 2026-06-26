# Operational State

This is the **operational layer** of project memory — what is happening on this project *right now*. The architectural layer ("what this project is") lives in [`CLAUDE.md`](../CLAUDE.md). The historical layer ("how we got here") lives in `.indusk/planning/` plans + the docs site.

Working agents edit this file in place as state solidifies during a session. `/catchup` reads it (pure-read, never writes). `/retrospective` distills sections of it into CLAUDE.md's Key Decisions or Current State on the natural cadence.

If a section is empty, that's fine — it means there's nothing currently in that state.

## In Flight

_What's actively being worked on right now. Plan names + phase + current focus. Examples: "handoff-multi-agent Phase 4 — wiring init/update", "investigating slow Graphiti queries (no plan yet)"._

(nothing yet)

## Open Questions

_Hypotheses that haven't been confirmed; design decisions that are mid-conversation; things you want the next agent to think about before continuing._

(nothing yet)

## Cursor

_Where you stopped, in enough detail that the next agent (or future-you) doesn't have to rediscover. File paths + line numbers + the next concrete step._

(nothing yet)
