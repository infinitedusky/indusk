# `indusk checks`

Run and name the tooling a project declares for its workflow steps, under `workflow.steps` in `.indusk/config.json`.

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

**A run is recorded only when it is fully green over a clean tree.** A non-zero exit, a covered file with an uncommitted change, an untracked file among them, or a key that changed while the tests ran: nothing is recorded, and the next `--unless-covered` runs the tests.

**The record is per machine.** It lives in this machine's project home, the same from the main checkout and every plan worktree; a release from another machine runs the tests once there.

With no slow tests declared, it says so and exits 0.
