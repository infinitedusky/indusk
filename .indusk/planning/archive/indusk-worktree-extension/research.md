---
title: InDusk Worktree Extension — Research Survey
date: 2026-05-26
status: research
audience: indusk-worktree-extension ADR author
---

# InDusk Worktree Extension — Research Survey

Grounding survey for the ADR. Investigation covers (1) the existing
`dawn-fde-toolkit` substrate the extension promotes, (2) the proposed
second dogfood target (`numero` to be wrapped by a new
`numero-workbench`), (3) the current `indusk init` + `extensions enable`
onboarding path, and (4) the concrete `on_enable` delta the extension
needs to bridge those.

The brief and test-plan are accepted; this survey constrains the ADR
to documented codebase state and flags open questions where the
investigation didn't conclusively resolve a design choice.

---

## 1. dawn-fde-toolkit current state

`/Users/the_dusky/code/lazer/dawn-fde-toolkit/` is the existing
workbench. It is the source pattern the extension is upstreaming.

### 1.1 Top-level layout (workbench shape)

```
dawn-fde-toolkit/
├── .indusk/
│   ├── config.json                       # mode=full, scm=git
│   ├── worktree-configs/
│   │   └── avoca-next.json               # the only per-wrapped-repo config today
│   ├── planning/  eval/  research/  sandbox/  soft-strategy/
│   └── extensions/                       # cgc, chrome-devtools, composable-env, datadog, graphiti, local-telemetry
├── .claude/
│   ├── lessons/                          # 24 .md (community-* + workbench-symlink-pattern.md + worktree-creation-use-refresh-script.md)
│   └── skills/                           # (empty — toolkit-side; skills are package-owned)
├── apps/                                 # toolkit-internal scratch apps
├── packages/
├── scripts/                              # ⭐ load-bearing for this plan; see §1.2
├── env/                                  # composable.env tree; see §1.4
├── production/                           # ⭐ gitignored symlinks to canonical client clones
│   ├── avoca-next      → ../../avoca/avoca-next
│   ├── claude-skills   → ../../avoca/claude-skills
│   └── vapi            → ../../avoca/vapi
├── worktrees/                            # ⭐ gitignored symlinks to active feature worktrees
│   └── avoca-next-<slug> → ../../avoca/avoca-next.worktrees/<slug>     (×6 active today)
├── ce.json                               # composable.env config
├── docker-compose.{local,production,staging,test}.yml
├── biome.json
├── package.json                          # pnpm@10.33, node≥24<25
└── pnpm-workspace.yaml
```

Key invariants:

- `production/` and `worktrees/` are **gitignored** (`.gitignore:91-95`).
  Symlinks live only on the FDE's machine.
- Canonical clones live OUTSIDE the workbench at sibling paths
  (`~/code/lazer/avoca/avoca-next` etc.). The `setup-worktree.sh`
  script bakes this assumption in via the `SIBLING_PARENT`
  hardcoded constant (`scripts/setup-worktree.sh:33`). The
  brief's "workbench pattern" abstraction is real but the
  toolkit's scripts hardcode the parent path.
- `scm: "git"` in `.indusk/config.json`. No jj.

### 1.2 The four scripts

| File | LOC | What it does | Hard-coded assumptions |
|------|-----|--------------|------------------------|
| `scripts/setup-worktree.sh` | 157 | Create worktree + copy_files[] + append_files[] + apply_commits[] + post_create[] + toolkit symlink | `SIBLING_PARENT="$HOME/code/lazer/avoca"` (line 33) is hardcoded — the script ONLY works for repos under `~/code/lazer/avoca/`. Numero would need a different parent. |
| `scripts/refresh-worktree.sh` | 169 | Re-apply copy/append/overlays to an existing worktree. Sentinel-bounded idempotent appends (`# --- FDE toolkit overrides (...)` / `# --- end FDE toolkit overrides ---`). Re-overlays apply_commits from the current SHA. NOT post_create. | Same `SIBLING_PARENT` hardcode (line 42). Supports `--all` to refresh every worktree of a repo. |
| `scripts/wt.sh` | 145 | Resolve `<slug>[:<app>]` to a path (two-pass: `worktrees/` first, then `production/` fallback). Then `cd <path>[/apps/<app>]` and `exec pnpm <command>`. Special-cases `inngest` command. | None — slug resolution is path-relative to `TOOLKIT_ROOT`. Portable. |
| `scripts/wt-pm2.sh` | 163 | Same slug resolution as `wt.sh`. Takes N pairs of `<target> <cmd>`, launches each via `pnpm exec pm2 start pnpm --name <slug>-<app>-<cmd>`. `--no-autorestart`, `--update-env`. | None — also portable. |
| `scripts/preflight.sh` | 226 | Resolve slug, derive client repo from worktree's parent dir, compute changed files vs `origin/main` (three-piece diff: merge-base..HEAD + --cached + unstaged), export `CHANGED_FILES`, `CHANGED_FILES_BIOME`, `CHANGED_FILES_ESLINT_WEB`, `HAMMING_RELEVANT`, run each `preflight[]` entry, exit on first failure. | The ESLint path filter (line 171-177) hardcodes `apps/web/` — that's an Avoca convention. The Hamming case (line 184-200) is fully Avoca-shaped. `CHANGED_FILES_BIOME` extension filter is generic (js/jsx/ts/tsx/css/json/jsonc). |

**Confidence: high** that `setup-worktree.sh`'s `SIBLING_PARENT`
hardcode is the single most workbench-specific line in the script
set. The brief acknowledges this implicitly ("we'd suggest the
extension reads config" but the toolkit literally just hardcodes
the avoca parent dir).

**Confidence: high** that `preflight.sh`'s Avoca-specific filters
(`CHANGED_FILES_ESLINT_WEB`, `HAMMING_RELEVANT`) are exactly the
shape the `preflight_env{}` declarative pattern in the test-plan
(A17) is designed to displace.

**There is no `scripts/setup.sh`.** The user's task prompt
mentioned it; in reality the toolkit only has
`setup-worktree.sh` + `refresh-worktree.sh`. Bootstrap of the
workbench itself is undocumented in the toolkit — there's no
"adopt this pattern on a new machine" script. The brief talks
about every FDE re-inventing this; the lack of a setup script
is part of why.

### 1.3 The `apply_commits[]` / skip-worktree pattern

Lives in `.indusk/worktree-configs/<repo>.json` under the
`apply_commits[]` array. Each entry has `sha`, `description`,
`files[]`, `skip_worktree: bool`, `_remove_when`.

Three entries today in `avoca-next.json` (lines 20-56):

1. `af78a5c89e` — Plan P responder.ts + provision-test-phone.ts
2. `0a5e7ec42f` — inngest dev cron gate
3. `8de86bd7a9` — local-test-call-visibility dashboard UI

The mechanism (from `setup-worktree.sh:120-138`):

```bash
(cd "$WORKTREE_PATH" && git show "$sha:$file" > "$file")    # overlay file content
git update-index --skip-worktree "$file"                    # hide from git
```

NB: this is NOT `git cherry-pick`. The brief describes it as
"cherry-pick" (line 165) but the actual implementation is
`git show <sha>:<file> > <file>` — full-file replacement, no
3-way merge. The lesson at
`.claude/lessons/worktree-creation-use-refresh-script.md:25-26`
flags this explicitly:

> NOTE: SHA based on main. Because refresh-worktree.sh does
> full-file replacement (not patch application), this overlay
> will overwrite route.ts with main's version including imports
> that don't exist on older branches.

So the overlay model has a known sharp edge that the brief
glosses. Worktrees branched off a base significantly behind
main can break.

**Refresh behavior (lines 130-151 of `refresh-worktree.sh`):**
unflag skip-worktree, re-`git show <sha>:<file>`, then re-flag.
This means refresh is the recovery mechanism when an upstream
SHA changes (rebased upstream PR). It does NOT unflag entries
that were deleted from config — only the entries still present
are processed. **The brief claims (line 87 / line 170) that
removing an entry and running refresh clears the skip-worktree
flag for that entry's files. The current implementation does
not do this.** A14 in the test-plan asserts the correct
behavior — making the extension fix this gap would be in-scope.

### 1.4 composable.env / FDE-overrides shape

```
env/
├── components/                          # per-tech reusable building blocks
│   ├── api-mocker.env  autoops.env  avoca-dashboard.env  avoca.env
│   ├── dashboard.env   datadog.env   docs.env            networking.env
├── contracts/                           # per-component-output declarations
│   ├── api-mocker.contract.json
│   ├── avoca-dashboard.contract.json
│   ├── avoca-next.contract.json        # ⭐ writes env/avoca-next.fde-overrides.env
│   ├── dashboard.contract.json
│   ├── datadog.contract.json
│   ├── docs.contract.json
│   └── scripts.contract.json
├── profiles/
│   ├── local.json    {name, description}
│   └── production.json
├── execution/
│   └── ecosystem.config.cjs            # pm2-related
├── .env.secrets.shared                  # ⭐ committed, vault-encrypted (10 entries)
├── .env.secrets.local                   # gitignored, per-machine
├── avoca-next.fde-overrides.env         # ⭐ generated artifact, gitignored
└── avoca-dashboard.fde-overrides.env    # ⭐ generated artifact, gitignored
```

`env/contracts/avoca-next.contract.json` is the source-of-truth
for what eight env vars get included in `avoca-next.fde-overrides.env`:

```json
{
  "name": "avoca-next",
  "location": "env",
  "outputs": { "local": "avoca-next.fde-overrides.env" },
  "vars": {
    "WEBHOOK_API_KEY_ENCRYPTION_KEY": "${avoca.WEBHOOK_API_KEY_ENCRYPTION_KEY}",
    "INNGEST_DEV": "${avoca.INNGEST_DEV}",
    ...
  }
}
```

`env/components/avoca.env` holds the actual values, with `${secrets.X}`
references to `.env.secrets.shared` for secret material.

`.gitignore:85-87`:

```
env/*.fde-overrides.env
```

So **the FDE-overrides files themselves are not committed; the
contracts AND components that generate them are**. New worktrees
get the overrides by:

1. `pnpm ce build local` regenerates `env/*.fde-overrides.env` from the contract/component graph.
2. `setup-worktree.sh` reads `append_files[]` from the worktree config and appends `env/avoca-next.fde-overrides.env` → `apps/web/.env.local`.

The `.fde-overrides.env` filename is convention — there's no
formal pattern. `dawn-fde-toolkit/.gitignore` matches via wildcard
`env/*.fde-overrides.env`. If the extension wants to standardize
this for promotion, the convention needs a name.

**Open question for ADR:** Is the `.fde-overrides.env` filename
a load-bearing pattern the extension should canonize, or just
the toolkit's local convention? If canonized, the extension's
`on_enable` would need to scaffold the env/contracts/<repo>.contract.json
+ env/components/<repo>.env stubs. If not, the extension stays
agnostic about how `append_files[]` source paths are populated.

### 1.5 Preflight scoped-diff logic (file-level)

`preflight.sh:147-200` computes four signals:

| Variable | Definition | Avoca-shaped? |
|----------|------------|---------------|
| `CHANGED_FILES` | union of `<merge-base>..HEAD`, `--cached`, unstaged; deduped; filtered to extant | generic |
| `CHANGED_FILES_BIOME` | `CHANGED_FILES` filtered to `js\|jsx\|ts\|tsx\|css\|json\|jsonc` | generic (matches Biome's coverage) |
| `CHANGED_FILES_ESLINT_WEB` | `CHANGED_FILES` filtered to `^apps/web/.*\.(js|jsx|ts|tsx)$`, paths stripped of `apps/web/` prefix | **Avoca-shaped** — the prefix is bare |
| `HAMMING_RELEVANT` | boolean — true if any changed file matches one of 11 hardcoded path globs | **Avoca-shaped** — every glob is `apps/web/...hamming...` |

Test-plan A17 takes the position that `preflight_env{}` should make
these declarations data-driven (per-config), and the extension's
preflight runner consumes them. The `HAMMING_RELEVANT` glob list
(11 entries) is exactly the kind of thing that would move into a
`preflight_env.HAMMING_RELEVANT.match[]` array.

### 1.6 Install / setup ritual today (the unwritten one)

There's no `scripts/setup.sh`. Adopting `dawn-fde-toolkit`'s
pattern on a new machine requires:

1. Clone the toolkit.
2. Clone each client repo into a sibling dir matching `setup-worktree.sh`'s `SIBLING_PARENT` constant (`~/code/lazer/avoca/`).
3. Create `production/` and `worktrees/` directories (gitignored).
4. Manually symlink each client clone into `production/<repo>` (`ln -s ../../avoca/<repo> production/<repo>`).
5. Write `.indusk/worktree-configs/<repo>.json` per client.
6. Write `env/contracts/<repo>.contract.json` + `env/components/<repo>.env`.
7. Populate secrets in `.env.secrets.shared` (committed, vault-encrypted) and `.env.secrets.local` (gitignored).
8. `pnpm install` (installs `composable.env`, `pm2`, `ajv`).
9. `pnpm ce build local` to generate the `env/*.fde-overrides.env` files.

Every step except (1) and (8) is manual and documented nowhere
in the toolkit. The brief's pitch is that the extension subsumes
several of these — primarily (3), (4), (5), and the `scripts/`
files that don't even exist on a fresh adopter's machine.

---

## 2. Numero current state + workbench-wrapping fit

`/Users/the_dusky/code/sandbox/numero/` is a substantial pnpm/turbo
monorepo. It is not a workbench today; the plan creates a new
sibling workbench (`numero-workbench`) that wraps it.

### 2.1 Top-level layout

```
numero/
├── .git/                                # ⭐ git, not jj
│   └── worktrees/copilot-tables-mvp-phase-1   # ONE git worktree currently active
├── .indusk/                             # ⭐ this IS an indusk project, not a workbench
├── .claude/
├── .mcp.json
├── apps/                                # 13 apps including _archive, admin, admin-server,
│                                        #   arena, auth-server, dealer, docs, frontpage,
│                                        #   game-server, hosted-agent-service,
│                                        #   playtest-npc-service, poker, poker-next, ponder
├── packages/                            # 12 packages: auth-client, contracts, db, game-logic,
│                                        #   next-middleware, redis, telemetry, tx-queue,
│                                        #   types, ui, web3, ws-client
├── env/                                 # composable.env (already!)
├── ce.json                              # composable.env config — uses Doppler for secrets
├── docker-compose.{local,production,staging,test}.yml
├── biome.json
├── turbo.json
├── package.json                         # pnpm@10.12.4, node≥24, doppler postinstall,
│                                        #   composable.env ^1.37.6
├── pnpm-workspace.yaml
├── instrumentation.ts                   # OTel
└── (no production/, no worktrees/)
```

### 2.2 SCM and worktree habits

- SCM is **git** (no `.jj` directory). Compatible with the extension
  since the worktree extension's scripts use plain `git worktree add`.
- Numero already has ONE active git worktree: `.git/worktrees/copilot-tables-mvp-phase-1`.
  So the team does use `git worktree` natively today — just without
  the toolkit pattern around it.

### 2.3 Multi-app structure

13 apps and 12 packages. `pnpm-workspace.yaml` (3 lines) presumably
declares `apps/*` and `packages/*`. The `dev` script orchestrates
4 of them via `concurrently` (`arena`, `dealer`, `docs`, `admin`).
This shape is exactly the `wt:<slug>:<app>` use case — the slug
addresses a worktree, `:web`/`:dealer`/`:docs` selects which app
inside it gets the `pnpm <command>`.

### 2.4 Workbench-wrapping fit

The proposed `numero-workbench` would live as a new sibling indusk
project — say at `~/code/sandbox/numero-workbench/` — with:

```
numero-workbench/
├── .indusk/
│   ├── config.json              # mode=full, scm=git
│   └── worktree-configs/
│       └── numero.json          # to be authored
├── production/
│   └── numero  → ../numero      # symlink to /Users/the_dusky/code/sandbox/numero
├── worktrees/                   # initially empty
├── package.json                 # minimal — pm2, composable.env, ajv deps
├── pnpm-workspace.yaml
└── ce.json                      # minimal composable.env config (or none if not used)
```

Issues that could block / complicate this:

- **Numero already uses Doppler for secrets** (`package.json:7`,
  `ce.json:6-9`). The dawn-fde-toolkit pattern assumes
  `env/.env.secrets.shared` + `.env.secrets.local`. The
  `numero-workbench` need not inherit the wrapped repo's secrets
  setup — the workbench is a thin shell around `production/numero`
  and its own per-worktree env management is independent.
- **Numero is on pnpm 10.12.4; dawn-fde-toolkit is on 10.33.0.**
  Not blocking; pnpm versions differ across the wrapped repo vs the
  workbench. The `wt.sh`/`wt-pm2.sh` pattern runs `pnpm <command>`
  inside the wrapped repo's tree, so the wrapped repo's pnpm
  version is what executes.
- **`SIBLING_PARENT` hardcode in `setup-worktree.sh:33` would not
  work for Numero.** The extension MUST make the canonical-clone
  parent dir config-driven. Today: `~/code/lazer/avoca`. For
  Numero: `~/code/sandbox`. Test-plan A6 implicitly demands this
  via `wt:numero` resolving to `production/numero`, but the worktree
  parent dir (`<sibling-parent>/<repo>.worktrees/`) needs the same
  treatment.
- **No `production/` or `worktrees/` directories exist** on
  Numero (and don't belong there — the indusk-mcp project lives
  inside Numero, and the workbench is meant to be a separate
  outer shell). The plan creates `numero-workbench/` from scratch.
- **`pnpm ce wt:numero dev` resolves what?** The trunk
  (`production/numero`) — so it would `cd production/numero/`
  then `exec pnpm dev`, which fires Numero's `concurrently`-driven
  4-app dev. That works but starts everything; FDE almost always
  wants `wt:numero:arena dev` to scope to one app.

**Open question for ADR:** Should the workbench's package.json
declare a `dev` script of its own, or does `pnpm ce wt:trunk dev`
fully replace it? The test-plan A6 says trunk is always-present;
the implication is the workbench's own package.json is minimal
glue.

### 2.5 What `pnpm ce wt:numero dev` resolves to

Per `wt.sh:74-89`:

1. Looks under `worktrees/`. No symlink ending in `-numero` and no
   exact name `numero` (worktrees are named like `numero-feat-xyz`,
   not bare `numero`).
2. Falls back to `production/numero`. Match.
3. `cd production/numero` then `exec pnpm dev`.

Net effect: cwd is `/Users/the_dusky/code/sandbox/numero` and we
run `pnpm dev` there. **High confidence this works without further
changes** as long as the workbench is wired through `pnpm ce wt:`.

The complication is that `wt.sh` is bash and currently lives in
`dawn-fde-toolkit/scripts/`. The extension's `on_enable` must drop
the equivalent into `numero-workbench/scripts/` (or equivalent
path), AND the `pnpm ce wt:` surface needs whatever glue makes
`ce` route into that script. Per the brief's 2026-05-20 surface
revision, "the extension wires up whatever local glue ce needs"
— but what that glue looks like is undefined.

**Open question for ADR (the big one):** How does `pnpm ce wt:<target> <cmd>`
actually get routed to the local `wt.sh` script? Three plausible
mechanisms:

- (a) The extension scaffolds a top-level `package.json` script
  named `wt:*` that ce resolves via its own script-passthrough.
  Requires inspection of composable.env's behavior on unknown
  subcommands.
- (b) The extension scaffolds a composable.env contract / component
  that ce knows about. Likely too heavy for what's a pure-CLI
  shim.
- (c) The extension just provides `scripts/wt.sh` and registers
  it as a `wt` pnpm script; users invoke `pnpm wt <slug> <cmd>`
  directly. The `pnpm ce wt:<slug> <cmd>` surface would be
  aspiration the ADR explicitly defers.

The brief's 2026-05-20 revision **mandates** the `pnpm ce wt:`
surface (A5, A6, A8). The ADR must resolve which of (a)/(b)/(c)
satisfies that — or describe a fourth mechanism. **High confidence
this is the single most underspecified part of the brief.**

---

## 3. Onboarding friction (the indusk init + extension enable path)

### 3.1 What `indusk init` does today

From `apps/indusk-mcp/src/bin/commands/init.ts` (1270 lines), in
order:

1. **Detect tooling** — biome/eslint, vitest/jest, otel files,
   tsconfig.json. Writes to `.indusk/config.json`'s `detected.*`.
2. **Copy skills** from `apps/indusk-mcp/skills/*.md` to
   `.claude/skills/{name}/SKILL.md` (one per file, via `globSync("*.md")` — fixed in Phase 6 of git-or-jj-substrate).
3. **Copy community lessons** (`lessons/community/*.md`) to `.claude/lessons/`.
4. **Create CLAUDE.md + AGENTS.md** from templates (never overwrite if present; spawns `CLAUDE-NEW.md` instead).
5. **Create `.indusk/planning/`**.
6. **MCP server setup** via `claude mcp add` for:
   - `indusk` (stdio, with PROJECT_ROOT=.)
   - `codegraphcontext` (stdio, FALKORDB_HOST=localhost, FALKORDB_GRAPH_NAME=cgc-{project})
   - `graphiti` (http, http://localhost:8100/mcp)
7. **Check indusk-infra container** running, start if needed.
8. **Copy Graphiti extension manifest** to `.indusk/extensions/graphiti/`.
9. **Generate `.vscode/settings.json`** from template.
10. **Create `biome.json`** from template + **wire into every package.json**: add `@biomejs/biome` devDep at root, rewrite simple `lint`/`format` scripts (eslint/next-lint/prettier → biome). Compound scripts get flagged for manual migration.
11. **Detect lint vestiges** — surface ESLint/Prettier config files + devDeps for the user to remove.
12. **Scaffold OpenTelemetry** based on detection (Next.js / Python / React SPA / generic Node). Sets `service.name` from the project basename.
13. **Copy hooks** (`apps/indusk-mcp/hooks/*.js` → `.claude/hooks/`, via globSync) and merge hook config + permissions into `.claude/settings.json`. Hook config covers PreToolUse (`Edit|Write` → check-gates, validate-impl-structure, check-catchup) and PostToolUse (`Edit|Write` → gate-reminder; `Bash` → eval-trigger).
14. **Create `.cgcignore`**.
15. **Manage gitignore** (full mode) or `.git/info/exclude` (--local mode). Standard entries: `.mcp.json`, `.claude/handoff.md`, `.indusk/graph/`, `.indusk/eval/`, `.indusk/extensions/`.
16. **Run `on_init` hooks** of every already-enabled extension. Print MCP setup instructions for extensions with `mcp_server` blocks.
17. **Auto-index codebase** into CGC (if cgc extension enabled).
18. **`autoEnableExtensions`** — see §3.2.
19. **Write `.indusk/config.json`** with mode, verify.linter/testRunner, detected, scm (detected via `detectScm(projectRoot)`, deferred with stderr warning if neither jj nor git is present).
20. **Create `.claude/handoff.md`** (first-session orientation).
21. **Register project in `~/.indusk/projects.json`** (admin-ui registry).

### 3.2 What `autoEnableExtensions` does (`extensions.ts:609-698`)

Two passes:

**Pass 1 — required-by-default.** Iterate built-ins. If `required: true` AND not enabled AND not in `disabled_extensions`, enable + fire `on_enable`. Today: only `local-telemetry` is `required: true`.

**Pass 2 — detection-based.** Per built-in, check `ext.detect`:
- `file` (path exists at projectRoot)
- `file_pattern` (globSync at maxDepth 3)
- `dependency` / `devDependency` (package.json)
- `mcp_server` (.mcp.json)

If any match, enable. Print the trigger reason.

### 3.3 What `indusk extensions enable <name>` does

From `extensions.ts:106-202`. For each name:

1. If already enabled: copy `.env.example` (refresh template), print env-setup hint, print MCP setup. Continue.
2. If built-in manifest has auth-required MCP headers AND no `.env` has credentials: copy `.env.example`, print refusal + setup instructions. Skip.
3. If a disabled manifest exists at `.indusk/disabled/{name}/`: rename to `.indusk/extensions/{name}/`, copy assets, fire `on_init` + `on_enable`, install skill, print env hint, print MCP setup.
4. Else if built-in manifest exists: copy manifest + assets into `.indusk/extensions/{name}/`, fire `on_init` + `on_enable`, install skill, print env hint, print MCP setup.
5. Else try npm install: `extensionsAdd(name, name)` then continue.

`copyExtensionAssets(projectRoot, name)`: copies `extensions/{name}/.env.example` → `.indusk/extensions/{name}/.env.example` if present. Always overwrites (it's reference, never user-edited).

`runHook(projectRoot, name, hook)`: reads the manifest's `hooks.{hook}` command, applies the `INDUSK_BIN` env override (substitutes `indusk ` prefix), runs via `execSync` with `stdio: "inherit"` and 30s timeout.

`printEnvSetupHint`: nudges the user to `cp .env.example .env` if (a) `.env.example` exists, (b) `.env` is absent, (c) the extension is "functional" (has auth-required MCP headers — local-telemetry is not, dash0 is).

`installSkill(projectRoot, name)`: copies `extensions/{name}/skill.md` → `.claude/skills/{name}/SKILL.md` if `provides.skill === true`.

### 3.4 Concrete `on_enable` examples

**`local-telemetry/manifest.json`:**

```json
{
  "name": "local-telemetry",
  "required": true,
  "provides": { "skill": true, "health_checks": [...] },
  "hooks": {
    "on_enable": "indusk telemetry register $(pwd)",
    "on_disable": "indusk telemetry deregister $(pwd)"
  },
  "detect": { "file": ".indusk/extensions/local-telemetry/.env" }
}
```

The `on_enable` calls back into the indusk CLI to register the
project with the machine-global telemetry daemon. The `$(pwd)`
expansion happens at execSync time with `cwd: projectRoot`. The
`INDUSK_BIN` substitution lets tests pin the binary.

**`dash0/manifest.json`:**

```json
{
  "name": "dash0",
  "mcp_server": {
    "type": "http",
    "url": "DASH0_ENDPOINT_MCP",
    "headers": { "Authorization": "Bearer DASH0_AUTH_TOKEN" },
    "setup_instructions": ["1. Copy the template...", ...]
  },
  "hooks": { "on_enable": "echo 'Dash0 extension enabled.'" },
  "detect": { "mcp_server": "dash0" }
}
```

Dash0's `on_enable` is a no-op echo — the real wiring is the
`mcp_server` block, which `printMcpSetup` evaluates: substitute
env-var placeholders from `.env` into url + headers, then
`claude mcp add -t http -s project -- dash0 <url>` with headers.

### 3.5 composable.env install — where does it sit?

`init.ts` does NOT install or scaffold composable.env. The
`composable-env` extension exists in `.indusk/extensions/`
(verified on dawn-fde-toolkit — line 4 of §1.1) and its manifest
declares:

```json
"hooks": { "on_init": "pnpm ce add-skill", "on_post_update": "pnpm ce add-skill && pnpm ce scaffold:sync" }
```

The user installs `composable.env` themselves (`pnpm add -D composable.env`)
THEN runs `indusk extensions add composable-env --from npm:composable.env`
to register it. There is no auto-detection of `ce.json` triggering
auto-install of composable.env — the extension exists in the wild
but it's discovered (and installed) only when the user knows to ask.

dawn-fde-toolkit has `"composable.env": "^1.34.1"` in devDeps.
Numero has `"composable.env": "^1.37.6"` in devDeps. Both projects
have it; both have `ce.json` and an `env/` tree. Neither was
auto-scaffolded.

### 3.6 Pain points — every manual step today

Numbered list of "things the user has to remember" between
`indusk init` and a working workbench:

1. Create the workbench directory itself (not an indusk init concern, but it's a step).
2. Run `indusk init` inside the workbench.
3. Create `production/` and `worktrees/` directories — neither is scaffolded.
4. Manually symlink each canonical client clone into `production/<repo>`. The path conventions (`~/code/lazer/avoca/<repo>` for dawn vs `~/code/sandbox/numero` for Numero) are personal.
5. Author `.indusk/worktree-configs/<repo>.json` from scratch — there is no template, no schema, no starter. (One example exists in dawn-fde-toolkit and is referenced as "see ... for shape".)
6. Author `env/contracts/<repo>.contract.json` + `env/components/<repo>.env` if using the composable.env FDE-overrides shape — neither is required by the worktree pattern itself, but they're how the toolkit ACTUALLY supplies the `append_files[].src` contents.
7. Install `pm2` as devDep (`pnpm add -D pm2`). Currently lives only in `dawn-fde-toolkit/package.json:25`.
8. Install `ajv` + `ajv-formats` for config validation (currently in dawn-fde-toolkit devDeps but unused by the scripts — possibly leftover from an earlier validator plan).
9. Drop the four scripts into `scripts/` — they don't ship anywhere.
10. Register the pnpm scripts in `package.json` (`wt`, `preflight` exist on dawn but NOT `wt:pm2`).
11. `.gitignore` `production/`, `worktrees/`, and `env/*.fde-overrides.env`.
12. Author the canonical-clone-parent-dir constant — today hardcoded in `setup-worktree.sh:33`. No config file declares it.

That's 12 manual steps. The extension subsumes the work
between (3) and (11) plausibly; (12) is the canonical-parent
question that the brief partially answers (config schema) but
doesn't formally specify a key for.

---

## 4. The delta — what the worktree extension's `on_enable` must scaffold

Synthesized from §1–3. This section enumerates artifacts the
extension must produce on `indusk extensions enable worktree`,
mapped to the test-plan assertions where applicable.

### 4.1 Files to drop on disk

Mapped from dawn-fde-toolkit's `scripts/`:

| Target | Source (dawn) | Notes |
|--------|--------------|-------|
| `scripts/wt.sh` | `setup-worktree.sh` analog | Decouple `SIBLING_PARENT` from hardcode; read from config. Slug resolver portable. |
| `scripts/wt-pm2.sh` | `wt-pm2.sh` | Portable; safe to copy as-is once `SIBLING_PARENT` is parameterized. |
| `scripts/setup-worktree.sh` (or rename) | `setup-worktree.sh` | The 157-line script. ⚠ Apply_commits is `git show <sha>:<file>`, not `git cherry-pick` — preserve actual behavior. |
| `scripts/refresh-worktree.sh` | `refresh-worktree.sh` | The 169-line idempotent re-runner. ⚠ Today does NOT clear skip-worktree flags for entries removed from config — A14 demands the extension fix this gap. |
| `scripts/preflight.sh` | `preflight.sh` | Strip Avoca-specific ESLint+Hamming hardcoded blocks; replace with `preflight_env{}` evaluator (A17). |

**Open question for ADR:** Bash vs TypeScript port. Brief §Phased
rollout suggests bash in v1, TS rewrite later. The TS rewrite
would (a) integrate naturally with indusk-mcp's lib/scm abstraction,
(b) test in vitest without subprocess overhead, (c) drop the `jq`
runtime dependency. The bash port is faster to ship. Test-plan
A1–A4 + A9–A11 are vitest integration tests — they need to run
something. If bash, vitest harnesses must subprocess via execSync;
if TS, they import the library directly.

### 4.2 package.json scripts to register

The extension's `on_enable` should mutate the workbench's root `package.json`:

```jsonc
{
  "scripts": {
    "wt": "scripts/wt.sh",            // or "node node_modules/.../wt.js" if TS port
    "wt:pm2": "scripts/wt-pm2.sh",     // NEW — dawn does not register this today
    "preflight": "scripts/preflight.sh"
  },
  "devDependencies": {
    "pm2": "^7.0.1",                  // for wt:pm2
    "ajv": "^8.20.0",                 // if extension does runtime schema validation
    "ajv-formats": "^3.0.1"
  }
}
```

Implementation: read package.json, merge in scripts + devDeps if
missing, write back. Print `pnpm install` instruction.

A16 asserts these exist + work post-enable.

### 4.3 Starter `.indusk/worktree-configs/<repo>.json`

Open question: which `<repo>` is the starter for? Three options:

- (a) The extension's `on_enable` does NOT scaffold a starter config — leaves the dir empty + prints "create a config per wrapped repo".
- (b) `on_enable` inspects `production/*` symlinks, scaffolds one starter per detected wrapped repo (basename derives `<repo>`, with `default_base_branch: "main"` + empty arrays).
- (c) `on_enable` prompts the user (impossible in non-interactive context); but if `production/` is empty, scaffold nothing.

**Confidence: moderate** that (b) is the right behavior — the
workbench shape says `production/<repo>` symlinks are the
declaration of which repos this workbench wraps. The extension
can detect them and scaffold.

Starter content (defaults):

```jsonc
{
  "$schema": "https://indusk.../schema/worktree-config.json",
  "repo": "<repo>",
  "branch_prefix": "feat/",
  "default_base_branch": "main",
  "copy_files": [],
  "append_files": [],
  "apply_commits": [],
  "preflight": [
    "if [ -n \"$CHANGED_FILES_BIOME\" ]; then pnpm exec biome check --no-errors-on-unmatched -- $CHANGED_FILES_BIOME; fi"
  ],
  "preflight_env": {},
  "post_create": ["pnpm install --prefer-offline --silent"]
}
```

A11 + A15 reference this scaffolding indirectly.

### 4.4 ce.json / env/components / env/contracts changes

The brief is explicit that v1 does NOT integrate composable.env
("Phase 3: composable.env integration. If composable.env stabilizes
as the recommended env-management pattern..."). So `on_enable`
should NOT mutate ce.json, env/components/, or env/contracts/ in v1.

But A8 (manual smoke) demands `pnpm ce wt:cancel-polish dc:up local`
works. That phrasing implies the `wt:<slug>` surface IS routed
through ce somehow. See open question in §2.5 — the routing
mechanism is unspecified.

**Open question for ADR (still the big one):** Is `wt:<slug>` a
pure pnpm-script convention (no ce involvement) and the brief's
`pnpm ce wt:<slug>` notation is shorthand? Or does ce gain
genuine knowledge of the `wt:` prefix?

If pure pnpm: `package.json` declares `"wt:cancel-polish": "scripts/wt.sh cancel-polish"`
... but slug list is unbounded, so this can't be statically
declared. Need a `wt:*` wildcard handler, which pnpm supports
since 7.13 (`"wt:*": ...`) but with no useful argument access.
**The wildcard approach won't work cleanly.**

If ce-mediated: ce ingests the worktree config schema and adds
`wt:` as a known prefix that resolves at command-dispatch time.
This requires composable.env upstream changes — explicitly out of
scope per test-plan ("ce-binary modifications" in §Notes line 69).

There's a third path: keep `pnpm wt <slug>` (no colon) as the
canonical invocation form, and let the brief's `pnpm ce wt:<slug>`
shorthand be aspirational documentation that maps onto whatever
ce's command-passthrough already does. dawn-fde-toolkit today
uses `pnpm wt <slug>` (without ce). **High confidence this is the
practical answer; the ADR needs to either confirm this or design
a deliberate ce extension point.**

### 4.5 gitignore additions

```
production/
worktrees/
env/*.fde-overrides.env             # if extension canonizes the fde-overrides naming
```

Use the same merge pattern as `init.ts:ensureGitignore` —
detect missing entries, append under a `# InDusk worktree extension` marker.

### 4.6 MCP server registrations

None expected (the brief doesn't propose any). Confirmed by
inspection of the brief's surface — no `mcp_server` block in
the proposed manifest.

### 4.7 Manual residue after `enable`

The user STILL has to:

1. Create `production/<repo>` symlinks themselves (the workbench's
   responsibility — the extension can't know which repos this
   FDE wraps). The starter-config scaffolding pass (§4.3) only
   runs if symlinks already exist.
2. Customize each starter `.indusk/worktree-configs/<repo>.json`
   to actually declare `copy_files`, `append_files`, etc.
3. Set up secrets / `.env.secrets.{shared,local}` if using
   composable.env-shaped overrides (which v1 doesn't enforce).
4. Run `pnpm install` after the extension adds devDeps.
5. First `pnpm wt create <repo> <slug>` (or whatever the lifecycle
   CLI shape lands on).

The brief's pitch is "from ~12 manual steps to ~5" — supportable
if the extension delivers §4.1 + §4.2 + §4.3 + §4.5.

---

## Open questions for the ADR (ranked)

1. **Big one: how does `pnpm ce wt:<slug> <cmd>` get routed?** Pure
   pnpm-script convention (`pnpm wt <slug> <cmd>` is the actual
   shape, ce notation is shorthand)? ce extension point (requires
   ce upstream changes — out of scope)? Some shim? This blocks
   A5, A6, A8.
2. **Where does the canonical-clone parent dir get declared?** Today
   hardcoded in `setup-worktree.sh:33` as `$HOME/code/lazer/avoca`.
   For Numero it'd be `$HOME/code/sandbox`. Should this be a
   top-level field in `.indusk/worktree-configs/<repo>.json`
   (`sibling_parent: "~/code/sandbox"`)? A per-workbench global
   in `.indusk/config.json`? Per-repo? Test-plan doesn't pin it.
3. **Bash vs TypeScript port.** Brief defers to a later phase; this
   plan ships v1. Bash is faster, keeps semantics 1:1 with proven
   scripts. TS integrates with indusk-mcp's lib/scm abstraction
   and tests in-process. Implementation cost differs by ~3x.
4. **What does the starter `.indusk/worktree-configs/<repo>.json` contain?**
   §4.3 sketches defaults; the ADR pins them.
5. **`.fde-overrides.env` naming convention — canonize or stay
   agnostic?** Affects whether the extension scaffolds composable.env
   contracts (per §1.4).
6. **Should `refresh-worktree.sh` (or its TS analog) clear
   skip-worktree flags for entries removed from `apply_commits[]`?**
   Today it does not (§1.3); A4 implicitly demands it. Fix-in-scope
   or carry forward?
7. **`SIBLING_PARENT` semantics for the trunk fallback.** `wt.sh`
   resolves `wt:<repo>` via `production/<repo>`, which is a
   symlink — wt.sh itself never reads `SIBLING_PARENT`. Only
   `setup-worktree.sh` and `refresh-worktree.sh` need to know the
   parent dir (to author worktrees as siblings of the canonical
   clone). The ADR should be explicit about which scripts depend
   on the parent-dir config.
8. **Where does `numero-workbench/` live on disk?** Sibling to
   `numero`? Under `~/code/sandbox/`? The test-plan says the impl
   creates it; the ADR should pin the path so the test fixture
   and the manual smoke (A13) refer to the same place.

---

## Provenance / sources cited

| Source | Used for |
|--------|----------|
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/scripts/setup-worktree.sh` (157 LOC) | §1.2, §1.3, §4.1 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/scripts/refresh-worktree.sh` (169 LOC) | §1.2, §1.3 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/scripts/wt.sh` (145 LOC) | §1.2, §2.5 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/scripts/wt-pm2.sh` (163 LOC) | §1.2 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/scripts/preflight.sh` (226 LOC) | §1.2, §1.5 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/.indusk/worktree-configs/avoca-next.json` | §1.3 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/.indusk/config.json` | §1.1 (scm=git) |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/ce.json` | §1.4 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/env/contracts/avoca-next.contract.json` | §1.4 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/env/components/avoca.env` | §1.4 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/.gitignore` | §1.1, §1.4 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/package.json` | §1.6, §4.2 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/.claude/lessons/workbench-symlink-pattern.md` | §1.1 |
| `/Users/the_dusky/code/lazer/dawn-fde-toolkit/.claude/lessons/worktree-creation-use-refresh-script.md` | §1.3, §1.6 |
| `/Users/the_dusky/code/sandbox/numero/package.json` | §2.3 |
| `/Users/the_dusky/code/sandbox/numero/ce.json` | §2.4 |
| `/Users/the_dusky/code/sandbox/numero/.git/worktrees/` listing | §2.2 |
| `/Users/the_dusky/code/sandbox/dusk/apps/indusk-mcp/src/bin/commands/init.ts` (1270 LOC) | §3.1 |
| `/Users/the_dusky/code/sandbox/dusk/apps/indusk-mcp/src/bin/commands/extensions.ts` (1002 LOC) | §3.2, §3.3 |
| `/Users/the_dusky/code/sandbox/dusk/apps/indusk-mcp/extensions/local-telemetry/manifest.json` | §3.4 |
| `/Users/the_dusky/code/sandbox/dusk/apps/indusk-mcp/extensions/dash0/manifest.json` | §3.4 |
| `/Users/the_dusky/code/sandbox/dusk/apps/indusk-mcp/extensions/local-telemetry/.env.example` | §3.4 |
| `/Users/the_dusky/code/sandbox/dusk/apps/indusk-mcp/extensions/dash0/.env.example` | §3.4 |
| brief: `/Users/the_dusky/code/sandbox/dusk/.indusk/planning/indusk-worktree-extension/brief.md` | survey framing |
| test-plan: `/Users/the_dusky/code/sandbox/dusk/.indusk/planning/indusk-worktree-extension/test-plan.md` | survey framing, A1–A17 assertions |
