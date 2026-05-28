# Walkthrough: Building a Feature from Start to Finish

This walkthrough shows what it looks like to use InDusk from start to finish. You tell Claude what you want to build, and the system guides both you and the agent through a structured process. You don't need to be a developer — you just need to know what you want.

## The Scenario

You want to add a contact form to your portfolio site. Users should be able to send you a message with their name, email, and a note.

## Step 1: Tell Claude to Plan It

You type:

```
/plan contact-form
```

### The Discovery Conversation

Claude doesn't immediately start building or even researching. First, it does a quick scan of your project to understand the context — what tech stack you're using, how your site is structured, what patterns exist. Then it **asks you questions**:

> "I can see you have a Next.js portfolio site with a few pages. Before I start researching the best approach for a contact form, I want to make sure I understand what you're looking for:
>
> 1. What should happen when someone submits the form — do you want to receive an email, store it in a database, or both?
> 2. Do you need any specific fields beyond the basics (name, email, message)?
> 3. Are there any services you already use or prefer for email (like Resend, SendGrid, etc.)?"

You answer in plain English: "Just email is fine. Name, email, and message. I don't have any email service set up yet."

This conversation matters — especially if you're not a developer. Claude is figuring out not just what to build, but what you actually care about. It might ask follow-up questions: "Do you want spam protection like a CAPTCHA, or is that overkill for now?"

### Research

Once Claude understands your intent, it starts **research** — reading your codebase, checking what frameworks you use, looking for existing patterns, searching for the best libraries, and querying the code graph to understand your project structure.

It creates `planning/contact-form/research.md` — a document summarizing what it found: your tech stack, available email services, similar implementations, and what can be reused from your existing code.

### The Brief

Next, Claude writes a **brief** — a short document proposing what will be built. But it doesn't just hand it to you and ask "does this look good?" It walks you through it:

> "Here's what I'm proposing we build. Let me walk you through it:
>
> **What we're building:** A contact form page at `/contact` with three fields — name, email, and message. When someone submits it, you get an email with their message.
>
> **How it works:** I'm suggesting we use Resend for email delivery — it's free for up to 100 emails/day and simple to set up. The form will validate that all fields are filled in and that the email looks valid before sending.
>
> **What you'll see:** A styled form matching your site's dark theme with amber accents, a loading state while sending, and a success message after.
>
> Does this match what you had in mind? Is there anything missing, or anything here you don't want?"

You might say: "That sounds right, but can we add a subject line field too?" Claude updates the brief, and you go back and forth until you're genuinely happy with the direction. Then Claude marks it as `accepted`.

### The ADR

For a feature like this, Claude writes an **Architecture Decision Record** (ADR) — a short document explaining the technical approach it plans to take. This isn't code — it's a plain-English explanation of the strategy:

> **Decision:** Use a server action for form submission with Resend for email delivery.
>
> **Why:** Server actions keep the logic server-side without needing a separate API route. Resend has a generous free tier and a clean API.
>
> **Alternatives considered:** ContactForm API service (overkill for one form), mailto link (poor UX, no validation)

Again, you review and approve. You don't need to understand the technical details deeply — the ADR explains the tradeoffs in terms of what matters (cost, complexity, reliability).

## Step 2: Tell Claude to Build It

Once the plan is approved, you type:

```
/work contact-form
```

Claude reads the entire plan — the research, brief, and ADR — and then works through a structured checklist it created during planning. The checklist is organized into **phases**, and each phase has four gates that must be cleared before moving on.

### What the Phases Look Like

**Phase 1** might be: "Build the form component and page"

Claude works through it item by item:

1. **Before touching any file**, it checks the code graph to understand what else depends on that file — this prevents accidentally breaking something
2. It creates the form component, adds the page route, styles it
3. After each item, it checks it off the list so you can see progress

Once the code is written, the **gates** kick in:

| Gate | What Happens |
|------|-------------|
| **Verify** | Claude runs automated checks — does the code compile? Does the linter pass? Do existing tests still work? |
| **Context** | Claude updates the project memory (CLAUDE.md) so future sessions know this feature exists |
| **Document** | Claude writes or updates any relevant documentation |

Only after all gates pass does Claude move to the next phase.

**Phase 2** might be: "Add email sending and form validation"

Same process — build, verify, update context, update docs. Each phase builds on the last.

### What You See During Work

You'll see Claude:
- Writing code and checking items off the list
- Running verification commands and reporting results
- Occasionally asking you questions: "The email service needs an API key — do you have a Resend account, or should I set one up?"
- Flagging risks: "This file is imported by 5 other components — the change looks safe, but I wanted you to know"

If something fails — a test breaks, the linter catches an issue — Claude fixes it before moving on. It doesn't skip ahead or leave broken things behind.

## Step 3: The Retrospective

After all phases are complete, Claude runs a **retrospective** — a structured audit of everything that was built:

1. **Code audit** — checks for dead code, overly complex functions, structural issues
2. **Documentation audit** — are the docs up to date with what was built?
3. **Test audit** — is the new code covered by tests?
4. **Quality check** — could any mistakes from this work be caught automatically in the future? If so, Claude adds a linting rule so the same mistake can't happen twice

This is the **quality ratchet** — every project gets a little better after each feature. Rules only get tighter, never looser.

### Knowledge Handoff

The retrospective also captures **lessons learned** — patterns that worked well, surprises, things to remember for next time. These get stored so that in your next session, Claude reads them first and avoids repeating past mistakes.

## What Makes This Different

### For Non-Developers

- **You never have to write code.** You describe what you want, review plans in plain English, and approve or request changes.
- **You always know what's happening.** The plan/work/verify cycle gives you visibility at every step. You're not waiting for a black box to produce something.
- **Quality is built in.** Automated checks run at every phase. The agent can't skip verification or ship broken code without you knowing.
- **Your project gets smarter over time.** Lessons, context, and quality rules accumulate. The 10th feature you build will go smoother than the first.

### For Developers

- **Structure without bureaucracy.** The planning lifecycle adds just enough process to prevent the "I'll just start coding" trap without turning into JIRA.
- **The agent checks its own work.** Verification gates mean you're not manually reviewing every line — the system catches type errors, lint violations, and test failures automatically.
- **Context survives between sessions.** CLAUDE.md means the agent doesn't start from zero every time. It knows your architecture, conventions, and past decisions.
- **Code graph prevents breakage.** Before modifying any file, the agent checks what depends on it. No more "I changed a utility function and broke 12 components."

## Quick Reference: The Commands

| What You Want | What You Type | What Happens |
|---------------|---------------|--------------|
| Plan a new feature | `/plan feature-name` | Creates planning docs, starts research |
| Plan a bug fix | `/plan bugfix issue-name` | Streamlined plan — brief + implementation only |
| Plan a refactor | `/plan refactor target-name` | Plan with boundary mapping for safe restructuring |
| Explore an idea | `/plan spike idea-name` | Research only — no commitment to build |
| Start building | `/work plan-name` | Executes the implementation checklist |
| Check project health | Run `check_health` | Verifies all tools and services are connected |
| See all plans | Run `list_plans` | Shows every plan with its current stage |

## What's Happening Behind the Scenes

You don't need to know this to use the system, but if you're curious:

- **20 MCP tools** power the system — they manage plans, check code quality, maintain project memory, query the code graph, and track lessons
- **Two hooks** enforce the gate system — one prevents skipping gates, another reminds the agent to advance when a phase is complete
- **8 community lessons** are pre-installed — proven patterns like "always check for existing packages before building custom" and "run checks before committing"
- **Domain skills** provide technology-specific guidance — if your project uses React, TypeScript, or Docker, the agent gets specialized knowledge for those tools
- **The code graph** maps every file's dependencies so the agent understands your project's structure before making changes

For the full technical reference, see the [Reference](/reference/) section.
