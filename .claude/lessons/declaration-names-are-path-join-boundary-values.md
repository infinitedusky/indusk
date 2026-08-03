# Frontmatter-declared names used in path joins are a trust boundary — sanitize before join, not after

When a system reads a name from user-editable frontmatter/config (e.g. `parents:`, `subplans:`) and later does `join(baseDir, name, ...)` or renders it raw, that name is untrusted input the moment it crosses the frontmatter → path/render boundary — even in an internal tool with no external attacker, because the same code path executes on any malformed or copy-pasted declaration.

**The concrete case:** `apps/indusk-mcp/src/lib/plan-parser.ts`'s `readPlanDeclarations` joined declared parent/subplan names into `join(planningDir, name, "master.md")` unsanitized. `parents: ["../../../x"]` in a `master.md` frontmatter would read a `master.md` outside the planning directory and render its `subplans:` strings into the sidebar — a real path-traversal reachable purely by editing a YAML list, discovered via the falsification ritual (dusk's `dawn-ui-plan-grouping` plan, Phase 4, T14/T15) rather than at initial authoring time.

**The fix pattern — apply this whenever a new declaration-driven file read is added:**
1. Check whether an existing sanitization precedent already exists in the codebase for this class of input (dusk had one: `readResearchContent`'s `slug.includes("/") || slug.includes("..") || slug.startsWith(".")` guard) — reuse or mirror it rather than reinventing.
2. Guard at the single boundary function all such names pass through (dusk's fix added `isCleanSegment` inside `stringArray`, so `parents`, `roadmap`, and `subplans` are all filtered in one place) — not at each call site, which is easy to miss one of.
3. A name that fails the guard is dropped silently (degrade to structure-loss), never thrown — consistent with the broader "grouping/declarations never hide a plan, but a bad declaration can lose structure" invariant.
4. Also dedupe at the same boundary if the list feeds React keys or a rendered list — duplicate declared names produce duplicate DOM keys, a related but distinct bug class caught by the same fix.

**Why this is worth a standalone lesson:** the vulnerability was introduced across two earlier commits (`42d64395` adding `readPlanDeclarations`, `ff4157fb` wiring it into rendering) without either commit's author checking for the existing `readResearchContent` precedent — it was only caught by a deliberate adversarial falsification pass, not by normal implementation review. The general rule (declared/config-sourced names that reach a path join or raw render are boundary values) generalizes beyond this one plan and this one codebase.
