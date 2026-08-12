# Ask what each rule does when the thing it is keyed on does not exist

Three of five findings in one falsification round were the same shape, and the shape has a one-question test.

**The findings:**
- A rule demanded an entry under a heading the document did not contain — so its instruction ("add an entry under X") could not be followed. An unsatisfiable refusal.
- A probe assumed a phase sat at a position it did not occupy, so it inspected the wrong boundary and reported *clean* on work that was incomplete. A silently wrong pass.
- A mask assumed a block that is opened is also closed, so an unterminated one swallowed the rest of the file — deleting structure from three parsers at once with nothing reporting a problem.

**The question:** for every rule, gate or parser you write — *what does this do when the thing I am keyed on isn't there?*

The absent case reliably lands in one of two bad places:
1. **Unsatisfiable** — the rule fires and its remedy is impossible, so the author is stuck and the message is misleading.
2. **Silently inapplicable** — the rule doesn't fire, and its absence looks exactly like success.

**Two useful defaults:**
- If the subject's absence means the obligation cannot exist yet, **skip the rule** — you cannot be late for a deadline that was never scheduled — and let a *different*, more specific rule complain about the absence itself. That rule can name the real problem.
- If the absence means the document is malformed, **refuse loudly and name the location**. Do not fail open into silence; silence is indistinguishable from success.

**Where the trap lives:** it is easiest to miss on the rule you just wrote, because you write it against the well-formed example in front of you. Add the absent case to the fixture set at authoring time, alongside the accept and refuse cases.
