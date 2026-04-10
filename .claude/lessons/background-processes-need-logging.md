# Background processes need logging from day one

# Background processes need logging from day one

Any system that runs in the background — hooks, spawned agents, detached processes — must write to a log file at every decision point from the first phase, not as a debugging afterthought.

Without logging, a background process that fails looks identical to one that never ran. You can't debug interactively because there's no terminal, no stderr visible, no stack trace. The eval system went through hours of "is it working? I can't tell" before adding system.log.

For InDusk specifically: any hook or spawned process should write to `.indusk/eval/system.log` (or equivalent) with timestamps at: entry, key decisions, spawn points, completion, and errors.
