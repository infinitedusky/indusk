# `indusk promises`

The promise registry: what the system commits to, written down under
`.indusk/promises/`, and a check that refuses the registry by name the moment
it lies. The concept — kinds, lifetimes, states, the registration rule — is
the [Promises guide](/guide/promises); the design is
`.indusk/planning/day-promises/adr.md`.

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

## Reading the registry from code

The library behind the command is exported as
`@infinitedusky/indusk-mcp/promises/registry`: `readPromises(planRoot)`
returns the registry, `{ missing }` or `{ problems }`, and the vocabulary
tuples (`PROMISE_KINDS`, `PROMISE_STATES`, `PROMISE_LIFETIMES`,
`INCIDENT_SOURCES`). The admin's Promises page and the `list_promises` MCP
tool read through it; nothing parses the directory itself.
