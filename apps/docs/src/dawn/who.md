# Who Dawn is for

This document names the user, the buyer, and the design partner. Each is different. The user uses the product daily. The buyer signs the contract. The design partner is the specific person who validates Dawn-MVP through real engagement work in the next 8-12 weeks.

## Personas

### Persona 1 — Forward-deployed engineer (the user)

**Profile.** A senior engineer at an AI-native consultancy or an internal platform team. Drops into an unfamiliar codebase. Has 4-12 weeks to deliver something meaningful. Goes deep on one client, then rotates.

**Tools they use.** Their preferred agent CLI (Claude Code, Cursor, Codex, Aider — opinionated, varies by engineer). Git/jj. Whatever the client's stack happens to be. Slack and a notes app for ad-hoc context.

**Day-1 pain.** "I don't know what I don't know about this codebase. I'm asking the team's engineers questions that are in their head and not written down. I'm reading PRs to reconstruct architectural intent. I'm guessing at conventions and getting them wrong. I'm shipping nothing meaningful for the first week."

**Day-N pain.** "The work I did is going to leave with me. The next person on this engagement will repeat my onboarding. My investment in understanding this codebase is throwaway."

**What they pay for** (if they're independent contractors): faster ramp, faster delivery, demonstrable value to the client.

**What their employer pays for** (if they're at a consultancy): higher utilization, faster engagement turnover, ability to staff junior engineers on senior-engineer engagements via the wrapper's amplification.

### Persona 2 — Engineering manager / consulting partner (the buyer)

**Profile.** Runs the engagement or the team. Cares about cycle time, utilization, quality, and engineer leverage. Pays the bill if Dawn is a paid product.

**Pain.** "My engineers ramp slowly. I can't bill for ramp time at full rate. I lose institutional knowledge every rotation. I can't safely staff a junior on a complex client engagement because the ramp risk is too high."

**What they pay for.** A measurable reduction in time-to-first-meaningful-PR. A team-multiplicative compounding effect (two engineers > sum of two engineers). A defensible record of decisions and progress they can show the client.

### Persona 3 — Internal platform team lead (an adjacent buyer)

**Profile.** Runs the platform / DevX team at a F500 or scale-up. Supports many internal product teams.

**Pain.** "Every internal team reinvents context. New hires take a month to ramp. We have institutional knowledge but it's locked in individual heads. When senior engineers rotate to new teams, productivity craters."

**What they pay for.** Org-wide visibility, durable knowledge across rotations, faster internal mobility.

> _Decision needed: do we treat Persona 3 as a v1 buyer or defer to v2? FDE consultancies are a tighter, faster-moving market. Internal platform teams have bigger budgets but much longer sales cycles._

## The design partner

> **TODO — name them.**

The design partner is one specific person at one specific company, committed to running Dawn-MVP on a real engagement in the next 8-12 weeks. We measure the 5x-on-day-1 promise against their experience. Without a named design partner, the MVP definition is hypothetical and the success metric is unfalsifiable.

Candidate criteria:
- Currently running an FDE-shaped engagement (consultancy or platform team)
- Has explicit pain with the day-1 onboarding problem
- Willing to be a design partner, not just a free user — i.e., gives weekly feedback, shares their actual onboarding session timing, lets us watch over their shoulder
- Codebase shape is realistic (TypeScript/Python/Go monorepo, real complexity, real institutional knowledge gap)

Anti-candidates:
- Solo developer working on their own project (not the wedge)
- Greenfield project with no institutional context (Dawn's value is context-restoration; greenfield has no context to restore)
- "We'll try it eventually" — design partner means committed in the next 4 weeks

## Buyer vs user — pricing implication

If the user is the FDE and the buyer is the consulting partner / EM, pricing is per-seat (per FDE) with seat counts in the 10-50 range per consultancy. If the user is the FDE and they're independent, pricing is solo-developer-shaped (per-seat at much lower price points). If the buyer is the F500 platform team, pricing is enterprise-shaped (annual contract, RBAC + SSO + procurement).

> _Decision needed: which pricing shape do we anchor to for v1? This is upstream of the architecture in two places — auth model (single-tenant local vs hosted multi-user) and packaging (CLI install vs hosted service)._

## Ourselves as users

Sandy is a user. Driving Indusk-mcp on this dusk monorepo is the closest analog we have to the FDE experience right now. The Avoca engagement (mentioned in [`research-fde-and-extraction.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/research-fde-and-extraction.md)) is the explicit FDE testbed.

Self-use is necessary but not sufficient. The design partner is required because our own usage doesn't surface the friction a cold engineer would hit. We are too steeped in the system to feel the day-1 problem honestly.
