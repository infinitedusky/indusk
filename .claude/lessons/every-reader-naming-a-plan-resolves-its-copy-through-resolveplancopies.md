# Every reader that names a plan must resolve its copy through resolvePlanCopies — a second walk of assignments gives one plan two names, and the nav and the Promises page disagree

A plan lives in two copies (the worktree's and the trunk's). In plan-stories the nav read the worktree copy while readHealthNames read the trunk's, so the same plan showed different names on the Promises page and in the nav. Any new reader that needs a plan's title, name or document must take it from the package's one resolver (resolvePlanCopies), never from its own walk over assignments or paths. When adding a reader, grep for the other readers of the same value and check they share the resolver.

Source: retro-lesson highlight h-20261015-008 (plan-stories).
