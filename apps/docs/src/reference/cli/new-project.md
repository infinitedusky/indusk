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
| `creating.json` | `accept`: the steps of a creation and where each stands, while it runs or after it stopped |

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

Makes the project the conversation's `proposal.json` describes, printing each
step as it starts (`...`) and ends (`ok`). The admin's **Create project** calls
the same code and streams the same steps.

Refused before anything is made, with the message naming why:

- a proposal that is not valid, naming every problem: a name that is not a folder name, a relative location, no repository, a declined recommendation with no reason, a `documentsOff` naming the brief or the test plan, or one that names no planning document;
- no parent directory set (the message names `indusk new-project parent <dir>`);
- a location outside the parent directory, or one that already exists;
- a conversation with no founding brief yet.

Then, in order: the workbench folder and its `worktrees/` folder; each
repository (`git init -b main`, a README, one commit); `indusk init
--workbench` as a child process; `worktree` in the project's config rewritten to
declare every repository with `worktrees: "worktrees"` and `repos_root: "."`;
`project-brief.md`, `sources/<file>` for each document (byte for byte) and
`master.md` with the milestones as `roadmap:`; `recommendations` and
`planning.documents_off` in the config; the workbench's first commit; and, only
when the proposal confirms it, `gh repo create <repository> --private --source
<path> --push`. The conversation's folder is then removed.

A failure before the remote removes what the run made - the directories and the
registry entry - and keeps the conversation, so it can be accepted again. A
failed remote leaves the finished local project and exits non-zero, saying so.

## `transcript`

```bash
indusk new-project transcript <id>
```

Prints what the conversation has said, one JSON line per event, in order: the
agent's text and tool use, your replies, the questions it asked, where each
session began (`session`) and each time you opened a reply's working
(`fold-opened`). It is what the admin shows when it reopens a conversation with
no agent running, and it is removed with the conversation by `discard`.

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
