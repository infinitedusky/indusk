# `indusk papers`

Publishing a paper — a plan document that declares `kind: paper` (see
[`indusk plans`](/reference/cli/plans#papers-kind-paper)) — to a destination
outside the repo, with the discipline of code: the plan copy is the source,
the destination is a build artifact, and every publish is traceable to a
commit. The design is `.indusk/planning/writing-skill/adr.md`.

## `papers publish`

```
indusk papers publish <plan>/<file> [--to <name>] [--push]
```

`<plan>/<file>` names the paper by its plan folder and filename, for example
`indusk-v4-day/paper-1-the-grift.md`. `--to` is required only when more than
one destination is configured. `--push` pushes the destination after
committing; without it nothing leaves the machine.

Eight steps, in order. Each refuses with the reason on stderr and exit 1,
having written nothing, when its precondition does not hold.

```mermaid
sequenceDiagram
    participant P as Plan copy (source repo)
    participant C as papers publish
    participant D as Destination repo
    C->>P: 1. read the paper: kind is paper, status accepted or published
    C->>P: 2. git status on the paper is clean (source committed)
    C->>C: 3. resolve the destination; its root exists and is a git repo
    C->>D: 4. git status on the target page is clean
    C->>C: 5. render (map frontmatter, rewrite sibling links); stop if up to date
    C->>D: 6. write the page, regenerate the index between the markers
    C->>D: 7. commit "publish: <title> (source <sha>)"; push only with --push
    C->>P: 8. write provenance into the frontmatter; commit "chore(papers): publish …"
```

**What lands in the destination.** The page at `<dir>/<title-slug>.md`,
with the frontmatter keys the destination's map names (default `title` and
`description`) and the body verbatim; and the index page with the block
between its markers rewritten, newest first. One commit, on the
destination's current branch, whose subject is `publish: <title> (source
<short sha>)` where the sha is the plan repo commit the copy was published
from.

**What lands in the source.** The paper's frontmatter gains `status:
published` and a `published` block (`destination`, `path`, `commit`,
`source_commit`, `hash`), written as a text edit so no other frontmatter
line changes, and one commit `chore(papers): publish <file> to <name>
(<destination sha>)`. The hash is what staleness is derived from on every
later read.

**Up to date.** A paper whose recorded hash matches its content and whose
rendered page equals the destination page exits 0, says so, and makes no
commit in either repo.

**Divergence.** If the target page's last destination commit is not the one
the paper recorded (someone committed to the page by hand), the publish
overwrites it and says so in the commit body. The destination is a build
artifact; the plan copy is the source.

### Refusals

| Situation | Message names |
|-----------|---------------|
| The document does not declare `kind: paper`, or is still `draft` | the file and its status |
| The plan copy has uncommitted changes | "uncommitted changes; commit the plan copy first" |
| No destination configured | `papers.destinations` |
| The destination path does not exist | the path |
| The destination is not a git repository | the path |
| The target page has uncommitted changes | the page path, and that nobody hand-edits the destination |
| The index page is missing or has no marker pair | the marker pair to add |
| A `repo` destination outside a workbench, or an undeclared repo | "only paths are accepted here", or the declared names |

### The index markers

The index page carries two HTML comments; everything between them is owned
by the publish step and rewritten on every publish. Everything outside them
is yours.

```markdown
# Writing

<!-- papers:start -->
<!-- papers:end -->
```

The nav points at this page once (`/writing/`), by hand. The publish step
never edits the site's VitePress config.

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

### The first publish to a destination, end to end

What dusk's first publish looked like, as a walkthrough for the next
destination.

1. **In the destination repo**, on its main branch and clean: create the
   index page with the marker pair (here `writing/index.md`), point the
   site's nav at it once (`/writing/`), and commit by hand. This is the only
   hand commit the destination ever needs.
2. **In the project**: add the destination to `.indusk/config.json` (or let
   `/write` write it), declare `kind: paper` on the documents that are
   papers, set the one you are publishing to `accepted`, and commit. The
   publish refuses an uncommitted source.
3. **Run the command**: `indusk papers publish <plan>/<file> --to <name>`.
   Read the output: the destination commit, the source commit, and any
   `warning:` lines. A warning that a sibling link was left as is means the
   page links a plan document that is not published; on the site that link
   is dead until the sibling publishes or the paragraph is revised, which is
   an editorial hotfix (edit the plan copy, commit, publish again).
4. **Check both repos**: the destination has one new commit and a clean
   tree; the paper has its `published` block and the source has one
   provenance commit. Nothing was pushed. Push the destination when you
   want it live.

### The first destination

`indusk update` writes the empty block. The first publish with no destination
configured refuses naming the block; the `/write` skill's instructions are to
ask for the destination and write it into `config.json` itself, so the file
is never hand-edited unless you want to.
