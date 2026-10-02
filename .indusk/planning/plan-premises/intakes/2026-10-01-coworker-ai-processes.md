---
title: "Intake — how eighteen coworkers build with AI"
date: 2026-10-01
kind: intake
trigger: concern raised directly
---

# Intake — how eighteen coworkers build with AI

Run by hand, before any tooling exists. The developer's question: is there
anything to learn, are there patterns that make sense, and does anything say our
approach is not correct. Advocate: the working session (has the thesis in
context). Critic: headless `claude -p` from an empty scratch directory, given only
the two sections below as files and allowed only to read; its isolation check is
included.

People are P1 to P18. Names, the company and its clients are kept out of this
document; the thread itself and who each person is are in the developer's
private notes.

## Sources

- A company-internal Slack thread, about September 2026, pasted by the developer
  on 2026-10-01. Private; quoted here without names.
- P18's own public writeup of the same pipeline, read in full on 2026-10-01. The
  address is withheld because it identifies P18.
- [Superpowers](https://github.com/obra/superpowers) — public plugin, read 2026-10-01.
- Conductor (conductor.build) — public app; from
  [a first-look writeup](https://www.mattcullerton.com/tokdocs/first-look-at-conductor-parallel-coding-agents-with-git-worktrees/)
  and [a usage guide](https://codepick.dev/en/guides/conductor-build-intro/), 2026-10-01.
- One artifact linked in the thread (P17's "Hub" example) could not be read: not
  shared with this session's account.

## Material: Material under intake (2026-10-01)

### M1. A team thread: eighteen practitioners each describe their AI development process

One company's engineers (and one designer), most on client projects, posted under the same five
headings: intake, coding, review/testing, deploy, biggest friction. People are P1 to P18. P3 is
the thread's host and posted replies only.

- **P1.** Enters plan mode with a 1-3 paragraph essay of context and worries. For complex work, a
  separate cheaper-model session tests APIs and hypotheses first. 100% AI-generated code; reads
  about 70% closely; asks a second model when confused. A root rule tells the agent to keep
  gotchas and an architecture summary in the AGENTS.md of the folder they apply to, and to put a
  rule in AGENTS.md but the log of how it was reached in docs/investigations. "I end up with some
  AGENTS.md files that are a bit bigger than I'd like, but it's easier than watching my agent keep
  forgetting things." Friction: "Auditing the AI's work (reading its plans, reading its output,
  judging whether its explorations proved what I asked it to prove)."
- **P2.** Everything lives in Linear, the whole team connected by MCP. Planning dictated by voice
  into specs, diagrams and tickets; a harness extracts tickets from Slack threads. AGENTS.md
  updated every time an output deviates. Nearly all AI-generated. Team-wide shared skills. Review:
  a skill where a frontier model extracts context and a cheaper model reviews; an automated PR
  reviewer; a bot that can review and approve. Friction: "PR merge latency. Every PR goes through
  agentic review and then waits for human approval, which becomes the bottleneck"; the client is
  moving to auto-approve. And "Managing LLM output! With the amount of stuff being generated it
  can really be hard to keep up". Runs the ticket extraction by hand "once i feel more trust in
  the flow".
- **P3 (host).** "I need the agents to build trust with me before I feel safe fully handing off a
  step in the pipeline." Uses a skill that rewrites AI prose into plainer language, and a skill
  that explains in small pieces and quizzes him.
- **P4.** A high-reasoning model breaks down the ticket, validates against current patterns, writes
  a detailed plan the human reviews. Custom harness, 99% AI. QA by a computer-use agent driving a
  real browser and sending screenshots. The harness opens the PR; the human presses merge when
  review is addressed and CI is green. Friction: review is not automated; must pull each review
  into the agent, "plus ensuring AI work is up to standards".
- **P5.** Long no-code back-and-forth with the model to reach a "fairly complete plan", then
  tickets read one by one. 99% AI. Testing starts from "a lab setting mindset, E2E test through
  the happy path, verifying by hand, I like to see the different steps myself"; wants tests as
  close to production as possible; AI fills in unhappy paths. Friction: "the verbosity in the
  beginning and whittling down, reading takes time, reading makes me lose focus".
- **P6.** Ticket via the tracker's MCP plus Slack for what the ticket lacks. About 5% by hand. AI
  review as a second pair of eyes, but "I still prefer review it manually because that's the last
  gate before the code is shipped". Manual testing for user-facing work. Major client-facing
  deploys are human-triggered. Friction: an area not captured in context, the agent asks, and
  nobody can answer right away; "Not everything could be deferred."
- **P7.** A planning plugin (Superpowers, see M3) for back-and-forth; the AI writes a spec, the
  human reviews it, a plan is written from the spec; both saved to the repo. 99% AI. About 90% of
  the time in an orchestration app (Conductor, see M4). Switches models for different
  perspectives. Stacked small PRs. A review agent and the coding agent communicate through a file
  in the workspace. Screenshots and videos attached to the PR. Reads every change. Friction: "Each
  stage is still a manually triggered by me... I curious how people stream those things together
  if they do. I imagine a skill"; "trusting that the ai didnt add minor slop to the codebase which
  compounds but that review slows things down... death by a thousand slops"; working away from
  the desk.
- **P8.** Larger initiatives in ideation. Voice into a model; diagrams of the critical path and
  one-way doors; ADR/RFC to align the team; tickets with acceptance criteria. "I write/look at
  zero code." Agents follow the acceptance criteria and post evidence to the tickets as comments.
  A deploy skill gives a confidence score and prevents production destroys. Friction: "focus on
  the surface area for bigger roadmap items".
- **P9.** A skill pulls requirements and QA comments, checks existing code, writes implementation
  and verification steps. An isolated worktree per ticket. A separate agent reviews and tests
  real behaviour in the browser; before/after screenshots and "a report showing what passed,
  failed, or couldn't be verified". Target: a draft PR with evidence. Friction: "Verification
  still takes supervision. Making sure the agent tested the right version, covered the
  requirements, and produced useful evidence".
- **P10.** Built a custom orchestrator because existing ones did not fit and carry too many
  dependencies for client work. Planning with human-in-the-loop where the agent knows least:
  "validates - doesn't assume, asks a lot of questions". Parallel multi-model reviewers feed an
  adjudicator model that verifies findings and decides what to fix; up to two more rounds on
  sensitive changes. 100% generated; vertical slices with a test per slice. A watcher resolves
  PR comments. "Forced all reviewers to be super adversarial". Daily standup and weekly retro
  reports. Friction: maintaining the orchestrator off-hours; review loops; "The planning phase is
  the most interactive/slowest part; but also the most important since it's the foundation for
  every other phase".
- **P11.** Tracker by MCP. For anything non-trivial, a read-only investigation first: "query
  dev/prod, confirm as much as possible before trusting the ticket. Findings get written back into
  AGENTS.md". 90%+ AI. Manual review plus generated tests; bot review after push. Friction:
  context in tickets, Slack, database state and prior investigations "all live in different
  places and are often written extremely verbosely by llms. Sometimes its hard to tell if the llm
  has done the right thing for a ticket without spending a bunch of time reading and verifying".
- **P12.** Describes a personal project built for agents from the start. Untemplated issue
  filing, later batch-clarified and labelled for agents. 99%+ AI. A durable agent-workflow
  framework drives a repo agent and a CI review router that classifies scope and risk and
  delegates to different review workflows; some reviews spin up the full app. A "Verify" CLI
  harness runs in CI or locally. "bugs/regressions are rare". Agent eval suites check whether an
  agent can use the product. Agents operate deployment. Friction: CI is the bottleneck;
  maintaining a home server; "Bloated unit tests: Kills token efficiency and mostly redundant
  with existing e2e suites."
- **P13 (a designer).** One project folder holds decisions, prompts, rules, artefacts and "a
  module that captures the reasoning behind the project, so if another designer needs to jump in,
  they just point Claude at the folder". Meeting transcripts and design comments go into a
  decisions.md; "any request to create something new gets checked against it first". A set of
  knowledge libraries every request is checked against, updated monthly. Handoff "has been a
  breeze".
- **P14.** Tracker by CLI/MCP; planning produces tickets "with clear goals, acceptance criteria
  and how to test them". ~100% AI. Backend/API first, full scenario testing through the API.
  "Sandboxing is huge for fast testing: per-worktree DB, seed data, run scenarios, then an agent
  reviews the results straight from the data persisted in the DB". A review skill, "an
  adversarial review every so often". Friction: "I still find it difficult, even with tools like
  [three orchestrators], to manage multiple projects and multiple agents."
- **P15.** On the client: a team-built "software factory": a triage agent, a spec agent whose plan
  is approved if complex, implement and review agents. "95%+, 90% one shot". Personally: /plan
  and /start commands, worktrees, a custom daemon automating the lifecycle, "merge when ready".
  Friction: "keeping track of what needs to be done next in what order when running 5+ tasks in
  parallel".
- **P16.** Pastes a ticket ID; "we hash out a plan of attack conversationally rather than writing
  a separate design doc first"; plan mode for bigger changes. 70-80% AI first draft. A bot
  reviews every PR. No AI in deploy. Friction: tests against a flaky third-party sandbox.
- **P17.** Uses interactive artifacts instead of long requirement documents to align leadership
  and non-technical people. Friction: "a single source of truth when context is spread out
  between different systems". Answer: one root artifact per project, "the Hub", linking to all
  documents; "all the changes to them go through the Hub. Only the Hub itself is kept up-to-date
  at all times, the rest of the docs record the diffs". It "naturally evolved as a way to manage
  a project and not go crazy". A colleague replied: "A wall of text is so cheap to make. Shared
  understanding is the valuable thing."
- **P18.** The company's lead on AI tooling; the only developer on a project; six weeks, 128 PRs
  opened, 124 merged. See M2.

Tallies across the seventeen who described a process (counted by the working session):
- Code stated as 90% or more AI-generated: 13.
- A written plan, spec or ticket set the human approves before coding: 9 (P1, P4, P5, P7, P10,
  P14, P15, P16, P18).
- A ticket tracker as the system of record for the work: 13. Plans, decisions or findings also
  kept as files in the repo or a project folder: 4 (P1, P7, P11, P13); P17 keeps them in a hub
  artifact.
- Evidence from the running product (browser, screenshots, stored data) attached to the ticket or
  PR, or judged by an agent: 6 (P4, P7, P8, P9, P14, P18); P12 spins up the full app in review.
- A worktree per ticket or task: 5 (P7 via the app, P9, P14, P15, P18).
- Built their own harness, orchestrator or pipeline: 6 (P4, P9, P10, P12, P15, P18). About ten
  different orchestration or session tools are named across the thread.
- Adversarial or multi-model review: 3 (P10, P14, and P18 who tried it and dropped it).
- Tests written before the code, stated: 1 (P18); P10 writes a test per slice.
- Mechanical gates that block the agent mid-work, a falsification pass after completion, or a
  size budget on agent context: 0 described.
- Friction named: checking or trusting the AI's work 7 (P1, P2, P4, P7, P9, P11, P18); volume of
  text to read 5 (P2, P3, P5, P11, P17's thread); tracking parallel streams 4 (P7, P8, P14, P15);
  waiting on review or CI 4 (P2, P10, P12, P18); missing or scattered context 3 (P6, P11, P17).

### M2. P18's public writeup of the same pipeline

Pipeline: ticket skill (agent audits the code and searches for duplicates; human sees every
ticket) -> dispatcher (read-only agent; builds a dependency graph from blocking relations, ranks
candidates by how many tickets each unblocks, lists the author's own open PRs first: "finishing
beats starting") -> start-ticket (read-only investigation; a plan mapping each acceptance
criterion to a step; 2-3 clarifying questions; human approves) -> work-ticket (failing unit test
first, then implementation; drives the real signed-in app with a browser tool, a screenshot per
criterion and a video per flow, one negative check; writes a "Human verification" section with
exact steps) -> CI reviewer (a different agent, on every push, with the ticket and PR history
injected; read-only; must try to refute each finding before posting) -> address-pr-review (treats
comments as claims to verify; two rounds maximum) -> human verification -> merge -> finish-ticket.

Skills are markdown files. Mechanically enforced: a pre-commit hook (lint, types, tests for
touched areas), the CI reviewer, the reviewer's and dispatcher's restricted tool permissions, the
two-round cap. Instructed in prose: test-first, atomic commits, treating review comments as
claims. 4-5 agents in parallel, each in its own worktree.

Numbers: about 1,300 commits; planning about 12 minutes per ticket; 27 minutes to about 2 hours
from approval to green CI; CI reviewer made 581 findings on 91 PRs (447 bugs); of replies to its
comments, 231 accepted, 12 partially, 4 rejected; median PR open-to-merge about 18 hours, the
slowest step being the author's own verification.

Stated lessons:
- Tried a development framework named GSD and dropped it: it "grew unwieldy"; "I tried forking it
  and tuning it my way, then realized Claude Code and OpenCode were good enough on their own."
- Multi-model adversarial review (six models per plan): "It caught things, but it made more noise
  than it was worth. One reviewer with the right context beats six reviewers without it."
- "A reviewer that reproduces its findings never runs out of findings." One PR accumulated 38
  findings across 28 commits; a heuristic added in such a round "caused a real data-loss bug.
  That's why address rounds are capped at two."
- "Bots can bury humans": six times more bot text than human text on PRs.
- "A green run can lie": a job reported success 11 times while committing almost nothing.
- "Parallel agents create parallel problems": 22 PRs open at once, three claiming the same
  migration number; "Git didn't flag it; an agent checking every pair did."
- "AI can't be simple. Ask it to keep things simple and it sometimes goes full steam ahead
  anyway."
- "Never trust AI 100%. Verify everything."

### M3. Superpowers (public plugin; https://github.com/obra/superpowers)

"A complete software development methodology for your coding agents, built on top of a set of
composable skills." About 294,000 GitHub stars. Skills by name: brainstorming, writing-plans,
executing-plans, subagent-driven-development, dispatching-parallel-agents, test-driven-development,
systematic-debugging, verification-before-completion, requesting-code-review,
receiving-code-review, using-git-worktrees, finishing-a-development-branch, writing-skills.
Prescribed flow: brainstorm into a saved design document -> isolated worktree with baseline tests
-> a plan of 2-5 minute tasks with file paths and verification steps -> execution by subagents
with review per task -> red/green/refactor -> review against the plan -> finish the branch. The
skills trigger automatically and are instructional; nothing is described as a hard block.

### M4. Conductor (public app; conductor.build)

A Mac app that runs multiple Claude Code and Codex agents in parallel, each in its own git
worktree on its own branch, with a dashboard, a diff-first review panel and a tracker
integration.

## Critic input: Subject: what InDusk does (facts only)

InDusk is a development system for AI-assisted software work. It is built and used by one
developer, published as an npm package with a CLI and an MCP server, and run inside Claude Code.
It has been under development for about six months.

- Work is organized as plans: folders of markdown documents in the repository, in a fixed order
  (research, brief, test plan, ADR, implementation checklist, retrospective). A plan declares a
  type (feature, bugfix, refactor, spike) that says which documents it needs. Plans are ordered
  in a master plan document. Nothing lives in a ticket tracker; a tracker integration is planned
  and not built.
- The human accepts the brief and approves the implementation checklist before code is written.
- Implementation checklists are split into phases; each phase has gates (verification, context,
  documentation). Claude Code hooks refuse edits and checkbox flips when a gate is unmet, refuse
  code edits and commits on the main branch, and refuse writes that break the checklist
  structure. These are mechanical blocks, not instructions.
- Every plan has a test trajectory table: each test is written failing before the code that makes
  it pass, and a phase cannot close while its tests are unwritten or failing. Verification items
  are runnable commands; a test counts by its exit code. There is no built-in step that drives
  the running product and collects screenshots or stored data as evidence.
- One git worktree per plan; the main branch refuses code. One commit per checklist item.
- After implementation: a falsification pass (the agent is told to find failing tests in the
  finished work; findings become a new phase), a cleanup pass (cross-file duplication review), a
  per-phase craft review, then a retrospective.
- A background evaluator agent (one model, a persistent session) scores each commit and turns
  flagged moments into "lessons": short rule titles that later sessions load.
- Project memory is one root CLAUDE.md with a hard 60 KB size budget enforced by a hook, plus the
  lessons registry and archived plan documents. A plan to move rules into per-directory context
  files is accepted and not built.
- Multiple sessions on one machine coordinate through one shared markdown file with per-session
  sections under a file lock.
- "Promises": declared behavioural claims marked by OpenTelemetry spans and monitored through a
  local or deployed Jaeger; a violation reopens the owning plan.
- An orchestrator command runs a plan's phases through any model in a gated loop.
- A read-only web admin shows plans, phases and progress. A fixed pull-request shape that carries
  a plan's evidence to a reviewer has an accepted design and is not built.
- Several of its mechanisms (lessons registry, boundary maps, blocker protocol, forward
  intelligence) were adopted from the GSD framework early on.
- Output a human must read per plan: a brief, a test plan, sometimes an ADR, an implementation
  checklist of several hundred lines, a retrospective, plus documentation pages and context
  edits.

## Critic reading (isolated)

_Verbatim, except that an email address and local directory and skill names in its isolation check were removed by the working session._

### Strong arguments

**1. The subject lacks running-product evidence; a third of the practitioners name it as the core of verification, and the one detailed practitioner found verification his slowest step.**
Subject.md line 20: "There is no built-in step that drives the running product and collects screenshots or stored data as evidence." The subject's test gate "counts by its exit code" (line 20). Against this, M1 tally line 125: "Evidence from the running product (browser, screenshots, stored data) attached to the ticket or PR, or judged by an agent: 6 (P4, P7, P8, P9, P14, P18); P12 spins up the full app in review." M2 (P18) has "a screenshot per criterion and a video per flow, one negative check." P9 produces "a report showing what passed, failed, or couldn't be verified." P18's own data names "the slowest step being the author's own verification" (M2 line 158), and P9 names as friction "Verification still takes supervision... covered the requirements, and produced useful evidence" (P1 lines 61-63). **STRONG:** multiple independent practitioners build the exact capability the subject explicitly omits, and the lone detailed case shows verification is where the real time goes — the subject gates on exit codes, which several practitioners treat as insufficient for user-facing correctness (P5, P6 do manual/E2E testing; P6: "the last gate before the code is shipped," lines 40-41).

**2. The subject's six-document, several-hundred-line-per-plan output is precisely the "volume of text to read" that five practitioners name as their main friction — and some get the same planning result conversationally.**
Subject.md lines 39-41: output per plan is "a brief, a test plan, sometimes an ADR, an implementation checklist of several hundred lines, a retrospective, plus documentation pages and context edits." M1 tally line 134: "volume of text to read 5 (P2, P3, P5, P11, P17's thread)." P5 names as friction "the verbosity in the beginning and whittling down, reading takes time, reading makes me lose focus" (lines 37-38). P11: context "often written extremely verbosely by llms. Sometimes its hard to tell if the llm has done the right thing... without spending a bunch of time reading and verifying" (lines 77-78). P16 gets a plan with *less*: "we hash out a plan of attack conversationally rather than writing a separate design doc first" (lines 104-105), at 70-80% AI. P17's colleague: "A wall of text is so cheap to make. Shared understanding is the valuable thing" (lines 112-113). **STRONG:** the subject manufactures, per plan, the exact artifact-volume the practitioners name as their dominant pain, and at least one practitioner reaches an approved plan with a conversation instead of a document stack.

**3. P18 built the same pipeline shape the subject built, but keeps the system of record in a tracker and found a ticket pipeline sufficient without the subject's fixed six-document plan folder.** 
Subject.md line 9: "Nothing lives in a ticket tracker; a tracker integration is planned and not built." M1 tally line 121: "A ticket tracker as the system of record for the work: 13." P18's pipeline (M2) is ticket-driven end to end: "ticket skill... dispatcher... start-ticket... finish-ticket," with a dispatcher that "builds a dependency graph from blocking relations, ranks candidates by how many tickets each unblocks" (lines 141-144) — dependency sequencing the subject does by hand via "Plans are ordered in a master plan document" (subject line 7). **STRONG:** the most-detailed, highest-output practitioner (M1 line 114: "128 PRs opened, 124 merged" in six weeks) achieves sequencing, dispatch, and dependency ranking through a tracker the subject deliberately omits, and 13 of 17 practitioners treat the tracker as the backbone.

**4. The subject adopted mechanisms from GSD; the one practitioner who used GSD dropped it and concluded the base agents were "good enough on their own."**
Subject.md line 38: "Several of its mechanisms (lessons registry, boundary maps, blocker protocol, forward intelligence) were adopted from the GSD framework early on." M2 line 161: P18 "Tried a development framework named GSD and dropped it: it 'grew unwieldy'; 'I tried forking it and tuning it my way, then realized Claude Code and OpenCode were good enough on their own.'" **STRONG on the shared lineage:** the subject's genealogy traces to a framework that the one practitioner with direct experience of it judged to grow unwieldy and to be unnecessary over the base tools — and the subject's own output volume (arg 2) is consistent with the "grew unwieldy" failure mode he named.

**5. The subject's falsification pass and uncapped-reopening design match the exact mechanism P18 found produced noise and a real bug, which is why he capped it.**
Subject.md line 24: "a falsification pass (the agent is told to find failing tests in the finished work; findings become a new phase)." And line 33: a Promise "violation reopens the owning plan" — no cap stated. M2 lines 165-167: "'A reviewer that reproduces its findings never runs out of findings.' One PR accumulated 38 findings across 28 commits; a heuristic added in such a round 'caused a real data-loss bug. That's why address rounds are capped at two.'" The subject does cap address rounds? Subject.md names no cap on falsification-phase generation or on Promise-triggered reopening. **STRONG:** P18's hard-won lesson is that a self-reproducing find-more-failures loop must be capped or it manufactures noise and even bugs; the subject's falsification pass ("findings become a new phase") and reopening Promises are described without such a cap.

### Weaker and rhetorical arguments

**6. Most practitioners run adversarial/multi-model review as a strength; the subject has no multi-model reviewer — but the evidence actually cuts the other way, so this is WEAK.**
M1 tally line 129: "Adversarial or multi-model review: 3 (P10, P14, and P18 who tried it and dropped it)." Subject.md has a single-model evaluator (line 27) and single-model craft review (line 24). This looks like a gap, but only 3 of 17 do multi-model review and P18 *dropped* it: "One reviewer with the right context beats six reviewers without it" (M2 line 164). **WEAK:** the thing the subject "lacks" is something the majority also lack and the detailed case abandoned.

**7. Public tools (Superpowers, Conductor) already provide the subject's worktree/plan/TDD methodology, so the subject reinvents them — RHETORICAL as stated.**
M3: Superpowers is "A complete software development methodology... composable skills" including "writing-plans, executing-plans... test-driven-development... using-git-worktrees," with a flow "brainstorm into a saved design document -> isolated worktree with baseline tests -> a plan of 2-5 minute tasks... red/green/refactor." M4: Conductor "runs multiple Claude Code and Codex agents in parallel, each in its own git worktree." Subject.md has one-worktree-per-plan (line 21), test-first (line 20), plan documents (line 6). **RHETORICAL:** the overlap is real but the subject's distinguishing claim is *mechanical enforcement* — "Claude Code hooks refuse edits and checkbox flips when a gate is unmet... These are mechanical blocks, not instructions" (lines 14-16) — whereas M3 explicitly says of Superpowers "nothing is described as a hard block" (line 186). Naming the overlap without engaging the blocks/instructions distinction only renames the feature; it does not show the public tool does what the subject does.

**8. The subject uses one shared markdown file under a lock for multi-session coordination; practitioners use trackers/MCP — RHETORICAL.**
Subject.md line 30: "Multiple sessions on one machine coordinate through one shared markdown file with per-session sections under a file lock." Practitioners coordinate via Linear/MCP (P2 line 17), worktrees (tally line 126). This is a difference, but no practitioner states a file-lock approach fails or that their method is cheaper for the one-developer, one-machine case the subject targets (subject line 2). **RHETORICAL:** rests on "others do it differently" (popularity) without evidence of a worse outcome.

**9. "Bots can bury humans" / "Managing LLM output" — the subject generates more per-plan text than anyone, WEAK-to-overlapping with arg 2.**
M2 line 168: "'Bots can bury humans': six times more bot text than human text on PRs." P2 line 23: "Managing LLM output!... hard to keep up." This reinforces arg 2 but adds no independent subject line beyond lines 39-41 already cited. **WEAK:** largely a restatement of argument 2.

### Caveats against my own strong arguments

- **Against arg 1 (no product evidence):** only 6 of 17 attach running-product evidence (tally line 125) — it is not a majority practice, and the subject's test gate is runnable commands checked by exit code (line 20), which is genuine automated verification, not nothing. P14 reaches high confidence via "per-worktree DB, seed data, run scenarios, then an agent reviews the results straight from the data" (lines 95-96) — data-based, not screenshot-based — a mode the subject's exit-code tests partly resemble.
- **Against arg 2 (text volume):** the subject enforces a hard 60 KB CLAUDE.md budget (line 27) — a mechanical control on *loaded* context that P1 explicitly wishes for ("AGENTS.md files that are a bit bigger than I'd like," line 14) and that no practitioner reports having. The per-plan documents are archived (line 28), not all permanently loaded, so "several hundred lines" may not be live-context cost. P8 writes ADR/RFCs too ("ADR/RFC to align the team," line 54) and "write/look at zero code" — so heavy documents are not uniformly treated as the pain.
- **Against arg 3 (no tracker):** subject.md line 9 says "a tracker integration is planned" — the omission is acknowledged and provisional, not a rejection. And 4 practitioners (P1, P7, P11, P13) plus P17 keep plans/decisions as files or a hub, not only in a tracker (tally lines 121-123) — repo-resident planning docs are a real minority practice the subject shares.
- **Against arg 4 (GSD lineage):** the subject "adopted mechanisms from GSD early on" (line 38) — adopting named mechanisms is not running the framework; P18 dropped the *whole framework* for being unwieldy, not those specific mechanisms. The subject may have extracted the parts and shed the bulk, which is exactly what P18 says he tried ("forking it and tuning it my way," line 161).
- **Against arg 5 (uncapped falsification):** subject.md does not state the falsification pass is uncapped — it states findings "become a new phase" (line 24) once, after implementation, not a reproduce-on-every-commit loop like P18's 38-findings case. P18's bug came from "a heuristic added in such a round" (line 167), a specific mechanism the subject is not described as having. The subject also enforces gates mechanically, which could bound iteration in ways subject.md does not spell out. The argument asserts an absence of a cap that the facts neither confirm nor deny.

### Isolation check

Everything in my context besides material.md and subject.md:
- **The CRITIC role assignment and rules** (from the user turn) — process instructions; no information about the subject.
- **System reminder / CLAUDE.md** (global user instructions: "Do Not Reinvent the Wheel," "Questions Are Questions," monorepo commit siloing; the user's email address; date 2026-10-01) — none of this describes the subject InDusk or the practitioners; no subject information.
- **Environment block** (working directory names of unrelated projects, platform/shell/model facts) — directory and project names unrelated to InDusk; gave me no information about the subject.
- **Tool list, deferred tools, MCP servers, agent types, available skills** (skill names unrelated to the subject; Conductor is *not* among them) — tool metadata; no subject information.
- **Memory directory instructions and MEMORY.md mechanics** — I did not read any memory files; no subject information entered from them.

None of the non-file context gave me any information about the subject. All subject claims above are sourced to subject.md, and all comparisons to material.md.

## Advocate reading (working session — has the thesis in context)

1. **The thread's largest friction is the problem InDusk is built on, and nobody
   in it reports having solved it.** Seven of seventeen name checking or trusting
   the AI's work. P1: "judging whether its explorations proved what I asked it to
   prove." P7: "death by a thousand slops." P9: "making sure the agent tested the
   right version." P18, with the most developed pipeline in the thread, names
   himself as the bottleneck: eighteen hours median from PR open to merge, "the
   slowest step is me running the verification steps." Their shared answer is
   more reviewers and a human at the end. **Strong on the need. It shows nothing
   about whether gates and a test trajectory meet it.**
2. **Instruction is not enforcement, and P18's own lessons say so.** His
   test-first rule is prose in a config. His lessons: "AI can't be simple. Ask it
   to keep things simple and it sometimes goes full steam ahead anyway", "A green
   run can lie" (a job reported success eleven times while committing almost
   nothing), three PRs claiming one migration number that "Git didn't flag".
   Superpowers describes the same flow InDusk has and blocks nothing. Hooks that
   refuse the write are the one mechanism here that no practitioner and neither
   tool has. **Strong.**
3. **Independent convergence on the same structures.** Approval of a plan before
   code (nine). A worktree per ticket (five). A reviewer that is never the author
   (P9, P10, P18). P1's rule-in-AGENTS.md, log-in-investigations split, per
   folder, is the accepted `context-tiers` design reached with one paragraph of
   instruction. P11 and P2 write findings back into AGENTS.md, which is the
   lessons registry by another name. P17's Hub and P13's decisions file are the
   master plan and the ADR. **Moderate, and it cuts both ways:** the shape is
   right, and it is not ours alone.
4. **Two people ask, in the thread, for things InDusk has built.** P7: "Each
   stage is still a manually triggered by me... I curious how people stream those
   things together." P15 and P14 cannot keep track of what is next across
   parallel work. Phase gates that advance on green and a declared plan order
   are built answers. **Moderate:** P18's dispatcher answers "what next" by
   computing it from dependencies, which is better than an order kept by hand.
5. **The size budget is something P1 wishes for.** "AGENTS.md files that are a
   bit bigger than I'd like, but it's easier than watching my agent keep
   forgetting things." P11 calls the model's own notes "extremely verbose".
   Nobody describes a limit. **Moderate.**
6. **P18 dropped six-model review for one reviewer with the right context.** That
   supports a single evaluator fed the plan over a panel. **Weak:** it is his
   experience on one project, and it also bears against the falsification pass
   (critic, argument 5).
7. **"InDusk already has that."** Tempting on nearly every item above.
   **Rhetorical — flag.** Having a mechanism with the same name says nothing
   about whether it works as well as theirs.

## Where the readings meet (working session's note, not a verdict)

- **Both readings agree on the clearest gap: evidence from the running product.**
  Six practitioners collect screenshots, reports or stored data and attach them
  where a reviewer will see them; P18 walks every acceptance criterion in the
  real app before the PR opens. InDusk's verification is commands and exit codes.
  The accepted pull-request shape design is where this would land, and it is not
  built. Nothing in the advocate reading answers this.
- **The critic's argument 2 stands, and it is the one the developer has raised
  himself.** The 60 KB budget limits what the agent loads. Nothing limits what
  the human must read. Five people name reading volume as their main pain, and a
  plan here produces a brief, a test plan, a checklist of several hundred lines
  and a retrospective. The thread's fixes are plainer rewriting (P3), piecemeal
  explanation (P3), and visual or interactive output (P17). InDusk has a
  read-only admin and nothing else on this side.
- **Argument 3 is half right.** The tracker as system of record is planned, so
  that part is known. The part that lands is P18's dispatcher: what to pick up
  next is computed from blocking relations, lists unfinished work first
  ("finishing beats starting"), and says which tickets a cheaper model can take.
  Here the order is a hand-edited list in the master plan.
- **Argument 4 is weak by the critic's own caveat**, but "grew unwieldy" is a
  fair warning for a system with nineteen skills, thirteen hooks and a context
  file two bytes under its limit.
- **Argument 5 misreads one fact and still points at something.** Falsification
  here is one authored phase per plan with a stated exit, not a loop on every
  push. But nothing caps how many times a plan may be reopened by a promise
  violation, and on the plan closed today the falsification phase's own fixes
  surfaced one more defect and the cleanup one more test. P18's rule is two
  rounds, then a human. InDusk has no number.
- **Neither reading could make the comparison that matters most to the
  developer's stated aim, more attempts, faster.** P18: twelve minutes to a
  plan, twenty-seven minutes to two hours from approval to green CI, 124 merged
  PRs in six weeks, alone. The plan closed here today was a bugfix that took a
  working day, about seventy commits and twenty-six test rows. The scopes and
  the rigour differ and the two are not directly comparable. The direction of
  the gap is not in doubt. Confidence: high that InDusk is slower per change by
  a wide margin; unknown whether what it buys is worth it, because P18 reports
  throughput and nothing about defects found after merge.
- **Every practitioner but one works on a client's or team's project**, where
  the tracker, the reviewers and the pull request are given. InDusk has been
  built and used in its developer's own repositories. Neither reading raised
  what it would take to use it where the plan cannot live only in the repo.

## Score

_Not yet — no metrics are declared. The developer scores._

## What this changes

_Developer's choice: nothing / a plan revised / research opened / a direction dropped._

## Correction (2026-10-01, raised by the developer)

The working session's note above said the plan closed that day "took a working
day" and rated "high" its confidence that InDusk is slower per change by a wide
margin. Neither holds.

**The figure was not measured.** Measured afterwards from git and the
phase-boundary record, for that plan:

| Span | Time |
|---|---|
| First plan commit to checklist approved (planning, including waits for the developer) | 2 h 37 min |
| Approval to all six phases closed, falsification and cleanup included | 2 h 27 min |
| Approval to merged on main (adds the retrospective and the landing) | 3 h 08 min |

P18's figure for the comparable span, approval to green CI, is 27 minutes to
about 2 hours. The build side is in the same range. The planning side is not:
2 h 37 min against his 12 minutes.

**The sample was the wrong one.** The developer's point: building InDusk with
InDusk is the slowest work he does, because the system is being designed as it
is used. Project work built *with* it, where the feature is obvious, is much
faster. No timing exists for that work; the project that would show it predates
the phase-boundary record.

**A phase, not a plan, is the unit closest to one of P18's tickets.** Across the
fifteen plans in this repository that have boundary records, 84 intervals from
one phase opening to the next: median 16 minutes, three quarters under 77
minutes, 55 of 84 under half an hour. A plan has a median of seven phases.

Restated: confidence is **unknown** on whether InDusk is slower per change. It
is **moderate** that planning, not building, is where its time goes, on the
evidence of one plan. The developer's position is that the system is being built
for quality first and will be reworked for speed. Recording cycle time per plan
and per phase is what would turn any of this into a finding.
