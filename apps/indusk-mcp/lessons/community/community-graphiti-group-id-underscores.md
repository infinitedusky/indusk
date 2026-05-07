# Use underscore-form group IDs when querying Graphiti — and always pass `group_ids` explicitly

Graphiti episodes are partitioned by `group_id`. Two failure modes are silent and look identical to "the graph has nothing":

1. **Hyphens in `group_id` hit a RediSearch syntax error.** A query like `mcp__graphiti__search_nodes({ query: "...", group_ids: ["dawn-fde-toolkit"] })` triggers a RediSearch tokenizer error; the lib catches it and returns empty. The agent concludes "no episodes." Fix: use the underscore form (`dawn_fde_toolkit`). InDusk's `getProjectGroupId(projectRoot)` helper sanitizes hyphen → underscore on writes; **the same convention applies on reads** — the bytes the writer used are the bytes the reader must use.

2. **Omitting `group_ids` doesn't scan all groups — it returns empty.** Falling back to `mcp__graphiti__search_nodes({ query: "..." })` (no filter) silently produces nothing. Always pass `group_ids: [<project-group>, "shared"]` explicitly.

The bug is silent both directions: a malformed group_id and a missing group_id both look like "graph empty." If you're querying Graphiti and getting nothing, the first check is the group_id form, not "is Graphiti down."

**Discovering your project's group**: call `mcp__indusk__get_project_info` and use `.project_group`. Don't try to derive it from the project basename — InDusk applies sanitization rules (lowercase, hyphen → underscore, hyphens around digits) that the basename doesn't match.

**Two minimum query shapes**:

```js
// Recall from project + cross-project shared knowledge
mcp__graphiti__search_nodes({
  query: "...",
  group_ids: [project_group, "shared"],
  max_nodes: 8,
});

// Just one group
mcp__graphiti__search_memory_facts({
  query: "...",
  group_ids: [project_group],
  max_facts: 5,
});
```

If you ever see empty results from Graphiti and you "thought you wrote there earlier," the answer 95% of the time is wrong group_id form, not data loss.
