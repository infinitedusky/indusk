---
title: "Jev (TypeSafe AI) — a typed-decision model, and whether InDusk has a slot for it"
date: 2026-09-18
status: complete
---

# Jev — Research

Spike, research only. Declared fate in [`master.md`](../master.md): standalone
research, not a step. Written three days after Jev's early-access launch, from the
vendor's docs and blog, launch coverage, and one practitioner guide. **No independent
evaluation of the model exists yet**; every performance and calibration figure below
is a vendor claim unless marked otherwise.

## Question

Sandy (2026-09-18): "Jev by TypeSafe is apparently a decision model that speeds
things up significantly. What do we think about incorporating it in Dusk? What would
we get? How would we use it?"

## Findings

### 1. What Jev is

- **Vendor.** TypeSafe AI, founded by Diogo Almeida (ex-OpenAI, credited on RLHF and
  ChatGPT). Reported funding $40M. Early access announced **2026-09-15**; access is a
  waitlist through `console.typesafe.ai`. No self-hosting or on-prem offering is
  mentioned anywhere.
- **What it is not.** Not an autoregressive LLM. It generates no text, code or
  summaries. TypeSafe calls the class "System One models" (Kahneman): fast judgments a
  knowledgeable person makes in seconds, as opposed to deliberate reasoning.
- **Interface.** One call takes a block of **state** (text only: a string, JSON
  object or array) plus a map of typed **questions**. Questions run in parallel and
  in isolation against the shared state; adding questions barely changes latency.
  Three primitives:

  | Primitive | Returns | Notes |
  |---|---|---|
  | Choice | `choice`, `probabilities`, `confidence` | select one of up to **255** options |
  | Score | `score`, `probabilities`, `confidence` | a 2–10 level spectrum; score may fall between levels |
  | Noul | `noul` (0–1) | probability a statement is true; carries **no** separate confidence |

- **Confidence** is a statistic collapsed from the returned probability
  distribution (flatter = lower). The docs recommend a three-tier gate: high → act,
  medium → proceed with confirmation, low → escalate; thresholds "depend on your
  domain and the performance of the model for your use case".
- **Limits.** 64k tokens per call (state + all questions); 32k for state plus the
  longest single question. Rate limits 250k tokens/s and 1,200 requests/min.
- **Latency and cost (vendor).** 70–500 ms end to end; $0.042 per million input
  tokens, output free. The blog's "193.6× faster, 444.6× cheaper" workflow figure is
  labelled by the vendor as "on the higher end of real world gains". The Register's
  demo figure: 0.114 s versus 8.566 s for a frontier model on one task.
- **Training.** "Reinforcement Learning for Calibrated Decisions" (RLCD), described
  as optimising for epistemically honest probabilities. No paper, no calibration
  plots. The launch FAQ's answers ("Is Jev just a smaller LLM?", "public
  benchmarks", "training data") are client-rendered and were **not readable** from
  the page source; they remain unknown here.
- **The vendor's own accuracy numbers** ([evals.typesafe.ai](https://evals.typesafe.ai/)).
  Four "workflow evals", each a graph of Noul/Choice/Score questions run
  identically on every model. **The reference answer is the average of GPT-6 Astra
  and Claude Fable 5.1 at high thinking — model consensus, not ground truth.** Jev's
  agreement with that reference:

  | Workflow | Decides | Agreement | Cost / call | Latency |
  |---|---|---|---|---|
  | Security incidents | close / analyst / contain | 61.7 % | $0.0001 | 0.3 s |
  | Agent trace observability | does this agent interaction need human review, and how urgent | 71.6 % | $0.0003 | 0.5 s |
  | Invoice processing | approve / hold / return | 61.8 % | $0.0011 | 0.5 s |
  | Customer service | next assistant action | 76.0 % | $0.0001 | 0.4 s |

  So "similar intelligence to frontier LLMs" means 62–76 % agreement with a
  frontier consensus on the vendor's own workflows, at two orders of magnitude less
  cost. The vendor's stated caveats: workflows were written by its own team; the
  reference biases toward OpenAI and Anthropic; speed was measured from laptops on
  the US West Coast, where the service is hosted; the LLM comparators ran through
  TypeSafe's own structured-decision wrapper. Their one cross-model finding worth
  keeping: *every* model, Jev included, scored better, cheaper and faster when the
  policy was a decomposed workflow of atomic questions than when the same policy
  was a single prompt.
- **Open-source adapter.** [`typesafe-ai/system-one-adapter-python`](https://github.com/typesafe-ai/system-one-adapter-python)
  (MIT, created 2026-08-08, 123 stars, active) is a drop-in replacement for the
  SDK's `system_one` call backed by OpenAI or Anthropic models — the wrapper used
  as the LLM comparator above. It returns the same typed response plus
  `usage.latency`, retry counts and the raw LLM attempts. Python only; no Node
  equivalent published.
- **High cardinality.** Above some option count the vendor itself runs a two-stage
  route — score every option independently, then make an explicit choice — which
  is where the occasional slowdown in their Wikiracing demo comes from.
- **Cost datum.** The Doom demo issues ~10 queries/second for ~$7/hour.
- **SDKs.** Python 3.10+ (`pip install typesafe-sdk`) and Node 20+
  (`npm install @typesafe-ai/sdk`); both read `TYPESAFE_API_KEY`, default model
  `jev-latest`.
- **Marketing to discount.** "Cannot hallucinate" means the output always conforms
  to the declared schema. It says nothing about being correct; The Register makes the
  same point. Treat "0% hallucination" as "0% type errors".

### 2. Known failure modes (one practitioner, days in)

Reads literally (negation and scoping taken at face value); cannot count or do
arithmetic; treats dates as text; accuracy degrades with irrelevant context; state
that contains user-controlled text is an injection surface; no generation. The
author's rule: never ask it something code can compute exactly.

### 3. Where InDusk actually calls a model today

| Site | Shape of the call | Jev-shaped? |
|---|---|---|
| Eval agent (`lib/eval/`) — a persistent Claude session per project, fired on `git commit` | five rubric questions answered yes/no **with evidence text**, a summary, findings, and lesson materialisation via `add_lesson` | the yes/no half is; the evidence, summary and lessons are generation |
| `indusk run` loop (`lib/run/`) | a model executes phases through a gated tool envelope | no — generation and tool use |
| Shape step (`/work`) | the executing agent judges craft against extension prose rules, deliberately with **no extra call** | no — adding a call loses the property the design is built on |
| `/falsify`, `/write`, `/planner` | authoring | no |
| Every hook and gate (`validate-impl-structure`, `check-gates`, `trunk-guard`, `claude-md-budget`, `verify`) | deterministic scripts, exit codes | no, by design — see §5 |

Volume: **692** eval scorecards in `.indusk/eval/results.log` since the rail was
built (about five months). Dusk is not a high-volume decision system; Jev's
economics only bite at volume or inside a latency budget. (Observed in passing: the
two most recent evaluator runs errored with "workspace has not been trusted" — a
machine-local Claude CLI trust-dialog problem, not a rubric problem.)

### 4. Where a typed-decision model genuinely fits, ranked

1. **User zero, layers 2 and 3** ([`user-zero/research.md`](../user-zero/research.md)
   §5). Routing a user comment or a behaviour event to a **promise from a closed set**
   is Choice over ≤255 promise names with a confidence, and the confidence maps
   straight onto the three-tier gate: high → attach to the promise, medium → propose
   and ask, low → "unmatched", never guessed. This is the one place InDusk will have
   volume, a known answer set, and a need for calibrated abstention at once. It does
   not exist yet (post-Day). Layer 1 is **not** a slot: day-monitor names the promise
   deterministically from the `indusk.promise` span attribute.
2. **Eval pre-triage.** Ask the five rubric questions as Noul at commit time (state =
   diff + commit message + the rubric question), and spawn the heavyweight evaluator
   only when an answer is "no" or low-confidence. This is a slot the vendor names
   outright — "score, judge, verify, guardrail … LLM prompts, reasoning traces
   and/or outputs", and its second published workflow is exactly "does this agent
   interaction need human review" — which makes it intended use, not a stretch. The
   published 62–76 % agreement with frontier consensus is the number to hold
   against it: a triage that disagrees with the evaluator a quarter of the time
   needs its threshold set so that the disagreements fall on the "spawn the
   evaluator" side. Gains are small at dusk's volume and
   larger for a consumer with many commits; the evidence text and lesson
   materialisation stay with the generative evaluator. It would also retire some of
   the tolerant JSON extraction (`scorecard-extractor.ts`) for the triage half, since
   the output is typed.
3. **Highlight → lesson dedupe.** "Is this highlight already covered by one of these
   lesson titles?" is Choice over existing titles plus a "none" option. Small, real,
   currently done by the evaluator in prose.
4. **Tempting and wrong: gate decisions.** `check-gates` verifies the *format* of
   conversation proof, not the fact (lesson on file). A Noul "does this proof
   describe a real exchange?" would turn a gate into a guess, and the hook does not
   hold the transcript anyway. The PR shape's rules apply: verdicts are binary, never
   a score; nothing in the table is produced by asserting it. A probability can
   *route to* a human decision; it cannot *be* the gate.

### 5. What InDusk would get, and what it would give up

**Get:** sub-second typed decisions, which makes a model-judged step feasible in
places a 10-second LLM call cannot live; calibrated abstention that maps onto the
existing `strict / ask / auto` vocabulary (high → auto, medium → ask, low → refuse);
typed outputs with no parsing step.

**Give up or risk:** a hosted-only vendor three days into early access, with no
self-hosting and no independent calibration evidence (the docs say to measure on your
own data — so any adoption starts with a labelled set, and dusk has 692 scorecards to
build one from); question wording becomes a maintained artifact with the same
routing-key fragility as a skill description; state built from diffs and user text
is an injection surface; and the standing rule that extensions own tool knowledge
means this lands as a `typesafe` extension (`.env.example` with `TYPESAFE_API_KEY`, a
`decide(state, questions)` helper, a health check), never as a core dependency.

### 6. The one cheap experiment available now — and it no longer needs the waitlist

Replay the archived scorecards: for each of the 692 commits, state = `git show`
of the change plus the rubric question, one Noul per question; compare against the
evaluator's recorded yes/no and look at whether high-confidence answers agree more
often than low-confidence ones. That measures agreement and calibration **on dusk's
own data** in an afternoon and needs nothing built.

The open-source adapter changes the sequencing. The same script can run **today**
against Claude Haiku through `system-one-adapter-python` (same call shape, same
typed response, with latency and cost recorded), giving a baseline for the
decision *interface* independent of the vendor. When a Jev key arrives, swap the
client and re-run. Two things fall out for free: whether decomposing the rubric
into atomic typed questions beats the current prose scorecard even on Claude
(the vendor claims every model improves that way), and how far Jev sits from
Claude on diff-shaped state. It is the precondition for slots 2 and 3, and a dry
run for slot 1's threshold choice.

## Open Questions

- Does Jev's calibration hold on code-review-shaped state (diffs), which is far from
  the customer-service and document-triage examples the vendor leads with?
- When user-zero's layer 2 exists, is the promise set small enough (≤255) and stable
  enough for one Choice? The vendor's own answer for high cardinality is two-stage
  (score each, then choose); a domain-first route would be InDusk's version of it.
- **Answered in part:** the decision interface is already vendor-neutral — the
  adapter runs the same call against OpenAI or Anthropic. The remaining question
  is whether InDusk adopts that call shape (state + typed questions → typed
  answers with probabilities) as its own extension interface, with Jev as one
  provider, given the adapter is Python and indusk-mcp is TypeScript.
- Is 62–76 % agreement with a frontier consensus good enough for any slot where the
  disagreement is not routed to a human? On the vendor's own numbers, no slot in
  §4 should act autonomously on a Jev answer without a threshold measured on
  dusk's data.
- Waitlist timing gates only the Jev half of §6; the adapter half can run now.

## Sources

- TypeSafe AI — [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) (read in full from the page source, 2026-09-18; FAQ answers are client-rendered and were not); [workflow evals](https://evals.typesafe.ai/); [system-one-adapter-python](https://github.com/typesafe-ai/system-one-adapter-python); [home](https://typesafe.ai/); docs: [introduction](https://docs.typesafe.ai/introduction), [confidence](https://docs.typesafe.ai/confidence), [patterns](https://docs.typesafe.ai/patterns) (quickstart URL 404s as of 2026-09-18; index at `docs.typesafe.ai/llms.txt`).
- The Register, 2026-09-16 — [TypeSafe AI debuts model for machines that plays Doom](https://www.theregister.com/ai-and-ml/2026/09/16/typesafe-ai-debuts-model-for-machines-that-plays-doom/5296711) (funding, the "hallucination-free" caveat, demo timings).
- DEV Community — [How to Use Jev: a practical guide](https://dev.to/valyuai/how-to-use-jev-a-practical-guide-to-typesafes-system-one-model-g5e) (request/response shape, limits, SDKs, failure modes).
- beam.ai — [Jev by TypeSafe: a decision model for AI agents](https://beam.ai/agentic-insights/jev-typesafe-ai-agents) (agent-loop slots; "launch claims until independently tested").
- Launch coverage read for the summary only: [DataCamp](https://www.datacamp.com/blog/system-one-models-jev), [The Rundown](https://www.therundown.ai/news/typesafe-jev-ai-decisions-software), [InfoWorld](https://www.infoworld.com/article/4223468/typesafe-ais-new-models-work-with-machines-not-humans.html), [heise](https://www.heise.de/en/news/AI-model-Jev-to-make-machines-decide-faster-11457071.html).
- Internal: `apps/indusk-mcp/src/lib/eval/rubric.ts`, `evaluator-runner.ts`, `scorecard-extractor.ts`; `lib/run/loop.ts`; [`day-monitor/brief.md`](../day-monitor/brief.md); [`user-zero/research.md`](../user-zero/research.md).
