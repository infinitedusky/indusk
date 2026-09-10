# `indusk papers`

Publishing a paper — a plan document that declares `kind: paper` (see
[`indusk plans`](/reference/cli/plans#papers-kind-paper)) — to a destination
outside the repo, with the discipline of code: the plan copy is the source,
the destination is a build artifact, and every publish is traceable to a
commit. The design is `.indusk/planning/archive/writing-skill/adr.md`.

## `papers publish`

```
indusk papers publish <plan>/<file> [--to <name>] [--push]
```

`<plan>/<file>` names the paper by its plan folder and filename, for example
`indusk-v4-day/paper-1-the-grift.md`. `--to` is required only when more than
one destination is configured. `--push` pushes the destination after
committing; without it nothing leaves the machine.

Ten steps, in order. The first five refuse with the reason on stderr and
exit 1, having written nothing, when a precondition does not hold; a
failure between the write and the destination commit restores the
destination to what it was and refuses the same way.

```mermaid
sequenceDiagram
    participant P as Plan copy (source repo)
    participant C as papers publish
    participant D as Destination repo
    C->>P: 1. read the paper: kind is paper, status accepted or published
    C->>P: 2. git status on the paper is clean (source committed)
    C->>C: 3. resolve the destination; its root exists and is a git repo
    C->>D: 4. the page is this paper's (no other paper owns the slug); nothing there is dirty
    C->>C: 5. render (map frontmatter, rewrite sibling links); stop if up to date
    C->>D: 6. write the page (git mv a retitled one), regenerate the index between the markers
    C->>D: 7. commit "publish: TITLE (source SHA)", or nothing when the page is byte-identical
    C->>P: 8. write provenance into the frontmatter; commit "chore(papers): publish …"
    C->>D: 9. push only with --push, and last; a failed push is a warning
    C->>C: 10. name every published sibling whose page is now behind
```

**What lands in the destination.** The page at `<dir>/<title-slug>.md`,
with the frontmatter keys the destination's map names (default `title` and
`description`) and the body verbatim; and the index page with the block
between its markers rewritten, newest first. One commit, on the
destination's current branch, whose subject is `publish: <title> (source <short sha>)`
where the sha is the plan repo commit the copy was published
from.

**What lands in the source.** The paper's frontmatter gains `status:
published` and a `published` block (`destination`, `path`, `commit`,
`source_commit`, `hash`), written as a text edit so no other frontmatter
line changes, and one commit `chore(papers): publish <file> to <name>
(<destination sha>)`. `source_commit` is informational: rebasing the plan branch after a publish rewrites
it, and nothing reads it back. The hash is what staleness is derived from on every
later read.

**Up to date.** A paper that is `published`, whose recorded hash matches
its content, and whose rendered page equals the destination page exits 0,
says so, and makes no commit in either repo. A paper hand-set back to
`accepted` with the same content is republished instead, so its status and
provenance are written; the page is byte-identical, so the destination gets
no new commit.

**Siblings left behind.** Links to sibling documents are rewritten only when
the sibling is published at render time, and a paper whose own content did
not change never reads stale. So after a publish, every published sibling
whose page would now render differently is named on stderr with the command
that repairs it: `warning: <file> links to this paper and is now behind;
run: indusk papers publish <plan>/<file>`.

**Retitle.** A paper whose title changed publishes to a new slug; the old
page is moved with `git mv` in the same commit, so it leaves the
destination and the index. Divergence is judged on the old page before the
move.

**Push.** `--push` runs last, after the provenance commit. A failed push
(no remote, rejected) is a warning and exit 0: the publish is complete and
committed, push it yourself.

**Order.** The index lists pages newest first by the commit that first added
each page, so a hotfix republish keeps an old essay in its place.

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
| Another paper, anywhere under planning, already publishes to this slug | that paper's path; retitle one of them |
| The destination commit fails (no git identity, a hook) | git's reason; the destination was restored, nothing was published |
| The source commit fails after the destination commit | the destination commit that now exists, and that the provenance is written and needs a hand commit |
| The index page is missing or has no marker pair | the marker pair to add |
| A `repo` destination outside a workbench, or an undeclared repo | "only paths are accepted here", or the declared names |

### Module map

One home per fact, so the reader and the writer of each cannot drift:

| Fact | File |
|------|------|
| Paper parsing: vocabulary, summary, content hash, staleness, next step | `apps/indusk-mcp/src/lib/papers/summary.ts` (re-exported by `plan-parser.ts` for the `planning/plan-parser` subpath) |
| The `published` block, read and write shapes | `apps/indusk-mcp/src/lib/papers/provenance.ts` (`PublishedRecord`, `Provenance`, `readPublishedRecord`, `withProvenance`; keys pinned equal by `papers/shared-definitions.test.ts`) |
| Destinations | `apps/indusk-mcp/src/lib/papers/destination.ts`, `config.ts` |
| Rendering and the index | `apps/indusk-mcp/src/lib/papers/render.ts`, `index-page.ts` |
| Snapshot and restore of a destination tree | `apps/indusk-mcp/src/lib/git.ts` (`snapshotPaths`, `restorePaths`) |
| The ten-step procedure | `apps/indusk-mcp/src/lib/papers/publish.ts` |
| The command | `apps/indusk-mcp/src/bin/commands/papers.ts` |

### archive-dead and published papers

`indusk plans archive-dead` treats a `published` paper as a blocking status:
a plan carrying one is never a dead draft, whatever its age, because
archiving it would move the source the hotfix path publishes from.

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
