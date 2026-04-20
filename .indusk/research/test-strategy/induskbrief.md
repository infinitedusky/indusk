---
title: "test strategy — InDusk convention"
date: 2026-04-20
status: accepted
audience: InDusk
---

# test strategy — InDusk convention

This document describes a convention for the **project-level testing layer** in a TypeScript monorepo — the tests that span services. It's written for InDusk to consume and turn into boilerplate that future projects inherit by default. Nothing below is numero-specific.

**Scope of this convention: integration tests + end-to-end tests.** Tests that belong to a single service (unit tests) are the service's own concern — each service owns its vitest config, colocates tests with source, and ships its own `pnpm test`. This convention doesn't prescribe how services test themselves.

## Problem this convention solves

Most TypeScript monorepos handle unit testing fine — each service adds vitest and writes `*.test.ts` next to the code. The problem is the **seam between services**: integration tests that need two or three services running together, and end-to-end tests that need a browser driving the UI.

Without a convention, that layer ends up as:

1. A custom runner ("too complex for regular unit-test libs, let's roll our own"). Hand-formatted assertion errors, bespoke CLI flags, no IDE integration.
2. Standalone scripts with per-file `?? 'localhost:...'` env fallbacks that mask misconfiguration.
3. No browser e2e at all — or an orphan Playwright setup nobody maintains.

Each new contributor has to learn three conventions. Each failure diagnoses differently. Env loading gets reinvented per file.

The fix is structural: pick two runners (one for integration, one for e2e), give each a clear home, and lay out the folder structure so every cross-service test has an obvious place.

## The convention

### Three test categories

| Type | Owner | What it is | Location | Runner |
|---|---|---|---|---|
| **Unit** | The service | In-process, service-scoped. No cross-service I/O. | Inside each app/package (colocated or `__tests__/`). | vitest (service's own config). |
| **Integration** | The project | Cross-service, real DB + HTTP + WS, no browser. | `{test-package}/<domain>/*.test.ts` | **vitest** (project-level config). |
| **End-to-end** | The project | Browser-driven user flows. Real UI, real user interaction. | `{test-package}/e2e/*.spec.ts` | **`@playwright/test`**. |

Rationale:

- **Unit testing is the service's problem.** Each service knows its own dependencies and mocking needs. A project-level convention would fight the service's autonomy. Let services use vitest however fits them. Use `turbo test` at the root to fan out.
- **One runner for integration (vitest).** Same `describe` / `it` / `expect` vocabulary as unit tests. Developers don't context-switch when a test's scope grows from one service to many.
- **Playwright owns e2e.** Its trace viewer, video recording, and `codegen` selector generation are purpose-built for browser orchestration. Vitest Browser Mode exists but sacrifices those tools — they're the main reason Playwright's dedicated runner is worth the second config.
- **No custom runners.** If someone proposes a bespoke `runner.ts` for scenario discovery / skip flags / filtering, they're reinventing vitest's CLI. The symptom is usually "we need fancy lifecycle stuff" — `beforeAll` / `afterAll` / `beforeEach` cover 99% of it.

### The `{test-package}` package

Every project gets a project-level test package at the repo root:

```
{test-package}/
├── package.json              # own devDeps: vitest, @playwright/test, @types/*, etc.
├── tsconfig.json             # extends root; ES2022 + node types
├── vitest.config.ts          # shared config for integration tests
├── setup.ts                  # loads env + validates before test imports
├── env.ts                    # typed, validated env export
├── <domain>/                 # one folder per bounded context
│   ├── scenario-a.test.ts
│   └── scenario-b.test.ts
└── e2e/
    ├── playwright.config.ts
    └── *.spec.ts
```

- **It's a pnpm workspace entry.** `pnpm-workspace.yaml` includes the package so it has its own `devDependencies` instead of hitching on the root.
- **Own tsconfig.** Keeps the main `tsconfig.json` free of vitest types and test-only settings.
- **No `unit/` folder.** Unit tests belong with their service. If a cross-module unit test exists that truly doesn't fit any single service, it can go in a sub-folder, but the expected state is zero units in `{test-package}/`.

### vitest configuration (integration tests)

The canonical config for the project-level integration layer:

```ts
// {test-package}/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share real infrastructure (DB, services).
    // Serialize everything so two tests don't step on each other's state.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },

    // WebSocket round-trips + on-chain confirmations + real HTTP make
    // per-test budgets longer than typical unit tests.
    testTimeout: 120_000,
    hookTimeout: 30_000,

    globals: true,
    setupFiles: ['./setup.ts'],
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
```

Key decisions:

- **`fileParallelism: false` + `singleFork`** — integration tests typically share a Postgres instance or a dev-server process. Parallel runs cause cross-contamination.
- **`testTimeout: 120_000`** — integration tests spend real wall-clock time on network.
- **`setupFiles: ['./setup.ts']`** — runs once before any test file imports. Env loading + validation lives here.
- **Exclude `e2e/`** — Playwright has its own config and discovery. vitest mustn't scan e2e files.

### Env-loading pattern

Integration + e2e tests need host-side URLs (the DB, backend services, RPC endpoints). The pattern:

1. **A build-time env generator writes a `.env.local` file** with validated host-side values. In numero this is the `composable.env` (`ce`) contract system. In simpler projects it could be a script or a Makefile target. The key property: **the env file is built from structured config**, never hand-written with hardcoded fallbacks.
2. **`setup.ts` loads that file into `process.env`** before any test file imports.
3. **`env.ts` validates every required var at import time** and exports a typed object. Missing vars throw with the specific name.
4. **Tests import `env` from `env.ts`** — never `process.env.X ?? 'fallback'`.

Skeleton:

```ts
// {test-package}/env.ts
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[test/env] ${name} is not set. ` +
      `Regenerate the env file, then re-run the tests.`,
    );
  }
  return value;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  API_URL: required('API_URL'),
  // ... etc
} as const;
```

```ts
// {test-package}/setup.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '{env-file-relative-path}');
const raw = readFileSync(envPath, 'utf-8');
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) continue;
  const key = trimmed.slice(0, separatorIndex);
  const value = trimmed.slice(separatorIndex + 1);
  if (process.env[key] === undefined) process.env[key] = value;
}

// Triggers validation — throws on any missing required var.
await import('./env.js');
```

**No `?? 'http://localhost:...'` fallbacks anywhere.** Missing env is a startup error, not a silent mis-route.

### Playwright configuration (e2e tests)

The e2e slot is its own config, its own devDep, its own folder:

```ts
// {test-package}/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false, // same sequential semantics as integration
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Optional: let Playwright boot the dev server. Some projects prefer
    // to depend on docker-compose already running.
    command: 'pnpm dev',
    port: {APP_PORT},
    reuseExistingServer: true,
  },
});
```

Scripts in `{test-package}/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test --config e2e/playwright.config.ts"
  }
}
```

### Root `package.json` aliases

```json
{
  "scripts": {
    "test": "turbo test",
    "test:integration": "pnpm --filter {test-package-name} test",
    "test:e2e": "pnpm --filter {test-package-name} test:e2e"
  }
}
```

- `test` — fans out across all packages/apps via turbo, runs every service's unit tests.
- `test:integration` — project-level integration tests only.
- `test:e2e` — project-level e2e tests only.

Running `pnpm vitest run` at the root would pick up every vitest config in the monorepo (unit + integration) which is usually not what you want. Use the filtered scripts instead.

## Anti-patterns to avoid

1. **Custom runners for integration tests.** If someone proposes a bespoke `runner.ts` with scenario discovery + pass/fail reporting, they're reinventing vitest's CLI. Resist it.
2. **`process.env.X ?? 'http://localhost:...'`.** Never. Missing env is fail-loud at startup, always.
3. **Putting cross-service tests in a service's `__tests__/`.** That folder is the service's unit-test territory. Cross-service tests belong in the project-level `{test-package}/`.
4. **Golden-file helpers that reinvent snapshots.** Vitest has `expect(x).toMatchSnapshot()` and a `--update` flag. Use them.
5. **Running e2e through Vitest Browser Mode to "unify runners."** Technically possible, but you lose Playwright's trace viewer / codegen / video recording — the tools that make debugging flaky browser tests tractable.
6. **Using Vitest's default parallel execution for integration tests.** Shared DB / shared services need sequential runs. `fileParallelism: false` + `singleFork` must be the default, not an afterthought.
7. **Prescribing how services test themselves.** Per-service unit testing is each service's own business. The project-level convention doesn't reach into `apps/*/src/__tests__/`.

## What InDusk should scaffold

When creating a new project, InDusk should produce:

- **`{test-package}/` directory** with `package.json`, `tsconfig.json`, `vitest.config.ts`, `setup.ts`, `env.ts`, and an `e2e/` folder with `playwright.config.ts`.
- **`pnpm-workspace.yaml`** including `{test-package}` (or equivalent path).
- **`{test-package}/package.json`** devDeps: `vitest`, `@playwright/test`, `@types/node`, plus env-validation dependencies appropriate to the stack (e.g., `pg` for Postgres, `ioredis` for Redis).
- **Root `package.json` scripts**: `test` (turbo fan-out), `test:integration` (filtered), `test:e2e` (filtered).
- **CLAUDE.md Conventions section entry** describing the unit / integration / e2e split with ownership:
  - Unit = the service owns it.
  - Integration = project-level, lives in `{test-package}/<domain>/`.
  - E2E = project-level, lives in `{test-package}/e2e/`.
- **`apps/docs/guide/testing.md`** (or equivalent project-docs location) with a decision tree:
  ```
  Is a browser involved?
  ├── Yes → e2e (Playwright, {test-package}/e2e/)
  └── No
      ├── Does it need multiple services running?
      │   ├── Yes → integration (vitest, {test-package}/<domain>/)
      │   └── No → unit (vitest, inside the service)
  ```
- **An env-file generation contract** (ce-equivalent) writing the host-side env that `{test-package}/setup.ts` loads.

## What InDusk should NOT scaffold

- **Service-level unit tests or configs.** Each service adds its own when it needs them.
- **Actual integration / e2e scenarios.** Domain-specific; scaffolding examples risks them being copied into production tests that don't fit.
- **Custom matchers / BDD wrappers.** Keep the surface small.
- **CI configuration.** Testing is project-local until someone needs CI — then the project adds it.

## Open questions for InDusk to resolve

- **Env-file generator abstraction.** In numero it's `composable.env`; other projects might use `dotenv-flow`, a plain `.env.example` template, or something else. The InDusk scaffold should enforce the pattern ("some tool writes a `.env.local` that `setup.ts` loads") but allow per-project choice of tool.
- **Default `singleFork: true`?** Always-on is safer — it's a minor perf cost for integration-light projects. Always-off requires the project to know when they grow into needing it. Recommend always-on.
- **Playwright webServer block.** Some projects run `docker-compose up` before tests and want Playwright to `reuseExistingServer`. Others want Playwright to boot the dev server itself. The scaffold should produce a commented-out template and let the project uncomment the branch that fits.
- **Versioning.** Does the `{test-package}` convention get InDusk-versioned plans (so projects can migrate between convention versions), or is it a one-time template applied at scaffold? Plan is more maintainable long-term; template is simpler for v1.

---

# Part 2 — Preventing test/reality drift

Part 1 settled WHERE tests live and WHICH runners run them. Part 2 is about the harder question: how do you keep those tests from lying to you.

## The failure pattern

During numero's `chain-of-custody-4` plan, game-server was made wallet-agnostic (four grep invariants enforced it structurally). Admin-server was supposed to be the other half — own every wallet-shaped value on behalf of the chain layer — but shipped with a residual shortcut in the withdraw path:

```ts
// admin-server/src/routes/withdraw.ts (as shipped)
// "In Phase 3 it's still a wallet (the playerId is the seated-wallet-lowercased)."
player: playerId as `0x${string}`
```

Game-server treated `playerId` as opaque (correct). Admin-server treated it as a wallet address (incorrect). The inconsistency shipped anyway because the integration harness was doing this:

```ts
// harness/dsl.ts (as shipped)
const playerId = (user.wallet && /^0x[0-9a-fA-F]{40}$/.test(user.wallet))
  ? user.wallet.toLowerCase()   // ← happens to match admin-server's broken assumption
  : user.email.split('@')[0];
```

Every withdraw test sent a wallet-shaped `playerId`. Admin-server's bad `as 0x${string}` cast happened to work. The harness's regression suite was green. The whole "game-server zero wallet awareness" invariant was marked `passing` in the trajectory.

Six weeks later a new UI (written to actually honor the wallet-agnostic invariant) sent `{userId}:{tableCode}` as playerId. Admin-server's withdrawFor call failed with `is not a valid address`. Two implementation layers had diverged silently; two tests colluded with the divergence to hide it.

## The root cause in one sentence

**The test DSL contained logic that belonged in the UI.** The harness's `connect()` computed playerId from wallet. The real UI computed playerId differently. The server-side assumption was tested against the DSL's version and shipped against the UI's version. Every duplicated implementation is a potential collusion point.

## Five mechanisms to prevent this, strongest first

### 1. Shared client library between UI and integration tests

Anywhere the UI computes a wire-format value (identifier derivation, message envelope, permit signing, payload schema), that code lives in a shared package that BOTH the UI AND the integration test DSL import.

Not "the DSL reimplements the same thing." The DSL calls the same function.

```
packages/client/           ← new shared package (or existing, e.g. ws-client)
├── buildPlayerId.ts       ← one definition
├── signPermit.ts
└── buildEnterMessage.ts

apps/{ui}/hooks/useSocket.ts
└── imports buildPlayerId    ← uses it

{test-package}/{domain}/dsl.ts
└── imports buildPlayerId    ← uses it
```

When the UI changes convention (say it switches playerId from `userId:tableCode` to just `userId`), the tests fail to compile if they reimplemented the old convention. They auto-follow if they import the shared function.

**InDusk scaffold implication:** when a project has both a UI and an integration harness that share any wire-format logic, a `packages/client/` (or equivalent) must exist and both must import from it. No test DSL owns wire-shape logic that doesn't also ship to production.

### 2. Branded opaque types at service boundaries

When a service treats a value as opaque, its type system should say so. Not in a comment. In the type.

```ts
// shared types package
export type OpaqueClientId = string & { readonly __brand: 'OpaqueClientId' };

// admin-server consumes it — the cast becomes visible
const row = await db.select({ playerId: tablePlayers.playerId }).from(...);
const playerId: OpaqueClientId = row.playerId as OpaqueClientId;
// ...
const player = playerId as unknown as `0x${string}`;  // ← NOW the reviewer sees a problem
```

The numero bug was pre-commented: `// In Phase 3 it's still a wallet`. Prose doesn't block commits. Types do.

**InDusk scaffold implication:** the `types` package (every project has one) defines branded types for opaque cross-boundary identifiers. Treating an opaque value as a shaped one requires an explicit, visible cast.

### 3. Adversarial fixture injection

Every integration test asserting a server invariant ("this is opaque", "this accepts any valid X", "this is wallet-agnostic") needs a sibling test with DELIBERATELY different-shaped input — whatever the wire protocol permits.

```ts
describe.each([
  { name: 'wallet-shaped playerId (legacy UI)',     build: (u) => u.wallet.toLowerCase() },
  { name: 'composite playerId (wallet-agnostic UI)', build: (u) => `${u.userId}:${tableCode}` },
  { name: 'email-prefix playerId (agent legacy)',   build: (u) => u.email.split('@')[0] },
])('withdraw with $name', ({ build }) => {
  it('settles regardless of playerId shape', async () => { ... });
});
```

This tests the SERVER invariant, not the DSL's happy path. Every permitted variation gets exercised. Server code that depends implicitly on one shape fails immediately on the others.

**InDusk scaffold implication:** none directly — this is a discipline, not a tool. But the induskbrief's testing guide should call out "invariant tests use parametrized fixtures covering the wire-protocol's full input space" as a required pattern.

### 4. End-to-end smoke in CI as a tie-breaker

Integration tests verify the server against a DSL. E2E tests verify the server against the real UI through a browser. When integration passes but E2E fails, you've caught DSL/UI drift — not by auditing the DSL, but by bypassing it.

One Playwright smoke test per critical flow (sign in → core action → verify success) is cheap insurance against every DSL convenience. The smoke test runs whatever the real UI emits. The DSL can't cheat on its behalf.

**InDusk scaffold implication:** `{test-package}/e2e/` isn't optional polish — it's a structural safety net. The scaffold should produce at least one E2E smoke placeholder that the project fills in for each critical flow.

### 5. Retroactive invariant audits

When a plan closes and the retrospective marks rows `passing`, those claims must survive scrutiny. Specifically: "is this claim verified by a test that uses realistic inputs, or by a test whose DSL happens to match the server's assumption?"

The audit question is simple: **"what does our test DSL hardcode that a real client might not?"**

If the DSL has a shortcut, audit the server code the shortcut interacts with. Those are the invariants that might ship broken.

**InDusk scaffold implication:** retrospective templates include a "DSL collusion audit" question. A plan cannot close without answering it.

## The anti-pattern catalog, restated

Add these to Part 1's "anti-patterns to avoid":

1. **Test DSL functions that compute wire-format values.** If the DSL has `buildPlayerId(user)`, it's a divergence trap. That function belongs in a shared package the UI also imports.
2. **Wire-format casts in servers without branded types.** `as '0x{string}'` on a value the server treats as opaque is invisible in PR review. Use branded types so the cast is syntactically loud.
3. **Invariant tests that only use the convenient input shape.** A "this works with any playerId" test that only runs with wallet-shaped playerIds doesn't test the invariant — it tests the convenient case.
4. **Integration-only confidence.** Green integration suites without E2E confirmation means all you know is "the server agrees with the DSL." Whether the DSL agrees with reality is untested.
5. **Trajectory rows marked `passing` based on tests with server-colluding DSLs.** A passing test whose DSL mirrors the server-side assumption under test is not a passing test — it's a circular assertion.

## What InDusk must encode to enforce Part 2

- **Scaffold a shared client library package** from day one. Don't wait for a second consumer to emerge and then "extract" it. The UI writes wire-format logic there; tests import from there. If there's only one consumer today, the package still exists and stays thin.
- **Scaffold branded-type helpers** in the types package. A convenience `brand<T>(value: string, name: string): T` that makes creating branded types one line, so there's no excuse to default to bare `string`.
- **Scaffold a `describe.each` example** in the integration test template showing the adversarial-fixture pattern. Copy-pasteable baseline.
- **Scaffold an E2E smoke placeholder** — a failing Playwright test that prints "implement this smoke test before shipping." Turning CI green requires actually writing it.
- **Retrospective template includes the DSL collusion audit question.** Can't close a plan without answering it.
- **Plans that touch a cross-service boundary** (new invariant, new wire field, new service interaction) require a Part 2 declaration in their ADR: "what assumptions must NOT drift between layers, and what test enforces each?"

## Integration tests ARE the territory, or they lie

The core frame: **integration tests exist to ensure the map matches the territory.** When an integration test passes, the claim is "in a real deployment, this would work." If the DSL used by the test diverges from how real clients behave, the test is no longer about the territory — it's about the DSL. The test becomes a mirror for the server's own assumptions instead of a check on them.

Every mechanism in Part 2 is a way to keep the DSL from becoming a mirror. The enforcement is structural (shared packages, branded types), behavioral (adversarial fixtures, E2E smoke), and procedural (audit questions in retrospectives). InDusk should scaffold all three.
