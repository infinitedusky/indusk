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
superseded_by:                   # optional, older files: the successor, when retired
supersedes:                      # optional: the promise this one replaced (written by `promises replace`)
expect_every:                    # optional: e.g. 1d — silence past this needs attention
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
fixed: '2026-08-28T14:02:00Z'            # when it was fixed; required once status is fixed
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

## Writing a promise: `declare`, `change`, `replace`, `withdraw`

Nobody writes a registry file by hand, or deletes one. A promise reaches the
registry from a planning conversation through one of these commands, and the
planner calls the MCP tools of the same names (`declare_promise`,
`change_promise`, `replace_promise`, `withdraw_promise`). Each writes plan documents and commits nothing, and each
refuses with exit **2**, naming what was wrong, with nothing written.

```
indusk promises declare <name> --plan <plan> --kind <kind> --domain <domain> --statement "<sentence>"
```

Writes `<name>.md` as `declared`, owned by the plan, with the sentence as its
statement and a History line saying where it came from. In a project that
declares no domains, the promise's domain is declared with it; in one that
does, a domain it does not declare is refused, naming the ones it does. It
refuses a name the registry already holds, a kind that is not a kind, and a
plan that is not a folder under `.indusk/planning/`.

```
indusk promises change <name> --plan <plan> --statement "<sentence>" --reason "<why>"
```

Improves a promise in place, when a later plan partly changes what it commits
to. The sentence is replaced, the plan takes the promise over, and its History
gains a line with the old sentence, the reason and the plan that owned it
before. Its name, state, incidents and aliases are untouched, so the marks
that name it and its incidents stay attached. If it breaks later, the plan
that changed it is the one reopened.

```
indusk promises replace <old> --by <new> --plan <plan> --kind <kind> --domain <domain> --statement "<sentence>"
```

For a promise whose name no longer describes it. Declares the new promise
with `supersedes: <old>`. The old one stays in force while the plan builds and
is retired when the plan closes. The link is written once, on the new
promise; `check` refuses a `supersedes` that names a promise the registry does
not hold, and refuses a replacement that is in force while what it replaced
still is.

```
indusk promises withdraw <name> --plan <plan>
```

Takes back a promise that was never in force: one the plan declared and the
conversation then dropped, or gave a better name. Its file is removed. A rename
is a withdrawal and a declaration. Take the promise out of the brief too, or
`promises contract` will say the brief makes a promise the registry does not
hold.

It refuses, with exit **2** and nothing removed, naming the promise, when it
is not `declared` (a promise in force has tests and a history, and leaves by
being replaced), when another plan declared it, when it lists an incident, and
when another promise records replacing it (withdraw that one first).

## `promises contract`

```
indusk promises contract <plan>
indusk promises contract --all
```

Does a plan's [brief](/guide/briefs), its test rows and the registry agree?
Read-only. Exit **0** with one line saying what was checked; exit **2** with
every refusal on stderr, one `path: message` line each.

```
seats-v2: its brief, its rows and the registry agree — 1 made, 1 kept, 0 changed, 0 replaced; 1 expectation
```

| Situation | Refusal names |
|---|---|
| A promise under **This plan makes** that the registry does not hold | the promise, and the `declare` command that writes it |
| One the registry says another plan owns | the promise and that plan |
| One whose sentence or kind in the registry is not the brief's | the promise, and both readings |
| A promise under **Must not break**, **Changes** or **Replaces** that does not exist, or is already retired | the promise and the list |
| A **Replaces** entry whose replacement is not among the promises the plan makes | both promises |
| An expectation with no `Measure` or no `Look`; a brief with no expectations that does not say `None — {reason}` | the expectation |
| A test row whose `For` names a promise the registry does not hold, a retired promise, or a lesson with no file under `.claude/lessons/` | the row and the name |
| A test row naming a promise another plan owns that the brief lists under none of the three | the row, the promise and its owner |
| A line in the brief that looks like part of the contract and cannot be read: a label with words after it, a promise named under none of the three lists, an entry that names no promise, no `### This plan makes` | the line |
| A name that is not a plan folder | the name — never passed |

A brief with no `## Promises` heading was written before promises were part of
one, and is not held to any of this. An archived plan is held only to what its
own brief says (its shape and its expectations): the registry is what later
plans have made of its promises since.

`--all` checks every plan folder, active and archived. `--impl-stdin` judges
the impl given on stdin in place of the one on disk; the impl hook uses it,
because it asks before a write lands.

**Who runs it.** The impl hook (`validate-impl-structure.js`) runs it on every
write to an impl that sets `test_purpose: required` and is past `draft`, and
refuses the write on a refusal. It reaches the CLI as `indusk` on `PATH`, or as
`INDUSK_BIN` when that is set. If the command cannot be run (no `indusk`, or
one too old to have `contract`), the write is refused with the command it ran
and how it failed. `promises check` runs it for every open plan.

## `promises confirm`

```
indusk promises confirm <plan> [--code-root <path>]
```

Closes a plan's promises. For each promise the plan owns that is still
`declared`, it sets `tests:` to the test files the plan's rows name, `sites:`
to the other files under the code root that carry the promise's token, and
`state: enforced`, with a History line naming the rows; a promise it
`supersedes` is retired. Then it runs `promises check`. It writes plan
documents and commits nothing.

```
seat-released-on-timeout: enforced — 1 test file, 1 code site
seats-v2: 1 promise confirmed; the registry check passes.
```

Everything that can refuse is decided before anything is written. Exit **2**,
with nothing written, naming:

| Situation | Refusal names |
|---|---|
| No row of the plan's impl names the promise in its `For` cell | the promise |
| A row that names it is not `passing` | the promise, the row and its state |
| The rows that name it name no test file in their `Test` cell | the promise and the rows |
| A test file a row names does not exist under the code root, or does not carry the token | the promise and the file |
| No code carries the token, for a `behaviour` or `state` promise | the promise |
| It replaces a promise that code still names | the promise, the one it replaces, and each file |
| The brief lists a promise under **Changes** that the plan never changed | the promise, and the `change` command |
| The brief lists a replacement that was declared without recording what it replaces | both promises, and the `replace` command |
| A name that is not an open plan folder | the name |

A plan that holds no `declared` promise has nothing to confirm; the command
says so and exits **0**, so running it twice is safe.

`--code-root` names where the plan's code and tests are. It defaults to the
project's code root. In a workbench a plan's tests exist only in its own code
worktree until it lands, so the retrospective passes that worktree.

The retrospective runs this before it archives the plan
([Step 8a](/reference/skills/retrospective)); its gate names the promises the
plan's rows do not yet prove. The MCP tool is `confirm_promises`.

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
| An open plan whose brief, test rows and the registry disagree | the plan's brief or impl, and the promise, expectation or row — everything [`promises contract`](#promises-contract) refuses |
| An `established`-lifetime promise still `enforced` after its owner archived | the promise — it should be retired |
| A `known-violated` promise with no open incident | the promise — the state is evidence, not an excuse |
| An incident missing `promise`, `source`, `status`, `date` or a `## Symptom` / `## Root cause` / `## Fix` section; an unknown source | the incident and the field |
| An incident marked `fixed` whose `## Root cause` is still `_Unwritten — a person writes this._` (day-monitor) | the incident file — a root cause is a person's finding, written before the incident closes |
| An incident marked `fixed` that does not say when (`fixed:`) | the incident file — a timeline band from opened to fixed has no end without it; `indusk promises fix` writes both |
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
      "otlp_url": "https://your-server-intake",
      "credential_env": "SEATS_JAEGER_CREDENTIAL"
    }
  }
}
```

`credential_env` is the **name of an environment variable** holding
`user:password`, never the credential itself — `.indusk/config.json` is
committed. Set the variable where the developer's shell will find it
(`~/.indusk/config.env`, the `doppler` extension, the shell profile).

`otlp_url` is the server's OTLP/HTTP intake, which is a different address from
the query API in `url`. Every read sends a probe through it first (see
[watcher blind](/guide/promises#watcher-blind)). A server named without
`otlp_url` reads as **watcher blind**, naming the missing key: a read that
cannot be probed is not reported.

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
- A behaviour promise that declares **`expect_every`** (`30m`, `6h`, `1d`)
  **needs attention** when its newest mark, upheld or violated, is older than
  that: `needs attention — silent for 3h, expected every 1h`. The same line is
  in `promise_health` (`silence`, and the promise joins `needsAttention`) and
  under the admin's chip. Without it, silence from a listening watcher is the
  good outcome — "an empty form is never submitted" should be quiet. Declare
  it only for something known to happen regularly. The default read window
  widens to the longest `expect_every` when that is longer than the quiet
  window; an explicit `--since` is never widened — it is the window counted
  and shown, and a silence longer than it is not judged. `promises check`
  refuses a value that is not a duration, and `expect_every` on a state or
  structure promise, by name.
- Marks under any of a promise's **`aliases`** count as the promise's — an
  application may still set the old name after a rename.
- Each query asks Jaeger for at most 1,500 traces. When a query fills that,
  the count is a lower bound and says so: **at least 1500 violations**.
- A mark that carries **`indusk.project`** naming another project is not
  counted. InDusk's own evaluator sets it — one service marks
  `every-commit-evaluated` for every project on a machine — to the project's
  configured `graphiti.groupId`, else the name of the **main checkout** (the
  folder holding the repository's shared git directory), so the trunk and every
  plan worktree agree. An application's own spans need not carry it. The tag
  is compared after the same normalisation as the id, so a run tagged
  `timeline-smoke` counts for the project whose id is `timeline_smoke`.

Exit **0** when Jaeger answered and heard. Exit **2** when it could not be
reached — no daemon running (it names `$INDUSK_HOME/telemetry.json`), or the
query URL did not answer, timed out, or answered with something that is not
Jaeger's JSON (it names the URL) — and exit **2** when the watcher is
**blind**: a probe span sent to the intake did not come back from the query
API within 5 seconds (it names both). Either way, no count is printed for any
promise.

### Local and production

A project that names a server in `promises.jaeger` has two sources: `local`,
the laptop's telemetry daemon, and `production`, the server. Status prints a
section for each, opening on a line with the source's name and URL, with the
blocks above inside it:

```
local — http://localhost:16686
Promises observed in the last 7 days, from Jaeger at http://localhost:16686
…

production — https://indusk-always-on.fly.dev:16687
Promises observed in the last 7 days, from Jaeger at https://indusk-always-on.fly.dev:16687
…
```

The same promise can be red in one and green in the other: a break on the
laptop is work in progress, and a break in production is the alarm. A source
that could not be read says so in its own section, naming where it looked,
and the other source is still printed. The exit code follows the **alarm
source** — production when there is one: exit **2** when production could
not be read, exit **0** when only `local` failed (a laptop with no daemon
running, beside a production server that answered). A project that names no
server prints exactly as above, with no section headers.

The marks are read by one library in two subpaths. `@infinitedusky/indusk-mcp/promises/sources`
is which Jaeger to ask and reading each; `@infinitedusky/indusk-mcp/promises/telemetry`
is how to ask one — endpoints, the query, `markedSpans`, `newestMark` and
`silencePastExpectation`.
A project has one or two **sources**: `local`, its telemetry daemon, always;
and `production`, the server `promises.jaeger` names, when it names one.
`resolveMarkSources(root)` returns each, or why it could not be resolved (no
daemon running, a missing credential). The **alarm source** —
`alarmSource(names)` — is production when there is one, otherwise local: a
local break during development is work in progress, not an alarm.
`readSources(root, registry, opts)` reads every source and returns one entry
each: its marks, or its failure (`unreachable` or `blind`, where it looked,
and why). It never throws for one source's failure, so one dead source never
hides another. A malformed `promises.jaeger` — a string where the object belongs, or a
missing `url` or `credential_env` — is production's failure, refused by
key, and local is still read. A source that accepts connections and never
answers fails within the reader's timeout: the probe's send and its
follow-up check share one budget, so a silent production cannot stall
local. `@infinitedusky/indusk-mcp/promises/timeline` reads a window for the
timeline: `readTimeline(root, registry, { from, to, source? })` returns, per
source, every behaviour promise's runs in the range as `{ at, outcome, traceId }`
— no spans, since Jaeger returns whole traces and a week of one promise can be
megabytes. A query that returns as many traces as it asked for is split at its
midpoint and both halves read again, down to one minute; a minute still full is
listed in `atLeast`, its runs a lower bound. Each source fails on its own, and
the watcher probe is not repeated. Both readers build their query through one
function, `marksBetween`, so they agree on which marks count. `sourceAdvice(name, error)` says what to do about a failed source,
from the failure itself — `status` and `watch` both print it. `readPromiseMarks(root, registry, { sinceMs?, source? })` reads
one source, the alarm source by default: it takes the registry's behaviour
promises that are not retired, their aliases, the project id and the quiet
window, and asks `markedSpans` — which throws `JaegerUnreachable` rather than
returning an empty result. Before it reads, it calls `probeWatcher`, which throws `WatcherBlind`
(exported from `promises/sources`, beside `JaegerUnreachable`) when the probe does not come back. When the
intake refuses the probe and the query API does not answer either, nobody is
there, and it throws `JaegerUnreachable` instead. A probe
that came back is trusted for 30 seconds per query URL, within one process. The same subpath exports `newestMark(marks)` (when a promise was last seen: its newest mark, upheld or violated) and `silencePastExpectation(promise, marks)` (the `expect_every` judgment). `promise_health`, `promises status` and the admin read both, so no surface restates either rule. How an application marks a promise is in the
[promises guide](/guide/promises#marking-a-behaviour-promise).

## `promises watch`

`--source` says where the run happened, chooses what is read, and is
recorded on the incident: `local` (the default) and `smoke` read the laptop's
daemon; **`deployed`** reads the production server `promises.jaeger` names,
and is refused, naming `promises.jaeger`, when the project names none. An incident also records **`environment`** when the span carried
`deployment.environment` — one server holds staging and production, and an
incident that names the wrong one sends a person to the wrong logs. A span
that carried none records no environment rather than a guess.


```
indusk promises watch [--source local|smoke|deployed]
```

One monitor pass over the quiet window: for each behaviour promise with a
violation not yet recorded in any of its incidents, open or extend an
incident and send the promise's owner back to work. It **writes plan
documents and commits nothing** — review what it wrote and commit it.

| Exit | Meaning |
|------|---------|
| 0 | the pass ran, and every open incident it touched is carried by its owner's Maintenance phase (or nothing changed) |
| 1 | an incident is left **without** its owner's phase — a new one, one this run extended, or one an earlier run could not reopen — because of a collision, an owner that is not a plan folder, or a worktree record that could not be read. Incidents are still written; the error line says which owner and why |
| 2 | Jaeger or the registry could not be read, or the watcher is **blind** (a probe sent to the intake never came back); nothing was written |

A violation that no plan owns is the outcome the monitor exists to prevent,
so a run that leaves one behind never exits 0 — including a quiet run with no
new violation, when an earlier run's reopen failed:

```
unowned i-2026-10-02-pot-splits-evenly (pot-splits-evenly: open, and no-such-plan has no Maintenance phase for it)
  owner "no-such-plan" is not a plan folder — nothing was reopened
```

```
opened i-2026-09-19-every-commit-evaluated (every-commit-evaluated, 1 new trace)
  reopened semantic-graph-eval: Build Phase 9: Maintenance — i-2026-09-19-every-commit-evaluated

Written, not committed: review the incidents and commit them.
```

### The incident

An open incident of the promise is **extended**: its new trace ids are
appended and `last_seen` moves forward, never back. Otherwise one is
**opened** as `incidents/i-<date>-<promise>.md`, with `-2`, `-3`… when that
id is taken. An id is taken when its incident file exists **or** when the
owner's impl already has a Maintenance phase naming it — a phase outlives its
incident file, so deleting the file does not free the id:

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

## Proven by

No test row names this promise, so no plan says which test proves it. Its registry entry lists as tests: apps/indusk-mcp/src/__tests__/monitor-mark.test.ts.

## Root cause

_Unwritten — a person writes this._

## Fix

_Not yet fixed._
```

The symptom comes from the newest violation's `indusk.promise.violated`
event. **Proven by** lists every test row, in any plan's impl, active or
archived, whose `For` cell names the promise: the plan, the row, its state and
its test files:

```md
- `seats-v1` row T4 — passing (src/seat.test.ts)
- `seats-v2` row T1 — written (src/seat-hold.test.ts)
```

A `passing` row there is a test that did not catch this break, which is where
the fix starts. When no row names the promise the section says so and falls
back to the test files its registry entry lists, as above: that promise was
registered before rows said what they were for. An impl that could not be read
is named rather than skipped. It is
written once, when the incident opens: a record of what was vouching then, not
a live view. A promise a later plan changed is named by rows in both plans, and
both are listed.

The root cause is never written by the monitor: it is a person's
finding, and `promises check` **refuses an incident marked `fixed` whose root
cause is still the unwritten line**, naming the file. Opening an incident
also moves an `enforced` promise to `known-violated` and lists the incident
on it, so the registry still passes the check. A trace already recorded in
any incident of the promise, open or fixed, is never counted again — a
second pass over the same window writes nothing, and a fixed incident is not
reopened by the violations that caused it. Files are edited as text, key by
key, so nothing else in a hand-written file changes.

### Closing an incident

```
indusk promises fix <incident-id>
```

Marks the incident `status: fixed` and records `fixed: <now>`, and returns its
promise from `known-violated` to `enforced` when no other incident of it is
still open; the promise keeps the incident in its `incidents` list, as its
history. It writes plan documents and commits nothing. Exit **2** naming the
id when it is unknown or already fixed, and when its root cause is still the
line `promises record` wrote — write the root cause first; the file is left
untouched. Before
this command existed, closing an incident was three hand edits, and the time
it was fixed was recorded nowhere.

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
- An **extended** incident whose phase exists is the normal second pass and
  writes nothing.
- An **open incident whose owner carries no phase for it** — an earlier run
  recorded it and could not reopen — is retried on **every** run, with or
  without a new violation, and printed as `unowned`. Once the owner can be
  reopened (its folder exists, its worktree record reads), the next run
  appends the phase and the incident stops being reported. An **opened** incident whose heading already exists — a
  phase written by hand, or one that arrived any other way — is a
  **collision**: nothing is appended, and `watch` prints

  ```
    smoke-owner was not reopened — its impl already has "Maintenance — i-2026-10-02-chat-keeps-line-breaks", which this new incident did not write; nothing was appended
  ```

  and exits 1.
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
