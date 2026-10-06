# A falsification hypothesis about a tool you don't own gets checked against the real tool before you fix anything — your assumption about its behavior may just be wrong

admin-plan-authoring's A36 assumed a project's Claude Code allow rule lets a headless planning session write unasked. Against the real CLI, an untrusted folder's allow rule was not honoured and the write was asked about anyway — the assumption was wrong, not the code. Sandy's call: drop A36 rather than "fix" it, since honoring an allow rule is the developer's explicit choice and the CLI's actual behavior (ask anyway in an untrusted folder) is the safer default, not a bug.

When a falsification hypothesis rests on how an external tool (a CLI, an API, a library) behaves, run the real tool before writing a fix — don't patch your code to match a belief about someone else's.
