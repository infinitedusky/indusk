# `indusk papers`

Publishing a paper — a plan document that declares `kind: paper` (see
[`indusk plans`](/reference/cli/plans#papers-kind-paper)) — to a destination
outside the repo, with the discipline of code: the plan copy is the source,
the destination is a build artifact, and every publish is traceable to a
commit. The design is `.indusk/planning/writing-skill/adr.md`.

## Configuration

Destinations live in `.indusk/config.json` under `papers.destinations`. The
block is ensured on `indusk update` as an empty list, keyed on its presence,
so a project that already declares destinations is never touched.

```jsonc
"papers": {
	"destinations": [
		{
			"name": "blog",
			"path": "~/code/site",          // or "repo": "site" inside a workbench
			"dir": "writing",
			"index": "writing/index.md",
			"frontmatter": { "title": "title", "description": "description" }
		}
	]
}
```

| Field | Meaning |
|-------|---------|
| `name` | How the destination is addressed (`--to <name>`). Optional on the command line when exactly one is configured. |
| `path` | Where the destination is: absolute, `~`-prefixed, or relative to the project root. |
| `repo` | Instead of `path`: a repo name from `worktree.repos[]`. Valid **only inside a workbench**; elsewhere it is refused with "only paths are accepted here", because a project that is not a workbench has no declarations to read. Resolved through the same reader every workbench command uses. |
| `dir` | Directory pages land in, relative to the destination root. |
| `index` | The index page the publish step regenerates between its markers, relative to the destination root. |
| `frontmatter` | Paper key → destination key. Default: `title` and `description` pass through; `kind`, `status`, `published`, and `date` never travel unless mapped. |

Resolution is pure: it reads config and declarations and touches nothing on
disk. Whether the resolved directory exists and is a git repository is the
publish step's check, so a bad path refuses at publish time naming the path.

Refusals, each naming its fix:

- No destinations configured: names `papers.destinations`.
- More than one destination and no `--to`: lists the names.
- An unknown `--to`: lists what is configured.
- A `repo` outside a workbench: only paths are accepted here.
- A `repo` the workbench does not declare: lists what it declares.

### The first destination

`indusk update` writes the empty block. The first publish with no destination
configured refuses naming the block; the `/write` skill's instructions are to
ask for the destination and write it into `config.json` itself, so the file
is never hand-edited unless you want to.
