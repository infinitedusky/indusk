# Put backward compatibility inside a function, not in a claim about one

When you change how something is computed — an ordering, a comparison, a resolution — the compatibility guarantee should be a **property of the new code path**, not a sentence in a comment or a commit message.

**What happened.** Ordering had to change from "compare these numbers" to "compare positions in a document", because a new construct made the numbers ambiguous. The obvious risk: a dozen call sites read those numbers, and every previously-written document depended on the old semantics.

The fix was one line at the top of the new ordering function: **if the document contains none of the new construct, return the raw number** — i.e. reduce exactly to the old behaviour. Not "should be equivalent"; *identical by construction*.

**Why it matters:**
- Twelve call sites did not have to change, because the values they read kept their meaning.
- The guarantee is verified by every pre-existing test, automatically. There is nothing to remember and nothing to re-assert.
- Degenerate cases fall out for free — a special value that used to sort first still sorts first by arithmetic, with no special case.

**The general move:** find the input class that must keep behaving as before, and make the new function *provably* collapse to the old function on that class. Then say so in the docstring, because the next person's instinct will be to "simplify" it away.

**Contrast with the failure mode:** compatibility asserted in prose ("this is backward compatible") drifts the first time someone edits the function without reading the comment. Compatibility expressed as an early return cannot drift without a test going red.
