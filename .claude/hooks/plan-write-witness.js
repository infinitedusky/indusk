#!/usr/bin/env node
/**
 * PostToolUse hook (Bash): records what the plan folders hold after a shell
 * command, beside the decision `plan-write-guard.js` recorded before it.
 * clause: a-plan-document-is-written-through-its-checks/shell-write-refused
 *
 * Refuses nothing and says nothing; always exits 0. The recording itself is
 * added with the guard's decision file (`_clause-verdicts.js`).
 */
process.exit(0);
