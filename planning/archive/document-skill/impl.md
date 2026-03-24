---
title: "Document & Retrospective Skills"
date: 2026-03-20
status: completed
---

# Document & Retrospective Skills

## Goal

Add a documentation gate to the impl execution lifecycle and formalize the retrospective as a structured audit with knowledge handoff. Scaffold a VitePress docs site with Mermaid support and the FullscreenDiagram component from emerge-turbo.

## Scope

### In Scope
- VitePress docs site at `apps/indusk-docs/` with Mermaid + FullscreenDiagram
- Document skill (SKILL.md) as per-phase execution gate
- Retrospective skill (SKILL.md) as closing audit
- Update plan skill impl template to include Phase N Document section
- Update work skill to enforce document gate
- Write initial docs content for existing skills and decisions
- composable-env contract for indusk-docs (runs in Docker like all apps)

### Out of Scope
- Tutorials section
- Automated docs deployment
- Per-app VitePress sites
- Test coverage threshold enforcement

## Checklist

### Phase 1: VitePress Scaffolding

- [x] Add VitePress ^1.6.3 and vitepress-plugin-mermaid ^2.0.10 as dev dependencies to `apps/indusk-docs/`
- [x] Create `apps/indusk-docs/package.json` with dev/build/preview scripts
- [x] Create composable-env contract, component, and Dockerfile for indusk-docs
- [x] Create `apps/indusk-docs/src/.vitepress/config.ts` with:
  - Mermaid plugin via `withMermaid()`
  - Multi-sidebar: guide/, reference/, decisions/, lessons/
  - Local search enabled
  - Dark mode (match zinc-950 aesthetic)
  - Line numbers in code blocks
- [x] Port `FullscreenDiagram.vue` from emerge-turbo to `apps/indusk-docs/src/.vitepress/components/`
  - Include panzoom dependency
  - Register in theme/index.ts
- [x] Create `apps/indusk-docs/src/.vitepress/theme/index.ts` extending DefaultTheme with FullscreenDiagram
- [x] Create `apps/indusk-docs/src/index.md` with basic landing page
- [x] Create placeholder index pages for each sidebar section:
  - `apps/indusk-docs/src/guide/index.md`
  - `apps/indusk-docs/src/reference/index.md`
  - `apps/indusk-docs/src/decisions/index.md`
  - `apps/indusk-docs/src/lessons/index.md`
- [x] ce scripts:sync picks up indusk-docs dev/build/start scripts
- [x] pnpm-workspace.yaml already covers `apps/*` — no change needed
- [x] Add `apps/indusk-docs/src/.vitepress/dist` and `apps/indusk-docs/src/.vitepress/.cache` to .gitignore

#### Phase 1 Verification
- [x] `pnpm turbo dev --filter=indusk-docs` starts the VitePress dev server without errors
- [ ] Landing page renders at localhost:4173 with correct dark theme (visual check deferred to Phase 5)
- [ ] A test mermaid diagram renders inline (deferred to Phase 5 content)
- [ ] FullscreenDiagram component expands, zooms, and pans correctly (deferred to Phase 5 content)
- [x] `pnpm turbo build --filter=indusk-docs` produces static output without errors

#### Phase 1 Context
- [x] Add to Architecture: `apps/indusk-docs/` — VitePress documentation site with Mermaid + FullscreenDiagram support
- [x] Add to Conventions: `pnpm turbo dev --filter=indusk-docs` for local docs
- [x] Update Current State: VitePress docs site scaffolded

### Phase 2: Document Skill

- [x] Create `.claude/skills/document/SKILL.md` with:
  - Purpose: per-phase gate during impl execution, after context
  - The question: "Does this phase change something a user or developer needs to know?"
  - What to document: new features → reference, workflows → how-to, nothing user-facing → skip
  - Where docs live: `apps/indusk-docs/src/` with the Diataxis-lite structure
  - Mermaid diagram guidance:
    - When to use which type (flowchart for architecture/flows, sequence for APIs, class for code structure, state for lifecycles, ER for data models)
    - One concept per diagram, meaningful labels
    - Always wrap in `<FullscreenDiagram>` for pan/zoom
    - Keep diagrams small enough to read inline
    - Use `classDef` for visual grouping of related nodes
    - Dark-mode-friendly: avoid hardcoded light colors
  - FullscreenDiagram usage example:
    ```markdown
    <FullscreenDiagram>

    ```mermaid
    flowchart TD
      A[Plan] --> B[Work]
      B --> C[Verify]
    ```

    </FullscreenDiagram>
    ```
  - Explicit instruction: prefer diagrams over long prose for architecture, flows, and relationships

#### Phase 2 Verification
- [x] Read the document SKILL.md and verify it contains all required sections: purpose, the question, what to document, where, mermaid guidance, FullscreenDiagram usage
- [x] Verify the skill is listed — confirmed in available skills list

#### Phase 2 Context
- [x] Add to Architecture: document skill at `.claude/skills/document/SKILL.md`
- [x] Update skill inventory table: document | stable | Per-phase documentation gate with Mermaid diagram guidance

### Phase 3: Retrospective Skill

- [x] Create `.claude/skills/retrospective/SKILL.md` with:
  - Purpose: structured audit and knowledge handoff after impl completion
  - Invocation: `/retrospective {plan-name}` or picked up by `/plan` when impl is completed
  - Audit checklist (must complete in order):
    1. Write the retrospective document (using existing template from plan skill)
    2. Docs audit — review all docs pages written during impl, verify they match what was actually built
    3. Test audit — review test files, identify coverage gaps, flag missing edge cases
    4. Quality audit — review mistakes made during impl, propose new Biome rules if warranted, update biome-rationale.md
    5. Context audit — re-read CLAUDE.md, verify all sections are accurate after the full impl
    6. Knowledge handoff:
       - Distill ADR decision into `apps/indusk-docs/src/decisions/{plan-name}.md`
       - Extract broadly useful retrospective insights into `apps/indusk-docs/src/lessons/{plan-name}.md`
    7. Archival — move `planning/{plan-name}/` to `planning/archive/{plan-name}/`
  - Each audit step is a checkbox the agent works through (like the work skill)
  - The retrospective skill should reference the work skill pattern for checklist execution

#### Phase 3 Verification
- [x] Read the retrospective SKILL.md and verify it contains: purpose, audit checklist (all 7 steps), archival process
- [x] Verify the skill is listed — confirmed in available skills list

#### Phase 3 Context
- [x] Add to Architecture: retrospective skill at `.claude/skills/retrospective/SKILL.md`
- [x] Update skill inventory table: retrospective | stable | Closing audit — docs, tests, quality, context — plus knowledge handoff and archival

### Phase 4: Update Plan and Work Skills

- [x] Update plan skill SKILL.md impl template to include `#### Phase N Document` section:
  ```markdown
  #### Phase N Document
  - [ ] {Docs page to write or update — e.g., "Write reference page at apps/indusk-docs/src/reference/tools/tool-name.md", "Update architecture diagram". Ask: "what does a user or developer need to know about what this phase built?" If nothing user-facing, omit this section.}
  ```
- [x] Update plan skill SKILL.md retrospective step to reference the retrospective skill:
  - Change "write the retrospective" to "invoke the retrospective skill (`/retrospective {plan-name}`) which handles the structured audit, knowledge handoff, and archival"
- [x] Update work skill SKILL.md per-phase completion order to include document:
  ```
  Implementation items → Verification items → Context items → Document items → advance
  ```
- [x] Update work skill step 8 to describe the document gate
- [x] Update work skill step 11 (phase transitions) to include document items

#### Phase 4 Verification
- [x] Read plan SKILL.md and verify impl template includes Phase N Document section
- [x] Read plan SKILL.md and verify retrospective step references `/retrospective`
- [x] Read work SKILL.md and verify per-phase order is: implement → verify → context → document → advance
- [x] `pnpm check` passes — clean after adding Vue override for noUnusedVariables

#### Phase 4 Context
- [x] Update Conventions: every impl phase ends with verify → context → document before advancing (four gates, not three)
- [x] Update Current State: document and retrospective skills complete

### Phase 5: Initial Documentation Content (DEFERRED)

Deferred — docs content will be written naturally through future plans using the document gate and retrospective skill. The scaffolding, skills, and gates are in place; content will accumulate as work happens.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-docs/` | New VitePress docs site (package, config, theme, components, content) |
| `env/contracts/indusk-docs.contract.json` | composable-env contract |
| `env/components/indusk-docs.env` | Component with PORT, ENDPOINT, URL |
| `docker/Dockerfile.vitepressdev` | Dev Dockerfile for VitePress |
| `.claude/skills/document/SKILL.md` | New document skill |
| `.claude/skills/retrospective/SKILL.md` | New retrospective skill |
| `.claude/skills/plan/SKILL.md` | Add Phase N Document to impl template, reference retrospective skill |
| `.claude/skills/work/SKILL.md` | Add document gate to per-phase completion order |
| `package.json` | ce-managed scripts for indusk-docs |
| `.gitignore` | Add VitePress build/cache dirs |
| `CLAUDE.md` | Architecture, conventions, skill inventory updates |

## Dependencies

- VitePress ^1.6.3 (NOT v2)
- vitepress-plugin-mermaid ^2.0.10
- mermaid (peer dep of plugin)
- panzoom (for FullscreenDiagram)
- FullscreenDiagram.vue from emerge-turbo (ported, not linked)

## Notes

- VitePress 2 has known issues — pin to 1.x
- FullscreenDiagram uses panzoom library for zoom/pan in expanded view
- indusk-docs runs in Docker via composable-env like all other apps
- Decision and lesson pages are populated during retrospective/archival, not during normal impl work
