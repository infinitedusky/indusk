# `indusk checks`

Run and name the tooling a project declares for its workflow steps, under `workflow.steps` in `.indusk/config.json`.

## `workflow.steps`

What each step of a project's workflow runs, in `.indusk/config.json`:

```json
"workflow": {
  "steps": {
    "land":    { "slow_tests": "pytest -m slow" },
    "release": { "command": "fly deploy",
                 "version_file": "pyproject.toml",
                 "changelog": "CHANGES.md",
                 "covers": ["src", "tests", "pyproject.toml", "uv.lock"] }
  }
}
```

| Key | What it is |
|---|---|
| `land.slow_tests` | The slow tests, run once per piece of code by `indusk checks slow`. |
| `land.install` | Installs the landed build on this machine, run after the merge (dusk: `pnpm install:local`, which builds what a publish builds and links the checkout into the global `indusk`). A project that publishes per plan declares none. |
| `release.command` | The command that publishes or deploys. |
| `release.version_file` | The file whose `version` the bump changes. |
| `release.changelog` | The changelog the bump rolls. |
| `release.covers` | What the slow tests cover (default: the whole repository but `.indusk/`). |
| `release.slow_tests` | The slow tests [`indusk release`](/reference/cli/release) runs itself: `command`, `report` (a path or glob to the JUnit XML it writes), `when` (`before` or `after` the release command) and an optional `rerun` template containing `{files}`. |
| `release.done_when` | When the release counts as done: `published` (default) or `green`. |

Every key is optional; `indusk update` adds the section empty. A project that declares nothing still gets an honest workflow: landing runs no slow tests, and there is nothing to publish.

**Facts, never logic.** Every value is a command, a path or a name. No conditions, templating, variables or expressions: a step that needs one names a script the project owns, and a command is whatever the project already runs (`mise run test:slow`, `just release`, `pnpm release`). Anything else is refused, naming the key.

## `indusk checks show`

```bash
indusk checks show
```

Names what landing and release run for this project, one line per step (under Release it also names the release's slow tests, when they run, and `done_when`), or says what not declaring one means ("none declared — landing runs no slow tests"). The retrospective's landing and release steps use only what it prints.

## `indusk checks slow`

```bash
indusk checks slow [--unless-covered]
```

Runs the project's slow tests, `workflow.steps.land.slow_tests`, from the top of the checkout, with their own output. Its exit code is theirs.

When they exit 0 over a clean tree, it records the code they covered in the project's home (`slow-runs.jsonl` in the folder [`indusk eval home`](/guide/eval) prints), so a later run can trust it.

| Flag | Meaning |
|---|---|
| `--unless-covered` | First look for a green run that already covered the code at hand. If there is one, print `slow tests skipped: covered by the green run at <time> (<checkout>)` and run nothing. |

A project's landing check runs `indusk checks slow`; its release runs `indusk checks slow --unless-covered`. So a plan that landed green is released without running the slow tests a second time, and a release whose code changed since landing runs them again.

### What "the same code" means

A run covers a key: for each tracked file the slow tests cover (`workflow.steps.release.covers`, or the whole repository but `.indusk/`), its path and the hash of its content. It is content, never the commit, because the version bump is a commit of its own. Two files are read specially:

- the changelog (`workflow.steps.release.changelog`) is left out;
- the version file (`workflow.steps.release.version_file`) is read without its `version`.

So the bump and its changelog entry are not a change; any code, test, test configuration or lockfile change is.

**A run is recorded only when it is fully green over a clean tree.** A non-zero exit, a covered file with an uncommitted change, an untracked file among them, or a key that changed while the tests ran: nothing is recorded, and the next `--unless-covered` runs the tests. So does a `covers` entry that lists no tracked file (a typo), or an empty list: a key over nothing would be covered by every run, so there is no key, and the command says which entry. Declared paths are compared normalised, so `./apps/docs/src/changelog.md` and `apps/docs/src/changelog.md` are the same file.

**The record is per machine.** It lives in this machine's project home, the same from the main checkout and every plan worktree; a release from another machine runs the tests once there.

With no slow tests declared, it says so and exits 0.
