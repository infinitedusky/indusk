# Out of scope

This document names what Dawn-MVP is NOT, despite being tempting. Every entry has a reason and a kill condition. Without explicit out-of-scope discipline, scope drifts and MVP becomes "Indusk plus everything we've ever wanted to build."

## What Dawn is NOT

### Not an agent framework

Paperclip's quote: "We don't tell you how to build agents." Dawn says the same. Agents bring their own prompts, their own runtimes, their own models. Dawn provides the *project context* the agent reads — not the agent itself.

If the design partner says "we need to write our own agent," Dawn is wrong for them. Refer them to building on Claude SDK, Codex, Cursor's API, or whatever runtime they want.

### Not an orchestration platform

Paperclip orchestrates many agents toward business goals. Dawn focuses on one engineer's workflow inside one codebase. Multiple FDEs cooperating *via shared context* is in scope. Multi-agent task assignment, heartbeat scheduling, agent-to-agent messaging, budget enforcement — all out of scope. Use Paperclip if you need that.

If the design partner needs heartbeat-driven autonomous work, recommend Paperclip and consider building Dawn-as-Paperclip-plugin (per [pick-defer-cut P4](./pick-defer-cut)).

### Not a chatbot or "ask the codebase" interface

Tools that index a codebase and answer questions ("what does this function do?", "where is X used?") exist. Sourcegraph, Cody, Aider's repo-map, Cursor's @-references all do this. Dawn does NOT compete here. Dawn surfaces *project context that has been authored* (plans, decisions, lessons, in-flight work) — not *code-derived information* (call graphs, type usage, etc.).

If the design partner's primary need is code-derived Q&A, Dawn is wrong; recommend Cody or similar.

### Not a code-review tool

Dawn doesn't comment on PRs. Doesn't suggest changes. Doesn't enforce style. Use existing PR-review tooling (GitHub, GitLab, Sourcegraph Cody Review, Codacy, etc.). Dawn provides *the context for an engineer to make better PRs*, not the PR review itself.

### Not a project management tool

Linear, Jira, GitHub Projects, Notion all do project management. Dawn's "plans" are different — they're engineering work plans, not business backlogs. Dawn integrates *with* PM tools (via adapter; see [decision A7](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md)) rather than replacing them.

### Not a knowledge base

Notion, Confluence, GitBook are knowledge bases. They're optimized for browsing and searching long-form content. Dawn's lessons and decisions are optimized for *agent context loading* — short, structured, machine-parseable, time-stamped. They're authored *into* Dawn, not browsed from it.

If the design partner needs human-browsable internal docs, they need a wiki, not Dawn.

### Not a CI/CD or deployment pipeline

Dawn doesn't deploy, doesn't build, doesn't run tests in CI, doesn't manage releases. Use existing tools (GitHub Actions, Vercel, Fly, etc.). Dawn integrates *with* test results and observability via the petal/adapter model, but doesn't run them itself.

### Not autonomous

Dawn doesn't run agents in the background. Doesn't schedule heartbeats. Doesn't act without an engineer in the loop. The engineer drives; Dawn supports. (See "Not an orchestration platform.")

If the design partner wants autonomous agent execution, that's Paperclip's domain.

### Not a memory product

Mem0, Letta, MemGPT, and others position as "agent memory." Dawn's lessons + the lessons registry integration look superficially similar but the framing is different: Dawn provides *project memory* (what the project has decided, learned, tried), not *conversation memory* (what the agent remembers about the user).

If the design partner needs conversational memory across personal sessions, Dawn isn't it; recommend a memory product.

## What Dawn DOES NOT do, even though it's tempting

These are features we've considered for Dawn (or that exist in Indusk) and explicitly cut for MVP:

| Tempting feature | Why we cut | When to revisit |
|---|---|---|
| Eval-agent scoring every commit | Value depends on team-scale data; cost is high | After v1.x, with at least 5 active engagements |
| Cross-project memory federation | Value compounds slowly; v1 needs single-project value first | After v1.x, when multiple-project usage is real |
| Approval gates for engagement governance | Enterprise pull, not MVP pull | After first enterprise design partner |
| Auto-instrumentation OTel scaffolding | Forces opinion on telemetry stack the engineer may not want | After OTel-as-petal v1 |
| UI for non-engineering stakeholders | Different persona, different product | v2 — separate from FDE wedge |
| Marketplace for plans / templates / skills | Network-effect feature; needs user base first | After 10+ design partners |
| Mobile app | Solo-engineer feature; not FDE-shaped | Probably never |

## What ABOUT the FDE working with a team?

The team-multiplicative property is core to Why Dawn — not out of scope. But the *features* that surface team coordination (multi-user UI, real-time presence, comment threads on plans, approval workflows, etc.) DEFER to v1.x.

The architecture supports them. The MVP doesn't ship them. The MVP delivers single-FDE value with team-multiplicative architecture so v1.x can light up team features without a rewrite.

## Kill conditions for cut features

A cut feature comes back if and only if a design partner says, unprompted, "I would buy this if it had X." Not "X would be nice." Not "X seems missing." Specifically: "X would change my decision to use Dawn." Below that bar, the feature stays cut.

This discipline is hard. Founders revert it constantly. The pattern: write it down here as cut, refer back when tempted, only revisit on real customer pull.
