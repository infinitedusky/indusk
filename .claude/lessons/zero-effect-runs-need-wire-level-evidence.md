# A zero-effect run always has ≥2 consistent explanations — get wire-level evidence before shipping a diagnosis

During dawn-external-orchestrator's acceptance matrix, gemini-3.6-flash produced runs with zero edits. The first diagnosis — "SDK-blocked: thoughtSignature not round-tripped by @ai-sdk/google" — was plausible, specific, matched the observable, and was **wrong**. Wire-level logging later proved signatures round-trip fine; the real cause was **step starvation** (a 24-step budget expiring during the model's read-heavy exploration before its first write).

**The pattern:** when a run produces no observable effects, there are always at least two consistent explanations — a *capability* failure (the model/SDK can't do the thing) and a *budget/plumbing* starvation (it never got the chance). Both predict "zero edits." Surface-level evidence cannot separate them; only instrumentation at the wire (actual requests/responses, step-by-step tool-call logs) can.

**What to do:**
1. Never ship the first diagnosis of a zero-effect failure — name the rival explanation explicitly before concluding.
2. Get wire-level evidence (log the raw provider traffic or per-step tool calls) before attributing failure to a component you can't see into.
3. When the diagnosis is later falsified, keep the wrong one in the findings log next to its refutation — visible corrections are what make the surviving claims trustworthy (the F1 precedent).

