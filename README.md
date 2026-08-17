```
███████╗ ██████╗ ███╗   ██╗██████╗ ███████╗██████╗ ██╗███████╗
██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔════╝██╔══██╗██║██╔════╝
█████╗  ██║   ██║██╔██╗ ██║██║  ██║█████╗  ██████╔╝██║█████╗
██╔══╝  ██║   ██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗██║██╔══╝
██║     ╚██████╔╝██║ ╚████║██████╔╝███████╗██║  ██║██║███████╗
╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝
```

# Fonderie — the control layer for AI-built software

**Every SaaS rebuilds the same infrastructure — auth, billing, teams,
permissions, messaging. AI just made it faster, and less consistent.** Ask an
LLM to build it and you get a different version every session: different
security calls, nothing audited, thousands of tokens spent on boilerplate
instead of your product.

Fonderie is the standard that ends the re-derivation. Each piece — auth,
workspaces, billing, messaging, permissions, events — is an audited, reviewable
brick that snaps into `@fonderie/core` and runs in **your** process against
**your** database. Install it and any assistant (Claude Code, Cursor, Codex,
Gemini CLI) builds on a backend it already knows — the same way, every time.

It's the bet HTTP made: standardize the boring parts. The web has GET, POST, and
a 404 nobody re-argues. The SaaS backend never got its equivalent — so twenty
years of engineers keep re-deriving auth and re-shipping the same flaws, and LLMs
just do it faster. Fonderie is the missing standard, so you spend your time on
the only part that's actually yours.

> **The wedge is the first five systems. The market is the entire infrastructure
> budget of every AI-built company.** We start where every SaaS starts — auth and
> billing — and the same control layer extends to notifications, permissions,
> mobile, and everything the AI builds next.

No LLM required: it's plain TypeScript. Take one brick or the whole set. No
seats, no rent. MIT.

## The skill

This repo ships a [Claude Code skill](.claude/skills/fonderie/SKILL.md) that
teaches an assistant to reach for `@fonderie/*` bricks instead of hand-writing
auth, billing, or permissions. It loads automatically — say "add subscriptions"
and the assistant wires `@fonderie/billing` instead of improvising Stripe glue.

Three files, with a strict generated/curated split:

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

The standard doesn't stop at the API — Fonderie is end-to-end. Every capability
ships **headless bindings** (React hooks, Vue composables, React Native hooks —
thin layers over [`@fonderie/client`](packages/client)) and a matching set of
**prebuilt screens**. So the same assistant that wires `@fonderie/billing` on
the backend drops in a working subscription UI on the frontend, on whatever
framework you ship. Take the hooks and build your own UI, or take the screens
and ship today.

### React

| Package | What it is |
|---|---|
| [`@fonderie/react-auth`](packages/react-auth) | React hooks for Fonderie auth — thin bindings over @fonderie/client |
| [`@fonderie/react-auth-screens`](packages/react-auth-screens) | Pre-built React auth screens — login, register, forgot password |
| [`@fonderie/react-billing`](packages/react-billing) | React hooks for Fonderie billing |
| [`@fonderie/react-billing-screens`](packages/react-billing-screens) | Pre-built React billing screens — pricing table, subscription management |
| [`@fonderie/react-customers`](packages/react-customers) | React hooks for Fonderie customers |
| [`@fonderie/react-customers-screens`](packages/react-customers-screens) | Pre-built React customers screens — list, detail (contact info, notes, tags) |
| [`@fonderie/react-workspaces`](packages/react-workspaces) | React hooks for Fonderie workspaces |
| [`@fonderie/react-workspaces-screens`](packages/react-workspaces-screens) | Pre-built React workspaces screens — team members, invitations |
| [`@fonderie/react-audit`](packages/react-audit) | React hooks for the audit log |
| [`@fonderie/react-audit-screens`](packages/react-audit-screens) | Pre-built React audit screen — filterable, cursor-paginated event list |
| [`@fonderie/react-webhooks`](packages/react-webhooks) | React hooks for outgoing webhooks |
| [`@fonderie/react-webhooks-screens`](packages/react-webhooks-screens) | Pre-built React webhooks screens — endpoint list, delivery history |
| [`@fonderie/react-config-admin`](packages/react-config-admin) | React hooks for the config admin API (feature flags/remote config + secrets) |
| [`@fonderie/react-config-admin-screens`](packages/react-config-admin-screens) | Pre-built React config-admin screens — editor with revision history and rollback |
| [`@fonderie/react-courier-admin`](packages/react-courier-admin) | React hooks for the courier admin API (email/SMS/push templates) |
| [`@fonderie/react-courier-admin-screens`](packages/react-courier-admin-screens) | Pre-built React courier-admin screens — template editor with revisions and rollback |

### React Native

| Package | What it is |
|---|---|
| [`@fonderie/react-native-auth`](packages/react-native-auth) | React Native hooks for Fonderie auth |
| [`@fonderie/react-native-auth-screens`](packages/react-native-auth-screens) | Pre-built React Native auth screens — login, register, forgot password |
| [`@fonderie/react-native-billing`](packages/react-native-billing) | React Native billing hooks |
| [`@fonderie/react-native-billing-screens`](packages/react-native-billing-screens) | Pre-built React Native billing screens — pricing table, subscription management |
| [`@fonderie/react-native-customers`](packages/react-native-customers) | React Native customers hooks |
| [`@fonderie/react-native-customers-screens`](packages/react-native-customers-screens) | Pre-built React Native customers screens — list, detail |
| [`@fonderie/react-native-workspaces`](packages/react-native-workspaces) | React Native workspaces hooks |
| [`@fonderie/react-native-workspaces-screens`](packages/react-native-workspaces-screens) | Pre-built React Native workspaces screens — team members, invitations |
| [`@fonderie/react-native-audit`](packages/react-native-audit) | React Native hooks for the audit log |
| [`@fonderie/react-native-audit-screens`](packages/react-native-audit-screens) | Pre-built React Native audit screen — filterable, cursor-paginated event list |
| [`@fonderie/react-native-webhooks`](packages/react-native-webhooks) | React Native hooks for outgoing webhooks |
| [`@fonderie/react-native-webhooks-screens`](packages/react-native-webhooks-screens) | Pre-built React Native webhooks screens — endpoint list, delivery history |

### Vue

| Package | What it is |
|---|---|
| [`@fonderie/vue-auth`](packages/vue-auth) | Vue composables for Fonderie auth — thin bindings over @fonderie/client |
| [`@fonderie/vue-auth-screens`](packages/vue-auth-screens) | Pre-built Vue auth screens — login, register, forgot password |
| [`@fonderie/vue-billing`](packages/vue-billing) | Vue 3 composables for Fonderie billing |
| [`@fonderie/vue-billing-screens`](packages/vue-billing-screens) | Pre-built Vue billing screens — pricing table, subscription management |
| [`@fonderie/vue-customers`](packages/vue-customers) | Vue 3 composables for Fonderie customers |
| [`@fonderie/vue-customers-screens`](packages/vue-customers-screens) | Pre-built Vue customers screens — list, detail (contact info, notes, tags) |
| [`@fonderie/vue-workspaces`](packages/vue-workspaces) | Vue 3 composables for Fonderie workspaces |
| [`@fonderie/vue-workspaces-screens`](packages/vue-workspaces-screens) | Pre-built Vue workspaces screens — team members, invitations |
| [`@fonderie/vue-audit`](packages/vue-audit) | Vue 3 composables for the audit log |
| [`@fonderie/vue-audit-screens`](packages/vue-audit-screens) | Pre-built Vue audit screen — filterable, cursor-paginated event list |
| [`@fonderie/vue-webhooks`](packages/vue-webhooks) | Vue 3 composables for outgoing webhooks |
| [`@fonderie/vue-webhooks-screens`](packages/vue-webhooks-screens) | Pre-built Vue webhooks screens — endpoint list, delivery history |
| [`@fonderie/vue-config-admin`](packages/vue-config-admin) | Vue 3 composables for the config admin API (feature flags/remote config + secrets) |
| [`@fonderie/vue-config-admin-screens`](packages/vue-config-admin-screens) | Pre-built Vue config-admin screens — editor with revision history and rollback |
| [`@fonderie/vue-courier-admin`](packages/vue-courier-admin) | Vue 3 composables for the courier admin API (email/SMS/push templates) |
| [`@fonderie/vue-courier-admin-screens`](packages/vue-courier-admin-screens) | Pre-built Vue courier-admin screens — template editor with revisions and rollback |

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

We don't just claim it — we benchmarked it. Thresholds locked before any data,
then the same growing app (auth → billing → teams → a security pass) built three
ways, three times each, on `claude-opus-4-8`. 36 sessions.

- **Fewer holes, less code.** From-scratch builds shipped a hard-coded secret in
  **2 of 3** runs; the Fonderie builds, zero — the audited brick reads it from
  the environment and throws if it's missing. And in roughly **⅓ the code**.
- **The SDK earns its context.** The project brain loads only what a task
  touches, so the model spends its budget on your product, not re-reading the
  SDK — a **0.383** context ratio vs. the full skill (fair, resident-after-read
  accounting). Full derivation:
  [`BATCH-RESULTS.md`](experiments/phase41-2026-07/BATCH-RESULTS.md).

Harness and raw runs are all in [`experiments/phase41-2026-07/`](experiments/phase41-2026-07).
Re-run it and check — that's the point.

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
