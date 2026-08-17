```
███████╗ ██████╗ ███╗   ██╗██████╗ ███████╗██████╗ ██╗███████╗
██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔════╝██╔══██╗██║██╔════╝
█████╗  ██║   ██║██╔██╗ ██║██║  ██║█████╗  ██████╔╝██║█████╗
██╔══╝  ██║   ██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗██║██╔══╝
██║     ╚██████╔╝██║ ╚████║██████╔╝███████╗██║  ██║██║███████╗
╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝
```

# Fonderie — the control layer for AI-built software

**Every SaaS rebuilds the same infrastructure. AI just made it faster — and
less consistent.** Auth, billing, teams, permissions, messaging: every product
needs them, every LLM reinvents them, and it invents them differently every
session — different security decisions, none audited, thousands of tokens burned
on boilerplate instead of your product. Fonderie is the standard that ends the
re-derivation. Auth, workspaces, billing, messaging, permissions, events — each
an audited, reviewable brick that snaps into `@fonderie/core` and runs in
**your** process against **your** database. Install it and any assistant — Claude
Code, Cursor, Codex, Gemini CLI — builds on a backend it already knows,
correctly, every time.

The bet is the one HTTP made: standardize the boring parts. The web has GET,
POST, and a 404 nobody re-argues; the SaaS backend never got its equivalent.
Twenty years of engineering keeps re-deriving auth, API shape, and schema from
scratch, re-shipping the same security flaws — and LLMs made that faster, not
better. Faster horses. Fonderie is the engine: one open standard for the parts
every product shares, so founders spend themselves on the only part that's
actually theirs.

> **The wedge is the first five systems. The market is the entire infrastructure
> budget of every AI-built company.** We start where every SaaS starts — auth
> and billing, the two systems no product can launch without — and the same
> control layer extends to notifications, permissions, mobile, and every system
> the AI builds next.

Works the same without an LLM: it's plain TypeScript packages. Take one brick or
the whole set. What founders cast here is theirs. No seats, no rent. MIT.

## The skill

This repo ships a [Claude Code skill](.claude/skills/fonderie/SKILL.md)
that teaches an assistant to reach for `@fonderie/*` bricks instead of
hand-writing auth, billing, or permissions. Working inside this repo (or
any repo that vendors the skill), it loads automatically — say "add
subscriptions" and the assistant wires `@fonderie/billing` instead of
improvising Stripe glue.

The skill is three files with a strict generated/curated split:

| File | Role | Maintained by |
| --- | --- | --- |
| [`SKILL.md`](.claude/skills/fonderie/SKILL.md) | When to reach for which brick; composition rules of thumb | hand |
| [`API.md`](.claude/skills/fonderie/API.md) | Curated wiring guide: the `buildFonderie()` golden example, registered routes, adapter mounts | hand |
| [`SIGNATURES.md`](.claude/skills/fonderie/SIGNATURES.md) + [`signatures/`](.claude/skills/fonderie/signatures) | Exact public API, one file per package (agents load only what they wire) | **generated — never edit** |

## Quickstart

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { AuthModule } from '@fonderie/auth';
import { WorkspacesModule } from '@fonderie/workspaces';

const app = await new FonderieApp(defineConfig({ basePath: '/v1' }))
  .register(new AuthModule())
  .register(new WorkspacesModule())
  .boot();

app.listen(3000, { name: 'my-api' });
```

Already on Express, Hono, or Koa? The adapter bricks
(`adapter-express`, `adapter-hono`, `adapter-koa`) mount Fonderie inside
your existing app instead.

New here? The [Getting started guide](docs/GETTING-STARTED.md) walks
through install, booting an app, and adding bricks step by step.

## The bricks

| Package | What it is |
|---|---|
| [`@fonderie/adapter-express`](packages/adapter-express) | Express adapter for fonderie-js |
| [`@fonderie/adapter-hono`](packages/adapter-hono) | Hono adapter for fonderie-js |
| [`@fonderie/adapter-koa`](packages/adapter-koa) | Koa adapter for fonderie-js |
| [`@fonderie/audit`](packages/audit) | Workspace-scoped audit log |
| [`@fonderie/auth`](packages/auth) | Drop-in auth for SaaS |
| [`@fonderie/billing`](packages/billing) | SaaS billing in one module |
| [`@fonderie/client`](packages/client) | Isomorphic TypeScript client for Fonderie-powered APIs |
| [`@fonderie/config`](packages/config) | DB-backed feature flags and remote config |
| [`@fonderie/core`](packages/core) | Framework core |
| [`@fonderie/courier`](packages/courier) | Transactional messaging for SaaS |
| [`@fonderie/customers`](packages/customers) | Workspace-scoped customer records |
| [`@fonderie/events`](packages/events) | Event bus for @fonderie-js |
| [`@fonderie/logger`](packages/logger) | Structured logger with pluggable transports, child loggers, and a request-logging middleware |
| [`@fonderie/permissions`](packages/permissions) | Role-based access control for SaaS |
| [`@fonderie/rate-limit`](packages/rate-limit) | Distributed token-bucket rate limiting (memory/Postgres/Redis) |
| [`@fonderie/store`](packages/store) | Database abstraction layer |
| [`@fonderie/webhooks`](packages/webhooks) | Outgoing webhook engine |
| [`@fonderie/workspaces`](packages/workspaces) | Multi-tenant team layer |

## Frontend bricks

The standard doesn't stop at the API. Every capability ships **headless
bindings** — React hooks, Vue composables, React Native hooks, all thin layers
over [`@fonderie/client`](packages/client) — and, alongside them, **prebuilt
screens**. So the same assistant that wires `@fonderie/billing` on the backend
drops in a working subscription UI on the frontend, on whatever framework you
ship.

| Capability | React | React Native | Vue |
|---|:--:|:--:|:--:|
| Auth | ✓ | ✓ | ✓ |
| Billing | ✓ | ✓ | ✓ |
| Customers | ✓ | ✓ | ✓ |
| Workspaces | ✓ | ✓ | ✓ |
| Audit | ✓ | ✓ | ✓ |
| Webhooks | ✓ | ✓ | ✓ |
| Config admin | ✓ | — | ✓ |
| Courier admin | ✓ | — | ✓ |

Each ✓ is two packages — headless plus screens — e.g.
[`@fonderie/react-auth`](packages/react-auth) (hooks) and
[`@fonderie/react-auth-screens`](packages/react-auth-screens) (login, register,
forgot-password UI). Same pattern for `vue-*` and `react-native-*`. Take the
hooks and build your own UI, or take the screens and ship today.

## Secure by construction

Security is the whole reason a standard beats regenerated boilerplate: the
audited path is the default path. None of this is opt-in, and every claim is in
the source — read [`SECURITY.md`](SECURITY.md) and the package tests.

- **Auth fails closed.** A weak or placeholder JWT secret is fatal in
  production; the app refuses to boot rather than sign forgeable tokens.
- **Credentials done right.** bcrypt password hashing, TOTP MFA with secrets
  encrypted at rest (AES-256-GCM), and every session revoked on password change.
- **Least privilege by default.** Workspace-scoped RBAC with parameterized,
  tenant-isolated queries; rate limiting on by default in front of login,
  registration, reset, and MFA.
- **Tamper-evident audit trail.** The event log carries a keyed per-event HMAC —
  altered or forged history is detectable.
- **Privacy built in.** Per-user data export (SAR) and configurable retention /
  erasure for events and deleted accounts.
- **Hardened transport & supply chain.** HSTS and secure-by-default response
  headers; CI fails on high-severity advisories; releases publish over OIDC with
  signed [provenance](https://slsa.dev/) — no long-lived tokens.

## Measured

We ran a pre-registered benchmark — thresholds locked before any data —
building the same growing app (auth → billing → teams → a security pass)
three ways, three times each, on `claude-opus-4-8`: with the Fonderie
brain, with the full skill loaded, and from scratch with no Fonderie
knowledge. 36 sessions.

- **Fonderie-knowledge overhead: parity-plus, not a fraction.** The project
  brain carries only what the task touches, so the model spends more of its
  context on your product and less re-reading the SDK than the full skill
  does. Under the fair (resident-after-read) accounting, brain vs. full-skill
  ratio is **0.383** (amortized floor: 0.267), transcript-attributed — a real
  reduction, but not the ≤⅓ "fraction" this line originally claimed. (The ≤⅓
  goal is met by a newer lazy-router variant, not by the eager brain
  described here.) Full derivation and reconciliation:
  [`BATCH-RESULTS.md`](experiments/phase41-2026-07/BATCH-RESULTS.md).
- **Fewer security holes by default.** The from-scratch builds shipped an
  insecure hard-coded secret in **2 of 3** runs; the Fonderie builds, none —
  the audited brick reads it from the environment and throws if it's
  missing. And they did it in roughly **⅓ the code**.

Both the harness and the raw runs are in the repo:
[`experiments/phase41-2026-07/`](experiments/phase41-2026-07) —
`BATCH-RESULTS.md` for the numbers, `analyze.mjs` / `instrument.mjs` to
re-derive them. Re-run it and check.

## Development

```sh
npm install
npm run build              # build all workspaces
npm test                   # run all tests
npm run docs:signatures    # regenerate the skill's API reference from source
```

**Changed any package's public surface?** (new export, endpoint, config
field, constructor parameter) — run `npm run docs:signatures` and commit the
updated `.claude/skills/fonderie/SIGNATURES.md` + `signatures/` alongside your change. The
generator extracts signatures from `src/` with the TypeScript checker and its
output is deterministic, so CI can enforce freshness:

```sh
npm run docs:signatures && git diff --exit-code .claude/skills/fonderie/SIGNATURES.md .claude/skills/fonderie/signatures
```

Route tables and the wiring example in `API.md` are curated by hand — update
them when a module gains or changes an endpoint.

## Branching & releases

Work flows through `dev` and is promoted to `main`, which is the only branch
that publishes:

```
feature/*  ──PR──▶  dev   (CI runs; peer review)
dev        ──PR──▶  main  (CI runs; final review)
merge to main  ──▶  automated npm publish
```

- Add a [changeset](https://github.com/changesets/changesets) on your feature
  branch for any user-facing change: `npx changeset` (pick the packages and
  bump levels). It rides through `dev` to `main`.
- **CI** (`.github/workflows/ci.yml`) runs on every PR targeting `main` or
  `dev`, and on pushes to `main`: build, typecheck, tests (including the
  real Postgres + Redis concurrency tests for `@fonderie/rate-limit`), the
  `docs:signatures` freshness gate, and the validation audit.
- **Release** (`.github/workflows/release.yml`) runs **only on push to
  `main`**. It opens a "Version Packages" PR consuming pending changesets;
  merging that PR publishes to npm over OIDC Trusted Publishing with signed
  provenance. Nothing on `dev` (or any other branch) can publish.
- `main` should be a protected branch (require PRs + a green CI check, no
  direct pushes) so "only `main` publishes" is enforced, not just conventional.

To publish manually instead (e.g. before CI is set up): `npx changeset version`
then `npx changeset publish`.

[fonderiejs.com](https://fonderiejs.com) · follow [@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
