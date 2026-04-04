---
title: "InDusk as Product — Development Platform Thesis"
date: 2026-04-05
status: in-progress
---

# InDusk as Product — Research

## Thesis

AI development quality improves on three axes:
1. **Better models** — out of our control, improves for everyone equally
2. **Better context** — what we're building with context-graph (CGC + Graphiti)
3. **Better process** — what indusk already does: plan/work/verify gates, lessons, hooks, extensions

Axes 2 and 3 are the product opportunity. Models commoditize — everyone gets the same GPT-5 or Claude 5. **Context + Process is the moat.**

**Context** — nobody is combining structural code graphs (CGC) with temporal knowledge graphs (Graphiti) to create a two-dimensional understanding of a codebase. The context beam — querying what you *know* about a file and what *structurally connects* to it — doesn't exist anywhere else. With investment, both CGC and Graphiti can be taken far beyond where they are today. The beam concept scales to something like "the AI always knows exactly where to look and what matters."

**Process** — it's the thing that makes AI output trustworthy at scale, and the thing humans can't do manually as AI speed increases. You can't review 100 PRs a day. But you can enforce that every PR went through plan → verify → document gates before it reaches you.

Together: context tells the agent *what matters*, process ensures the agent *does it right*. Neither alone is sufficient. Both together is a development system nobody else has.

## The Linchpin Argument

The deployment tool is currently eating the world. Vercel's playbook:
- Start with one thing (hosting/deployment)
- Add tooling around it (analytics, edge functions, feature flags, KV, cron, AI)
- Each addition makes the platform more indispensable — "code as a platform"
- LaunchDarkly can be replaced because Vercel is closer to execution

Vercel started at deployment and moved **up** toward development. InDusk starts at development and moves **down** toward deployment. Same playbook, earlier starting point.

**Why earlier is stickier**: By the time code reaches deployment, it's already been shaped by your process, your context graph, your quality gates. Vercel had to *add* AI understanding of your codebase after the fact. InDusk *starts* with it — it knows your architecture, your decisions, your gotchas, your team's patterns.

**The lock-in sequence**:
1. **Dev tool** (now) — `indusk init`, process enforcement, context beam
2. **Add hosting** — `indusk deploy`. You already know the project structure, env vars, Docker config (composable.env)
3. **Add monitoring** — OTel already scaffolded, just own the backend instead of sending to Dash0
4. **Add team** — multi-agent orchestration, human review gates, knowledge sharing
5. **Add feature management** — flags, A/B testing, rollbacks

Each step is natural because you already have the data from the step before. The development tool is the earliest linchpin — everything downstream depends on it.

WindSurf, Cursor, etc. compete on code generation speed. InDusk competes on **code trustworthiness** — the gap between "AI wrote this" and "this is production-ready." Speed is table stakes. Trust is the product.

## Framework Independence

When the deployment platform is the linchpin, it creates framework lock-in. You use Next.js because Vercel makes it easy, not because your app needs server-side rendering. A single-page app doesn't need Next.js — but you use it anyway because the platform rewards it.

When the development tool is the linchpin, frameworks become interchangeable. The AI understands what you're building and picks (or generates) the right infrastructure shape:

- SPA with no server needs? Plain React + static hosting.
- Need SSR for SEO on 3 pages? Lightweight server for those, static for the rest.
- Real-time multiplayer? Custom WebSocket server, no framework overhead.
- Mobile app? Expo with the right native modules, not a web wrapper.

**The end state**: you describe what you're building, the AI creates the optimal architecture — not the one that fits a framework's opinions. "Hyper-specific infrastructure shapes" that are exactly right for the problem, because the development tool has the context to make that decision.

This only works if the development tool owns the process end-to-end. If deployment is someone else's platform, you're constrained to their supported shapes. If InDusk owns development *and* deployment, the architecture can be whatever's best.

## Monorepos as AI Infrastructure

Monorepo tooling (Turborepo, Nx, pnpm workspaces) is functional but not great. Dev environments are painful — Docker, env vars, service orchestration (composable.env exists because this problem isn't solved).

In an AI world, **monorepos become critical** because:
- The agent needs to see everything. Separate repos mean the agent loses context at repo boundaries. The code graph fragments. The knowledge graph can't connect a frontend decision to a backend constraint.
- AI agents work across the full stack naturally — they don't specialize in "frontend" or "backend." Monorepos match how agents think.
- Shared types, contracts, and libraries are first-class in a monorepo. AI can enforce consistency across packages because it sees them all.
- The context beam works best with everything in one graph. Cross-repo beaming is possible but lossy.

**The opportunity**: monorepo DX is an unsolved problem that InDusk is already partially solving (composable.env, CGC indexing, Turborepo orchestration). Making monorepo development actually good — with AI-native tooling — is a product differentiator nobody else is pursuing.

## What InDusk Already Has (Foundation)

| Layer | What exists | Product value |
|-------|------------|---------------|
| Process | Plan/work/verify/document/retrospective lifecycle | Structured AI development that produces auditable artifacts |
| Knowledge | Graphiti temporal graph + CGC structural graph | Project memory that persists across sessions and agents |
| Quality | Biome rules, hooks, gate enforcement | Automated quality ratchet — gets tighter, never loosens |
| Observability | OTel scaffolding, Dash0 integration | Every project observable from day one |
| Extensions | Plugin system for tools (CGC, Storybook, Framer, etc.) | Composable developer toolkit |
| Environment | composable.env for Docker-based local dev | Reproducible environments |
| CLI | `indusk init/update/infra` | One-command project setup |

## Expansion Directions to Research

### 1. Hosting (Build → Test → Deploy in one place)

**Idea**: You build with InDusk, tests pass through the verify gate, deployment is the natural next step. No context switching to Vercel/AWS/Fly.

**How it could work**:
- `indusk deploy` after verify gates pass
- Docker images already built via composable.env
- Push to a managed container registry + orchestrator
- Environment variables already managed (composable.env profiles: local → staging → production)
- OTel already configured — observability works immediately in production

**Questions**:
- Build vs buy? Run our own infrastructure or wrap Fly.io/Railway/Render?
- What's the minimum viable hosting? Static sites? Containers? Serverless?
- Does hosting need to be ours, or is the value in the deployment pipeline being InDusk-managed?
- Revenue model: usage-based like Vercel, or flat rate?

**Competitive landscape**:
- Vercel: owns Next.js + hosting + now feature flags, analytics
- Railway/Render: simpler container hosting, no dev tooling
- Fly.io: edge containers, no dev process
- Replit: IDE + hosting but weak on process/quality
- None of them own the development process upstream

### 2. GUI Layer (Beyond the IDE)

**Idea**: The IDE is a text editor with plugins. AI development doesn't need a text editor — it needs a process dashboard. What if the interface showed:

- Current plan phase and progress
- Active context beam (what the agent knows about the file you're looking at)
- Quality gates status (green/red for each phase)
- Knowledge graph visualization (entities, relationships, temporal changes)
- Agent activity log (what it did, what it changed, why)
- Team view (who's working on what, what agents are running)

**How it could work**:
- Web app or Electron (not a VS Code extension — that's someone else's platform)
- Terminal/agent runs in background, GUI shows status and allows intervention
- Monaco editor for when you do need to see/edit code
- But the primary interface is the process, not the code

**Questions**:
- Is this the mcp-dashboard plan evolved?
- Desktop app vs web app vs both?
- How much does it replace the IDE vs complement it?
- Do developers actually want to not see code, or is that a bridge too far?

### 3. Team/Project Management (Asana Where Agents Orchestrate)

**Idea**: Plans, phases, and work items are already structured data. Add:
- Multiple agents working on different plan phases simultaneously
- Human review gates (approve agent's PR before merge)
- Sprint/milestone tracking built on plan lifecycle
- Automatic status updates from agent work sessions
- Cross-agent knowledge sharing via Graphiti

**How it could work**:
- Plans already have stages, dependencies, and blockers
- Handoffs already capture session state
- Graphiti already captures knowledge across sessions
- Add: multi-agent orchestration, human approval gates, timeline views
- Linear/Jira replacement where the agents are first-class participants, not just assignees

**Questions**:
- How many agents can work on one codebase simultaneously?
- What's the human's role — reviewer? Director? Both?
- How do you prevent agents from stepping on each other? (git worktrees? branch-per-agent?)
- Revenue model: per-seat (humans) or per-agent-hour?

### 4. Knowledge as a Service

**Idea**: The context graph (Graphiti + CGC) is valuable beyond one project. What if:
- Onboarding a new developer = giving them access to the knowledge graph
- "Why does this code do X?" is answered by querying the graph, not asking a senior dev
- Architecture decisions are discoverable, not buried in Confluence
- Cross-project patterns emerge from shared graph data

**This is already partially built** — it's the context-graph plan. The product angle is making it accessible to non-CLI users.

## Product Definition

**InDusk is an application build environment for professionals in an AI future.**

Not an IDE. Not a hosting platform. Not a project manager. It's the build environment — the system that sits between "I want to build this" and "this is running in production." For professional developers and teams who use AI agents as their primary builders.

The three pillars:

1. **Monorepo DevEx** — The application lives in a monorepo because AI agents need full visibility. InDusk makes monorepo development actually work: environment management (composable.env), service orchestration, cross-package consistency, Docker-based local dev that doesn't suck.

2. **Context Management** — Two-dimensional understanding of the codebase. Structural (CGC: what calls what, what imports what) + temporal/semantic (Graphiti: what we know, what we decided, what broke). The context beam delivers exactly the right knowledge to the agent at the right time. This is what makes AI output good instead of generic.

3. **Process** — Plan/work/verify/document lifecycle with hook-enforced gates. Quality ratchet that only gets tighter. Lessons learned that persist across sessions. Retrospectives that feed back into the system. This is what makes AI output trustworthy instead of just fast.

These three together are why someone uses InDusk instead of Cursor + Vercel + Linear. Those tools optimize individual steps. InDusk optimizes the system.

## What's the Best First Step?

**Monorepo DevEx** is the wedge — it's the most tangible pain point, already partially solved (composable.env, CGC, Turborepo integration), and naturally leads to the other pillars. Nobody wakes up wanting "better AI process." But plenty of teams are drowning in monorepo complexity.

The progression:
1. **Monorepo DevEx** — "Your monorepo actually works now." Environment management, service orchestration, cross-package tooling. Entry point.
2. **Context** — "Your agents know your codebase." CGC + Graphiti + context beam. Differentiator.
3. **Process** — "Your agents produce production-ready code." Gates, verification, quality ratchet. Moat.
4. **Hosting** — "Deploy from the same system that built it." Natural extension once you own the build.
5. **Team** — "Multiple agents, one coherent system." Multi-agent orchestration with human oversight.

Other expansion options:

## Long-term Vision: Development Merges into Business Operations

Historically, development and business operations were hard-separated because coding was hard. Developers were specialists, siloed from day-to-day operations. The boundary existed because the skill was rare and the work was slow.

AI removes that boundary. When building software is fast and accessible, it becomes an operational activity — not a specialized one. Internal tooling gets built alongside the product. Business processes get automated as they're defined. Capital formation, compliance, reporting — all become things the system can build and maintain.

**Capacitor** as the name for this: a system that takes you from nothing to deployment to operations to capital formation. It stores organizational knowledge (context graph), enforces quality (process), and releases capability on demand.

The progression:
1. **Build environment** — monorepo DevEx, context, process (now)
2. **Deployment** — hosting, monitoring, feature management
3. **Team** — multi-agent orchestration, human oversight
4. **Operations** — internal tooling, workflows, automation built in the same system
5. **Business platform** — dev and ops merge. The same system that builds your product manages your business operations. The boundary between "software team" and "business team" dissolves because the platform handles both.

Step 5 is long-term. But every step before it is independently valuable and leads naturally to the next.

## Revenue Model Thoughts

- **Free tier**: CLI tools, process enforcement, single-agent — what exists today
- **Pro tier**: GUI dashboard, knowledge graph visualization, hosting
- **Team tier**: Multi-agent orchestration, human review gates, team views
- **Enterprise**: Self-hosted, SSO, audit logs, compliance

## Open Questions

- Who is the customer? Solo developers? Startups? Enterprise teams?
- Is the product the CLI (developer tool) or the platform (SaaS)?
- How does this relate to Anthropic's own Claude Code direction? Are we building on a platform that could subsume us?
- What's the timeline to something people would pay for?
- Should we focus on one vertical (e.g., blockchain development with Numero as the showcase) or go horizontal?

## Next Steps

- Pick one direction to prototype
- Build a landing page / pitch deck to test the thesis with real developers
- Talk to 5-10 developers about their AI development pain points
- Decide: open source the process layer (growth) or keep it proprietary (moat)?
