# `indusk new-project`

Start a project as a conversation. The conversation is a **draft** held under
the InDusk home, outside every checkout; nothing is made on disk, in a
registry or off the machine until a person accepts the agent's proposal. The
admin's New project page calls these same commands through the package.

```bash
indusk new-project start --message "A parental control system" --document brief.md
# → 5k2x9f1a-3c0e7b   (the conversation's id)
indusk new-project add 5k2x9f1a-3c0e7b brief.md     # a newer version of a document
indusk new-project parent ~/code/sandbox            # where new projects may be made
indusk new-project discard 5k2x9f1a-3c0e7b
```

## Where a draft lives

`<INDUSK_HOME>/new-projects/<id>/` (`~/.indusk` unless `INDUSK_HOME` is set):

| File | Held by |
|------|---------|
| `draft.json` | `start`: the id, when it began, and the first message |
| `documents/` | `start --document` and `add`: the person's documents, byte for byte |
| `brief.md`, `research.md` | the agent, as the conversation settles |
| `proposal.json` | the agent, once why, what, how and where, name and place are settled |

A draft is the only thing a conversation writes. Abandoned, it leaves nothing
under the parent directory and registers no project.

## `start`

```bash
indusk new-project start --message <text> [--document <file>]...
```

Opens a conversation holding what the person said first and any documents they
brought, and prints its id. `--message` is required; `--document` may be given
more than once, and a name given twice keeps the later file.

## `add`

```bash
indusk new-project add <id> <file>
```

Puts a document in the conversation. A name the conversation already holds
keeps the **newer** bytes and prints what changed between the two as a unified
diff, so the agent can be told what moved and work from the new version. The
older bytes are not kept. A file that is not text reports that it differs.

## `discard`

```bash
indusk new-project discard <id>
```

Removes the conversation's folder and everything it held. Quiet when the
conversation is already gone.

## `accept`

```bash
indusk new-project accept <id>
```

Checks the conversation's `proposal.json` and refuses one that is not valid,
naming every problem: a name that is not a folder name, a relative location, no
repository, a declined recommendation with no reason, a `documentsOff` naming
the brief or the test plan, or one that names no planning document. Nothing is
made for a refused proposal. Making the project follows the check in a later
phase of the new-project-flow plan.

## `parent`

```bash
indusk new-project parent [dir]
```

Sets the one directory new projects may be made in (made if it is not there);
with no argument, prints it, and exits non-zero when none is set. The setting
is kept in `<INDUSK_HOME>/new-projects.json`, not in the admin daemon's own
`admin-ui.json`, which the daemon overwrites when it starts and removes when it
stops.

## See also

- [`indusk worktree`](/reference/cli/worktree) and [`indusk workbench`](/reference/cli/workbench) — the layout a created project has.
