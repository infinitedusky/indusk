# `indusk promises`

The promise registry: what the system commits to, written down under
`.indusk/promises/`, and a check that refuses the registry by name the moment
it lies. The concept — kinds, lifetimes, states, the registration rule — is
the [Promises guide](/guide/promises); the design is
`.indusk/planning/archive/day-promises/adr.md`.

## The registry

One markdown file per promise, one per incident. Frontmatter is what the
machine reads; the body is the statement (its first paragraph) and history,
for people. In a one-repo workbench the directory sits at the plan root,
beside `.indusk/planning/`; the files it names live in the code repo.

```
.indusk/promises/
├── seat-never-double-booked.md
├── one-archive-writer.md
└── incidents/
    └── i-2026-08-26-detector-overtriggers.md
```

### A promise

```markdown
---
name: seat-never-double-booked   # kebab-case; equals the file name
kind: behaviour                  # behaviour | state | structure
lifetime: holds                  # holds | established   (default: holds)
state: enforced                  # declared | enforced | known-violated | retired
domain: seating                  # one of promises.domains in .indusk/config.json
owner: seats-v2                  # a plan folder, active or archived
sites:                           # code-root-relative; each carries the token
  - src/seats.ts
tests:                           # code-root-relative; each carries the token
  - src/seats.test.ts
incidents: []                    # incident ids; required non-empty when known-violated
aliases: []                      # optional: earlier names that still resolve
superseded_by:                   # optional: the successor, when retired
---

A seat is never held by two players at once.

## History
- 2026-09-18 — first registered `enforced` (seats-v2 A3).
```

### An incident

```markdown
---
id: i-2026-08-26-detector-overtriggers   # equals the file name
promise: impact-events-are-strikes
source: smoke                            # local | smoke | deployed | desk
status: open                             # open | fixed
date: 2026-08-26
---

## Symptom
395 transient candidates across 156 minutes.

## Root cause
The detector fires on "loud sound in a quiet moment".

## Fix
v1 spectral classifier; not scoped yet.
```

`source` says where the system was running when the promise broke; `desk`
is a finding by reading, which is different evidence from a run, and a
reader six months on must not weight them equally.

### The token

A code site or a test **names** a promise by carrying the token
`promise: <name>` — in any comment syntax, a docstring, a decorator argument
or a helper call:

```ts
// promise: seat-never-double-booked
export function holdSeat(table: Table, seat: number, player: Player) { … }
```

```python
@traced("storage.put_archive", expects="promise: archive-write-once")
```

That is what makes the check language-agnostic. Two rules keep it from
reading a type annotation or a lockfile as a citation, and a name starts
with a letter. **Where a token may sit** on its line:

| Before the token | Counts? | Example |
|---|---|---|
| `//`, `#`, `/*` or `<!--` anywhere earlier on the line, any text between | yes | `// enforces promise: seat-never-double-booked` |
| `*`, `--` or `;` at the start of the line (after indentation), any text between | yes | ` * see promise: x` in a docblock, `-- promise: x` in SQL |
| a quote (`"`, `'`, `` ` ``) directly before | yes | `expects="promise: x"` |
| anything else | no | `{ promise: string }` in a type, `promise: 4` in a lockfile, a `promise:` key at the start of a YAML line, `const s = "a"; type T = { promise: string }` |

The check proves a test *names* the promise; that it *validates* it is Day
step 6 (binding). A promise may carry `aliases:` — earlier spellings — and a
site or test naming an alias names the promise; an alias may not be a live
promise's name and may not be shared by two promises.

### Domains

Declared in `.indusk/config.json`, decided in planning, never free:

```json
{ "promises": { "domains": ["seating", "archive", "gates"] } }
```

`indusk update` ensures the block exists with an empty list on a project
that has none; it never touches a declared list.

## `promises check`

```
indusk promises check
```

Runs from anywhere inside the project. Exit **0** with a one-line summary on
stdout; exit **2** with every refusal on stderr, one `path: message` line
each. A missing or malformed registry is a refusal too — "could not check"
is never reported as clean.

```
4 promises — declared 0, enforced 3, known-violated 1, retired 0 — behaviour 2, state 1, structure 1 — 1 incident
```

### What it refuses, by name

| Situation | Refusal names |
|---|---|
| No `.indusk/promises/` directory | the path where one is expected |
| An entry missing `name`, `kind`, `state`, `domain`, `owner`, or its statement; a name that does not match the file; malformed frontmatter | the file and the field — never skipped |
| A domain not in `promises.domains`; an empty or missing list | the domain, the declared list, and the config key |
| An owner that is not a *directory* under `.indusk/planning/` or `.indusk/planning/archive/` — a missing name, a file such as `master.md`, or the `archive` folder itself | the owner, and which of the three it is |
| An `enforced` promise listing an incident whose `status` is `open` | the promise and the incident — an open incident says it is broken now: mark the incident fixed or the promise `known-violated` |
| A `sites:` or `tests:` entry that is absolute or contains `..` | the entry and the path — the check never reads outside the code root |
| An alias that is a live promise's name, or shared by two promises | both files |
| An `enforced` `behaviour` or `state` promise with no test naming it, or no code site naming it | the promise and the missing link |
| An `enforced` `structure` promise with no test naming it (sites are optional for structure) | the promise |
| A listed site or test that does not exist, or does not carry the token | the promise and the file |
| A `declared` promise whose owner is archived | the promise — the plan closed without establishing it |
| An `established`-lifetime promise still `enforced` after its owner archived | the promise — it should be retired |
| A `known-violated` promise with no open incident | the promise — the state is evidence, not an excuse |
| An incident missing `promise`, `source`, `status`, `date` or a `## Symptom` / `## Root cause` / `## Fix` section; an unknown source | the incident and the field |
| An incident marked `fixed` whose `## Root cause` is still `_Unwritten — a person writes this._` (day-monitor) | the incident file — a root cause is a person's finding, written before the incident closes |
| A token anywhere under the code root naming a promise not in the registry | the file and the name |
| A token naming a `retired` promise | the file — a retired promise must not keep reporting |
| A workbench declaring zero or several repos | the declaration, through the shared resolver |

### What the reverse scan reads

Every file `git ls-files --cached --others --exclude-standard` lists under
the code root, except:

- prose (`.md`, `.mdx`, `.txt`, `.rst`) — a guide or a plan document
  mentions names in examples and is never a code site;
- everything under `.indusk/` — the registry's own incident frontmatter
  carries `promise: <name>`;
- binary files.

A code root that is not a git repository is a refusal, not an empty scan.

## Which Jaeger answers

By default, the local telemetry daemon's — a developer machine watching its
own runs. A project that also runs somewhere names that server instead:

```json
{
  "promises": {
    "domains": ["seating"],
    "jaeger": {
      "url": "https://your-server",
      "credential_env": "SEATS_JAEGER_CREDENTIAL"
    }
  }
}
```

`credential_env` is the **name of an environment variable** holding
`user:password`, never the credential itself — `.indusk/config.json` is
committed. Set the variable where the developer's shell will find it
(`~/.indusk/config.env`, the `doppler` extension, the shell profile).

Absence is the rule, not a migration: a project that names nothing reads its
local daemon and behaves exactly as it did before this existed.

Both `status` and `watch` print the Jaeger they read, so nobody has to guess
whether they are looking at production or at the laptop in front of them. A
server that cannot be reached — down, wrong URL, refused credentials, or a
`credential_env` variable that is not set — **exits 2 naming the URL**, and
never reports zero violations. A missing credential is refused against the URL
rather than quietly falling back to the local daemon: answering a question
about production with a laptop's traces is the worst available outcome.

See [`indusk telemetry serve`](/reference/cli/telemetry-server) for running
the server itself.

## `promises status`

```
indusk promises status [--since <duration>]
```

Read-only. Reports each promise as the configured Jaeger saw
it over a window — by default the quiet window (`promises.quiet_window_days`,
7 days), or `--since 90m` / `24h` / `7d`. One block per promise, opening on a
line that starts with its name:

```
Promises observed in the last 7 days, from Jaeger at http://localhost:16686

every-commit-evaluated (behaviour, gates, enforced)
  1 violation in the last 7 days
    4bf92f3577b34da6a3ce929d0e0e4736  2026-09-19T10:14:40Z  indusk-eval-agent  claude exited with code 1: There's an issue with the selected model …
  last seen upheld 2026-09-19T02:30:20Z (3147fdaa7db94980735c887ff6ce47f0)

gates-ran-at-every-checkoff (behaviour, gates, enforced)
  not seen in the last 7 days — no run exercised it

phase-boundary-record-never-malformed (state, planning, enforced)
  watched by the suite at head, not by telemetry
```

- A **behaviour** promise lists its violations in the window with each
  trace id, when, the service and the symptom from the violation event, then
  when it was last seen upheld.
- **Not seen** means no run marked it in the window. It is never reported as
  upheld or as zero violations.
- **State** and **structure** promises are listed as watched by the suite:
  their health is the last run of their test or check at head, not telemetry.
- A **retired** promise is listed and not watched.
- Marks under any of a promise's **`aliases`** count as the promise's — an
  application may still set the old name after a rename.
- Each query asks Jaeger for at most 1,500 traces. When a query fills that,
  the count is a lower bound and says so: **at least 1500 violations**.
- A mark that carries **`indusk.project`** naming another project is not
  counted. InDusk's own evaluator sets it — one service marks
  `every-commit-evaluated` for every project on a machine — to the project's
  configured `graphiti.groupId`, else the name of the **main checkout** (the
  folder holding the repository's shared git directory), so the trunk and every
  plan worktree agree. An application's own spans need not carry it.

Exit **0** when Jaeger answered. Exit **2** when it could not — no daemon
running (it names `$INDUSK_HOME/telemetry.json`), or the query URL did not
answer, timed out, or answered with something that is not Jaeger's JSON (it
names the URL) — with no count for any promise.

The marks are read by one library, `@infinitedusky/indusk-mcp/promises/telemetry`.
`readPromiseMarks(root, registry, { sinceMs? })` is the call `status`, `watch`
and the admin make: it takes the registry's behaviour promises that are not
retired, their aliases, the project id and the quiet window, and asks
`markedSpans` — which throws `JaegerUnreachable` rather than returning an empty
result. How an application marks a promise is in the
[promises guide](/guide/promises#marking-a-behaviour-promise).

## `promises watch`

`--source` says where the run happened, and is recorded on the incident:
`local` (the default), `smoke`, or **`deployed`** for a run on a deployed
system. An incident also records **`environment`** when the span carried
`deployment.environment` — one server holds staging and production, and an
incident that names the wrong one sends a person to the wrong logs. A span
that carried none records no environment rather than a guess.


```
indusk promises watch [--source local|smoke|deployed]
```

One monitor pass over the quiet window: for each behaviour promise with a
violation not yet recorded in any of its incidents, open or extend an
incident and send the promise's owner back to work. It **writes plan
documents and commits nothing** — review what it wrote and commit it. Exit 0
whether or not anything changed; exit 2 when Jaeger or the registry cannot be
read, with nothing written.

```
opened i-2026-09-19-every-commit-evaluated (every-commit-evaluated, 1 new trace)
  reopened semantic-graph-eval: Build Phase 9: Maintenance — i-2026-09-19-every-commit-evaluated

Written, not committed: review the incidents and commit them.
```

### The incident

An open incident of the promise is **extended**: its new trace ids are
appended and `last_seen` moves forward, never back. Otherwise one is
**opened** as `incidents/i-<date>-<promise>.md` (with `-2`, `-3`… on
collision):

```md
---
id: i-2026-09-19-every-commit-evaluated
promise: every-commit-evaluated
source: local
status: open
date: '2026-09-19'
opened: '2026-09-19T10:02:11Z'
last_seen: '2026-09-19T10:14:40Z'
traces:
  - '4bf92f3577b34da6a3ce929d0e0e4736'
---

## Symptom

claude exited with code 1: There's an issue with the selected model …

## Root cause

_Unwritten — a person writes this._

## Fix

_Not yet fixed._
```

The symptom comes from the newest violation's `indusk.promise.violated`
event. The root cause is never written by the monitor: it is a person's
finding, and `promises check` **refuses an incident marked `fixed` whose root
cause is still the unwritten line**, naming the file. Opening an incident
also moves an `enforced` promise to `known-violated` and lists the incident
on it, so the registry still passes the check. A trace already recorded in
any incident of the promise, open or fixed, is never counted again — a
second pass over the same window writes nothing, and a fixed incident is not
reopened by the violations that caused it. Files are edited as text, key by
key, so nothing else in a hand-written file changes.

### Reopening the owner

The promise's owning plan — active or archived — gains a phase at the end of
its impl, in place (an archived folder never moves; dozens of pointers cite
archive paths):

```md
### Build Phase 9: Maintenance — i-2026-09-19-every-commit-evaluated

- [ ] Write the root cause in the incident (`.indusk/promises/incidents/i-2026-09-19-every-commit-evaluated.md`)
- [ ] Fix: a code site, a widened test, or a revised promise

#### Build Phase 9 Verification

- [ ] T12: the test that reproduces the incident passes, and the promise is seen upheld after the fix (`indusk promises status`)

#### Build Phase 9 Context
…
#### Build Phase 9 Document
…
```

- It is numbered after the owner's own build phases, and carries an **OTel**
  gate when the project's `otel.role` asks for one.
- When the impl has a Test Trajectory, a row is appended for the test that
  reproduces the incident — writable and passing in the Maintenance phase,
  continuing the table's `A`/`T` numbering — with the justification the
  impl's shape requires: a `#### Deferred to Build Phase N` entry in Test
  Phase 1's register, or a `### Trajectory Rationale` entry. The phase cannot
  close until that test passes.
- An owner with no impl gets one holding only this phase.
- An archived plan with an unchecked Maintenance phase is **reopened**:
  `list_plans` lists it active and `get_plan_status` reads it by name from the
  archive.

## Reading the registry from code

The library behind the command is exported as
`@infinitedusky/indusk-mcp/promises/registry`: `readPromises(planRoot)`
returns the registry, `{ missing }` or `{ problems, partial }` (a malformed
entry is named and its well-formed neighbours still come back), and the
vocabulary tuples (`PROMISE_KINDS`, `PROMISE_STATES`, `PROMISE_LIFETIMES`,
`INCIDENT_SOURCES`). The admin's Promises page and the `list_promises` MCP
tool read through it; nothing parses the directory itself. Inside the
package the module has three homes: `registry.ts` reads, `citations.ts`
scans the code root for tokens (`citedNames`), `check.ts` judges the two
against each other.
