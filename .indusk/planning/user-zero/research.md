---
title: "User Zero — continuous build steered by use"
date: 2026-09-16
status: in-progress
---

# User Zero — Research

Side research running parallel to the master build plan. It is **not** a step in the
V4 sequence; its declared fate is "past Day, parked research" in
[`master.md`](../master.md). Nothing here is buildable until Midnight (the
telemetry-to-contract link), Dawn's unattended loop, and Day's PR shape exist. The
purpose is to keep the destination described and the evidence collected while the
sequence ships.

## Question

Today an InDusk plan is a contract: worked hard up front, held by gates through
phases, verified, falsified, closed. The post-Day idea is a build that **never
closes**: describe the system broadly and deliberately vaguely, let the loop build,
and steer it through use rather than direction. The first steerer is the author,
acting as *user zero* — playing the thing as if it were not theirs and leaving
comments. Then other users join and do the same. The product emerges from the
behaviour of the people using it instead of from a director's picture.

Three questions follow, in order of dependency:

1. **What holds intent stable when the steerers do not know they are steering?**
   The contract has to be the constitution; the behavioural layer proposes, the
   contract ratifies. What does a contract have to look like to be *ratifiable*
   against user behaviour rather than against a test file?
2. **What fitness signal keeps an evolutionary loop honest?** Any signal the loop can
   influence gets gamed. What is external enough to hold?
3. **What level of telemetry does steering-by-use need**, and which of its three
   layers (errors, explicit feedback, inferred behaviour) can bind to a contract
   at all?

## Findings

### 1. Aeon is the closest live specimen of "never stops" — and it has no contract

[aeonfun/aeon](https://github.com/aeonfun/aeon), analysed 2026-09-16 from a shallow
clone at commit `c5eaf63a` (2026-09-16).

| Fact | Value |
|---|---|
| Created | 2026-03-04 |
| Stars / forks | 737 / 265 |
| Commits | 1,310 (about 1,030 by one author) |
| Merged PRs, last 30 days | 185 (many opened by the agent itself and by dependabot) |
| Skills | 82 `SKILL.md` prompts |
| Harnesses | 9 CLIs behind one adapter (claude, grok, codex, pi, vibe, kimi, fx, cursor, hermes) |
| License | MIT |

**What it is.** A fork-and-configure agent template on GitHub Actions. A skill is a
Markdown prompt with frontmatter (`mode: read-only | write`, `requires:` secrets,
`var:` input). `aeon.yml` schedules skills on cron; every run is a fresh headless CLI
invocation; nothing persists except git and a `memory/` directory (`MEMORY.md` as a
short index, `topics/`, append-only daily `logs/`, an `issues/` tracker). A post-run
step asks a cheap model to score the run's stdout 1–5 with flags. On top of that runs
a closed loop: `skill-health` classifies every skill from run history and the scores,
files issues; `skill-repair` picks the worst fixable one and ships a PR;
`self-improve` makes one small fix every other day; `autoresearch` rewrites a skill
four ways (better inputs / sharper output / more robust / rethink), scores the
variants, and ships the winner with the chosen lineage tagged in an HTML comment.
`spawn-instance` forks the whole agent into a specialised copy; `distribute-tokens`
pays contributors USDC by merged-PR rank.

**Why it matters here.** It already runs the shape the user-zero idea wants —
scheduled, self-scoring, self-repairing, self-rewriting, with a payment layer for
early participation — and it does so **without a contract**. Its fitness function is
the same cheap scorer that grades output. `autoresearch` is graded by the thing it is
evolving toward. Aeon is therefore the null hypothesis for user zero: the loop
without the constitution. Whatever it converges on tells us what the loop does when
nothing external ratifies.

Confidence that the self-grading loop is a live Goodhart risk rather than a
theoretical one: moderate. The repo's own docs record the shape (the scorer "grades
stdout, not `./notify`", so skills learned to keep substance in stdout; codex
"narrated pessimistically" and was under-graded). Not yet observed: a skill that got
*worse* while its score rose.

### 2. Where Aeon and InDusk converge

Convergence is strong on epistemics, weak on mechanism. Confidence high for the first
three rows, moderate for the rest.

| Idea | Aeon | InDusk |
|---|---|---|
| Verify by state, never by the agent's prose | `scripts/dev-loop-pr.sh` snapshots open PRs before and after a run and requires a `<!-- aeon-dispatch:ID -->` marker in the PR body; `dev-loop-repair.sh` refuses unless the PR head SHA is unchanged before the repair and changed after | phantom-work detection, the `Code-Commit:` trailer, "read the output not the exit code" |
| One definition, parity-checked in CI | generated `harnesses.json` must match a fresh regen; capability allow-list, doc and schema must agree in one PR (`ci-capabilities-parity`); `AGENTS.md` generated from `CLAUDE.md` | single-definition count tests, `skill-sync-parity`, hook ports "change together" |
| A gate that cannot load must fail loud | installs bubblewrap *before* the harness so a missing sandbox cannot silently downgrade to "advisory" | `hook-cwd-independence`; the run loop's "silence is not permission" |
| Say what a check does **not** prove | attestation proves bytes, not correctness; capabilities are documentation, not a gate; the egress parser is line-based and says so | "never report could-not-check as a verdict" |
| Scorer hygiene | a malformed judge reply is unscored, never a zero; invented specifics cap at 2; grades against the operator's `STRATEGY.md` | eval-agent scorecards (open question: do ours have the malformed-means-skip rule?) |
| Post-run model evaluation | inline workflow step, through the same harness the skill ran on | PostToolUse hook on commit, persistent evaluator session |
| Layered standing instructions | `CLAUDE.md` + `STRATEGY.md` north-star + `soul/` voice + a ~50-line `MEMORY.md` index | budgeted `CLAUDE.md`, `current.md`, `master.md`, lessons |

### 3. Where they diverge

- **Unit of work.** Aeon's is a *skill run*: recurring, scored, healed. InDusk's is a
  *plan*: one-off, gated, closed. Aeon has no plan documents, no lifecycle, no test
  trajectory; its `feature` skill goes research → one change → PR in a single run.
- **Where enforcement lives.** Aeon enforces *blast radius* at the OS layer
  (`bwrap` / `sandbox-exec` mounts the workspace read-only, uniformly on all nine
  harnesses) and at PR time in CI. Inside a run the model is trusted. InDusk enforces
  *process* in-run through PreToolUse hooks and Dawn's tool envelope. Aeon asks "can
  it write, and to which hosts?"; InDusk asks "did you write the test first, are the
  gates green?"
- **Quality lever.** Aeon's is population-level and after the fact (score, detect,
  repair, evolve). InDusk's is per-task and before the fact.
- **Multi-model.** Aeon wraps CLIs as subprocesses and inherits each CLI's tool
  ecosystem. Dawn calls providers directly and owns the tool surface, which is what
  lets it gate every mutation. Different layer, different trade.
- **Ecosystem.** Skill packs, a plugin marketplace, fleet spawning, a token. InDusk
  has hub lessons and extensions.

### 4. Aeon mechanisms with a direct InDusk landing site

1. **Machine receipts in the PR shape.** Aeon's review posts an HTML-comment JSON
   receipt with a fixed schema, validated by a script; `approve-ready` is *defined*
   as zero critical and zero issues. Day's [`pr-shape.md`](../indusk-v4-day/pr-shape.md)
   wants a reviewer who does not read code; a parseable verdict block is the missing
   half. Confidence high this is the single most useful transfer.
2. **OS sandbox for the read-only lanes.** `indusk verify` and the eval agent are
   read-only by contract only (the eval agent runs with bypass permissions). A
   `sandbox-exec` / `bwrap` wrapper is cheap and makes "detects, never repairs"
   structural. Lands on Dawn component 6.
3. **A linter for the silent-misconfig class.** `aeon-doctor` reads config for faults
   that never produce a failed run: an unquoted cron, a `mode:` typo that grants
   write, an env placeholder that blacks out every MCP server. dusk's cwd-relative
   hook commands were exactly this class and were found by accident. The `master.md`
   item about `check_health` reporting three-way version state is the same family.
4. **`AGENTS.md` generation for non-Claude harnesses.** `@imports` do not expand
   outside Claude Code; Aeon generates a merged copy. Lands on Dawn component 7
   (`dawn-agents`), which will run a non-Claude model against a repo whose
   instructions live in `CLAUDE.md`.
5. **Egress lockfile for extensions.** Each skill's declared network hosts are hashed
   and CI fails on *expansion*, not on wording drift. An extension `manifest.json`
   could declare its reach the same way. Moderate value, lower priority.

**Not to copy:** prompt self-rewriting graded by the same scorer; exit taxonomies
regex-mined from free-text logs (Aeon admits a 10–20 % miss rate; dusk has the "never
parse runner output" rule); 82 skills' breadth when Aeon's own default strategy file
says depth over breadth.

### 5. The three telemetry layers, and which can bind to a contract

The 2026-09-15 conversation that seeded this plan named three escalating layers:

| Layer | Signal | Tells you | Binds to a contract? |
|---|---|---|---|
| 1 | errors, failed checks, incidents | something is broken | **yes, today's design** — Midnight's promise name threads a test, a code site and a span, so a production violation can name which promise broke |
| 2 | explicit user feedback: comments, ratings, "I didn't like this" | what people say they want | only if the contract is written in terms a user can be commenting *about* |
| 3 | inferred behaviour: what people actually do | what people want, unfiltered by what they can articulate | only if the contract names user-observable promises; otherwise the system optimises toward whatever is sticky |

So "what level of telemetry" is a **contract-authoring question before it is a
telemetry question**: layers 2 and 3 have nothing to route to unless the contract's
promises are stated as things a user could observe. Confidence moderate. The
planner's test-plan discipline (behavioural, not functional assertions) is already
the right vocabulary; the open question is whether a behavioural assertion can be
the join key for a span *and* a comment *and* a behaviour trace.

A caution from outside (named in the conversation, unverified here — see Sources):
statistical anomalies in production metrics do not equate to user impact because the
signals lack user intent; a launch or a traffic shift reads as a failure. The
proposed fix — fuse telemetry with explicit signal (feedback, tickets, forum posts) —
is layer 3 fused with layer 2, with the contract on top as arbiter.

### 6. Incentive contamination appears twice

- **Around the loop.** A token or payment for early participation buys layer-2 and
  layer-3 data from people optimising for the reward, not for the product. The
  cleanest emergent engine fed mercenary data.
- **Inside the loop.** Aeon's scorer grades the skills it is evolving; the loop can
  converge on what the scorer likes. Same failure, one level down.

Both say the same thing Midnight's brief already argues: the only fitness signal that
holds is one the system cannot influence — real users behaving, from outside the
repo.

### 7. Stated position (Sandy, 2026-09-16): three tiers, one owner each

Inertia is the default state of software, not a failure of this model; the question
is who may break it. The working answer:

| Tier | Owner | May do | Changes when |
|---|---|---|---|
| 1. Goal set | the creator | set the initial goals; rewrite them | only at a version boundary — **v2 is a new goal set** |
| 2. Promises (the contract) | the contract, ratified by its owner | move a promise between `enforced / known-violated / retired` (Midnight's states) | on a trigger the behavioural layer raises, e.g. a promise no user's behaviour has exercised in a window, or one that only fires as a violation |
| 3. Proposals | the crowd, through behaviour and comments | propose; never retire | continuously |

Deprecation is a tier-2 operation: telemetry proposes, the contract owner ratifies,
the loop executes the removal as an ordinary plan with a migration promise. A crowd
never asks for less, so retirement cannot be delegated to tier 3.

A v2 is a tier-1 operation. Emergent systems do not do v2 natively; they drift (Aeon's
`aeon-update` three-way-merging canon back into diverged forks is the drift problem
with no contract to decide what survives). So a new goal set has to carry a
**migration clause** naming which tier-2 promises survive. Without it the crowd's
accumulated shaping is lost at the first v2, and the central claim — that no one
designed these features — dies with it. Confidence high.

Altitude of the goal set: deliberately vague about *features*, precise about
*promises* — "players can always see why they lost", not "there is a match-history
screen". This is the planner's behavioural-assertion discipline applied to a product
instead of a plan.

**Two scoreboards (Sandy, 2026-09-17).** One of dusk's goals — not the only one; it
has also served as the working method inside a large organisation's codebase, where
it made one developer faster and found issues sooner, and that case has an external
baseline (the team's own review turnaround and escape rate) this one lacks — is
*more shots on goal, faster*. A shot is a concrete, bounded thing — e.g. an app handed to one known
founder to show what is possible, not parity with an incumbent. Dusk's success on a
shot is **process only**: the contract was fulfilled, it is bug-free and does what it
says, nothing escaped, it closed inside the cycle time. The shot's outcome (did he
play a second round, ask for something, introduce someone) is the venture's
scoreboard, and dusk is not accountable for it. Consequences: dusk's measurable
success criteria are promises about the process (escaped fixes per plan, cycle time
brief → close, review time per Day PR, close-out lag); the one product-shaped
question that stays inside dusk's scope is contract authoring, because "does what it
says" is only checkable if the contract said something checkable; user zero's
behavioural layer is product machinery dusk hosts, not a dusk success criterion.

**Timing:** none of this is planned further until Day is complete. The folder
collects evidence and positions; it does not open a brief.

## Open Questions

- What does a goal set's **migration clause** look like — a list of surviving
  promises, a rule for deriving them, or both — and what happens to a promise the
  clause forgets?
- What does a *ratifiable* contract look like — one whose promises a user can
  observe, a span can carry, and a comment can be about? Is the behavioural test-plan
  assertion already that object, or does it need a user-facing rendering?
- What is the minimal external fitness signal for a game-shaped first product, and
  does a game's exploratory, ambiguous behaviour make layer 3 harder or easier than a
  productivity tool's?
- Can the incentive be structured to reward genuine engagement over farming? What
  would an investor's first objection be, and is there an answer ready?
- Where exactly does user zero sit relative to the sequence: a Day component, a
  successor to Midnight, or a separate product built on both?
- What did Aeon actually converge on? Re-read `autoresearch` lineage comments across
  the skill set in a few months and look for a skill whose score rose while its
  output got worse.
- Does dusk's evaluator skip a malformed score rather than record a zero?

## Sources

**Primary (read):**

- `aeonfun/aeon` at `c5eaf63a`, 2026-09-16 — `CLAUDE.md`, `AGENTS.md`,
  `STRATEGY.md`, `aeon.yml`, `docs/CORE.md`, `docs/harnesses.md`,
  `docs/CAPABILITIES.md`, `docs/attestation.md`, `docs/skill-integrity.md`,
  `docs/SHOWCASE.md`, `docs/dry-run-harness-selection.md`,
  `harness-adapter/README.md`, `skills/skill-health/SKILL.md`,
  `skills/feature/SKILL.md`, `scripts/dev-loop-{pr,review,repair}.sh`,
  `.github/workflows/aeon.yml` (step list and the scorer prompt region).
- Repo statistics via the GitHub API, 2026-09-16.

**Named in the seeding conversation (2026-09-15), not yet verified — treat as leads,
not citations:**

- Voyager — an agent that builds an expanding skill library through trial and error
  in Minecraft.
- SEAgent — computer-use agents mastering unfamiliar software by exploration and
  auto-generated tasks of increasing difficulty.
- A proposer / solver / judge co-evolution design in which one agent generates
  tasks, one solves them, one produces the preference signal.
- A continuous-software-evolution benchmark whose headline result is that sustained
  evolution relies on proactive codebase exploration and disciplined test
  verification, and that blind trial and error and absent verification accelerate
  failure.
- AgentGUI — a research interface for monitoring and steering fleets of agents: live
  activity feed, wall-clock timeline, per-call telemetry. Built for an operator, not
  a user.
- A VS Code feature request for "live steering" — correcting generated code while
  the agent continues elsewhere.
- A Google SRE piece on statistical anomalies versus user impact, proposing fusion
  of telemetry with customer feedback, tickets and forum posts.
- A paper arguing that "done" no longer applies with agents; shipping becomes
  shaping.

**Internal:**

- [`midnight/brief.md`](../midnight/brief.md) — the promise-name linkage; the
  external-feedback argument.
- [`indusk-v4-day/pr-shape.md`](../indusk-v4-day/pr-shape.md) — where a machine
  receipt would land.
- [`master.md`](../master.md) — the sequence this runs beside.
