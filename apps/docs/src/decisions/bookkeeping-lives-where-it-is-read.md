# Bookkeeping lives where it is read

**Decided 2026-10-07; shipped in 1.66.0.** Full ADR: `.indusk/planning/archive/bookkeeping-lives-where-it-is-read/adr.md`.

InDusk writes five kinds of record while it runs: `current.md`, lessons, the highlights queue, the list of highlights already processed, and evaluation results. Each used to land in whichever checkout its writer started in, and nothing committed them. The main checkout kept going dirty with InDusk's files, which blocked approves, landings and a release; and since each checkout had its own processed list, one highlight was turned into a lesson once per checkout.

## What was decided

- **Notes people read go to the main checkout and are committed on `main` as they are written**: `current.md` and lessons, in a `chore(indusk): …` commit of their own, with only those files (anything a person has staged stays staged). Only when the main checkout is on its trunk branch with no merge, rebase or cherry-pick in progress; otherwise the note is written, left uncommitted, and the reason is returned.
- **Machine state lives in the project's home**, outside every checkout and outside git: `~/.indusk/projects/<project>-<hash>/`, where the hash comes from the main checkout's path so two clones keep separate homes. `indusk eval home` prints it.
- **One resolver**, `bookkeepingRoots`, gives every writer both places from any checkout. Hooks cannot import the package, so they keep a copy, pinned equal by a test.
- **`indusk update` migrates** the main checkout's and every plan worktree's tracked highlights and `.indusk/eval/` into the home and takes them out of git; `indusk plans land` does the same for a plan branch that still tracks them.

## What falsification added

Sharing one home among every checkout, session and evaluator meant each reader had to cope with the others:

- an evaluator **holds** the highlights it is offered (30 minutes, released when it marks them), so two running at once never both turn one into a lesson;
- highlight writes take a **lock**, so concurrent writers get distinct ids;
- each checkout keeps its **own evaluator session**, because Claude Code resumes a session only from the directory that made it.

## The evaluator's permissions

Building this, the evaluator was found running `git stash`, `checkout` and `stash pop` in the worktree a session was editing. It ran under `bypassPermissions`, which ignores its allowed-tools list. It now runs under `dontAsk` with read-only git and InDusk's MCP tools allowed by name, and every git command that changes a checkout denied (`lib/eval/permissions.ts`), at every place that starts it.

## Tradeoffs accepted

- A few small `chore(indusk):` commits on `main` each day; every `/catchup` makes one or two.
- Machine state is per machine: a second machine starts its own queue.
- The hooks' copy of the resolver, held equal to the package's by a test.

## Rejected

- **Batching the commits**: `main` is still dirty between batches.
- **Keeping machine state in git**: a commit per evaluation, and each worktree reads a stale copy until it merges.
- **A bookkeeping branch**: another branch to merge, and `main` reads stale notes.
