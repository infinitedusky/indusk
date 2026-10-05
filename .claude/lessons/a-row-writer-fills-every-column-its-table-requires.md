# A row writer fills every column its table requires — a row appended later is validated like any other

When a promise breaks, the plan that owns it is reopened: a Maintenance phase and a test row are appended to its impl. The writer filled five cells — id, assertion, the two phases, the state — whatever the table had. test-kinds then made an impl refuse a row with no kind. A plan requiring kinds, reopened by an incident, got a row with an empty cell, and the hook refused that impl's next edit: the plan the incident sent back to work could not be worked.

Why it matters: nothing failed when the rule was added. The writer and the rule lived in different plans, the reopen test ran against three impls that did not require kinds, and the gap only showed in a dry run. A table gains required columns over time; a writer that knows a fixed set falls behind silently.

What to do: a function that appends a row takes the cells for the table's other columns and fills every header the table has; its caller says what they are (here the smallest level, and the promise that broke). When a rule makes a column required, grep for every writer of that table. Guarded by `apps/indusk-mcp/src/__tests__/reopen-row-complete.test.ts` (planner-promises A13), which reopens a copy of an impl that requires the column and runs the real validator on it.
