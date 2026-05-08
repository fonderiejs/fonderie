# Fonderie Packages — Levelling Up Game Plan

> Source of truth: `FONDERIE.md` (architecture law) + `microservices/api` (implementation reference).
> This document is the single authoritative plan. Update it as decisions change.

---

## Guiding Principles

1. **All packages depend only on `@fonderie-js/core` and `@fonderie-js/store`.** No sibling imports.
   Cross-package communication happens exclusively through `ctx.meta`.
2. **`ctx.meta` is the typed message bus.** Auth sets `ctx.user`. Permissions sets its engine key.
   Courier reads `ctx.meta['message']`. Workspace context sets `ctx.workspace`.
3. **API as source of truth for schemas and logic.** The packages ship the same guarantees,
   expressed as composable library code rather than a monolithic service.
4. **Migrations are append-only and idempotent.** No down migrations in packages.
   `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING` everywhere.
5. **Each package owns its SQL tables.** No package queries another package's tables via raw SQL.
   Cross-boundary reads happen through the owning package's service functions only.
6. **Permissions can exist without roles. Roles cannot exist without permissions.**
   A permission key (`WORKSPACE`, `WORKSPACE_ROLE`, etc.) is a named capability that exists
   as a concept independent of any role. A role without permissions is an empty shell —
   it must be seeded with permissions at creation time. System roles (ADMIN, GUEST)
   are created by the workspaces migration and immediately seeded with permissions
   via `fonderie_role_permissions` in the same transaction.
7. **Workspace identity is carried in the `X-Workspace-ID` header.**
   The API resolves workspace context in this priority order:
   `X-Workspace-ID` header → `?workspace=` query param → `/:workspaceId` URL param.
   The current package implementation reads only from URL params — this is wrong and
   must be corrected in every route that requires workspace context.

---

## Schema Ownership Map

```
fonderie_migrations               → @fonderie-js/store
fonderie_users                    → @fonderie-js/auth
fonderie_email_verifications      → @fonderie-js/auth
fonderie_password_resets          → @fonderie-js/auth
fonderie_sessions                 → @fonderie-js/auth        (missing — must add)
fonderie_mfa_challenges           → @fonderie-js/auth        (missing — must add)
fonderie_role_permissions         → @fonderie-js/permissions  (owns the CRUD bit schema)
fonderie_workspaces               → @fonderie-js/workspaces
fonderie_roles                    → @fonderie-js/workspaces   (owns the role definition)
fonderie_workspace_members        → @fonderie-js/workspaces
fonderie_workspace_invitations    → @fonderie-js/workspaces
fonderie_plans                    → @fonderie-js/billing
fonderie_subscriptions            → @fonderie-js/billing
fonderie_usage_records            → @fonderie-js/billing
fonderie_courier_templates        → @fonderie-js/courier      (currently in workspaces — wrong)
fonderie_message_log              → @fonderie-js/courier      (missing — must add)
fonderie_config                   → @fonderie-js/config
```

**Permission schema (API source of truth — CRUD bit pattern, not action/resource pairs):**
```sql
fonderie_role_permissions (
  workspace_id   UUID        NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  role_id        UUID        NOT NULL REFERENCES fonderie_roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(50) NOT NULL,   -- named resource: WORKSPACE, WORKSPACE_ROLE, etc.
  can_create     BOOLEAN     NOT NULL DEFAULT false,
  can_read       BOOLEAN     NOT NULL DEFAULT false,
  can_update     BOOLEAN     NOT NULL DEFAULT false,
  can_delete     BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key),
  UNIQUE (role_id, workspace_id, permission_key)
)
```
This replaces the current `action TEXT / resource TEXT` pair pattern in the packages.

**Multi-role schema (API v2.0.0 migration — March 7, 2026):**
```sql
-- fonderie_workspace_members must support multiple roles per user
-- Drop: UNIQUE (user_id, workspace_id)
-- Replace with: PRIMARY KEY (user_id, workspace_id, role_id)
-- Add index: (user_id, workspace_id) for query performance
```

---

## Execution Order & Dependency Map

```
0. core          ← no dependencies
1. store         ← no dependencies
2. auth          ← core, store
3. permissions   ← core, store   [fonderie_role_permissions must exist before workspaces seeds roles]
4. workspaces    ← core, store   [fonderie_roles + fonderie_workspace_members + seeds ADMIN/GUEST with permissions]
5. courier       ← core, store
6. billing       ← core, store
7. config        ← core, store
```

Runtime registration order (from SDK doc wiring example) differs from build order:
```typescript
app
  .register(new RemoteConfigModule(store))   // 1st — all others may read config
  .register(new AuthModule(store, authCfg))
  .register(new PermissionsModule(store))
  .register(new WorkspacesModule(store))
  .register(new CourierModule(store, courierCfg))
  .register(new BillingModule(store, billingCfg))
```

---

## Package Scopes

---

### 0. `@fonderie-js/core`

**Role:** Request lifecycle, middleware pipeline, framework adapters, shared contracts.

#### Violations to fix

| Issue | File | Action |
|---|---|---|
| `ICourierMessage` lives in `@fonderie-js/courier` | `courier/src/types.ts` | Move to `core/src/types.ts` — it is a dispatch contract, not a courier implementation detail |
| `ctx.meta` is `Record<string, unknown>` — well-known keys are untyped | `core/src/types.ts` | Add typed well-known keys to `IFonderieContext` |
| Missing exports from SDK Package Overview | `core/src/index.ts` | Add `bodyParserMiddleware`, `corsMiddleware`, `loggerMiddleware`, `defineConfig` |
| Tests use Jest | `core/src/__tests__/` | Migrate to `tsx --test` (Node test runner) |

#### Additions

**Move `ICourierMessage` to core:**
```typescript
// core/src/types.ts — add alongside IFonderieContext
export interface ICourierMessage {
  type:      string
  locale?:   string                          // en-US | fr-CA — add for bilingual support
  recipient: { email: string | null; phone: string | null; deviceToken: string | null }
  data:      Record<string, unknown>
}
```

**Type well-known `ctx.meta` keys:**
```typescript
// core/src/types.ts — augment IFonderieContext
export interface IFonderieContext {
  request:            Request
  meta: {
    body?:            Record<string, unknown>
    query?:           Record<string, string>
    params?:          Record<string, string>
    message?:         ICourierMessage         // courier reads this
    [PERMISSIONS_ENGINE_KEY]?: PermissionsEngine  // permissions sets this
    [key: string]:    unknown
  }
  readonly tenant:    ITenant | null
  readonly user:      IAuthUser | null
  readonly workspace: IWorkspace | null
  _router:            IRouter
}
```

**Add shared response helpers** (port from `api/lib/utils/helpers/responseHelpers.ts`):
- `setApiResponse(status, data)` — standard success envelope
- `setErrorResponse(status, reason, explanation)` — standard error envelope
- `IApiError` interface

**Add `parser` utility** (port from `api/lib/utils/parser.ts`):
- `stringOrEmpty(val): string`
- `booleanOrFalse(val): boolean`
- `arrayOrEmpty<T>(val): T[]`
- `numberOrZero(val): number`

#### tsconfig conventions to enforce
```json
{
  "strict": true,
  "exactOptionalPropertyTypes": true,
  "verbatimModuleSyntax": true
}
```

---

### 1. `@fonderie-js/store`

**Role:** Database adapter, migration runner, `sql` tagged-template helper.

#### Violations to fix

| Issue | File | Action |
|---|---|---|
| Tests use Jest | `store/src/__tests__/` | Migrate to `tsx --test` |
| No per-package migration path export | `store/src/index.ts` | Define `getMigrationsPath()` convention so consumer apps compose migrations from each package |

#### Confirm correct (per SDK doc)
- Append-only migrations — no down migration support, by design
- `IStoreAdapter`: `query<T>()` + `transaction()` — correct contract, no changes
- `MigrationRunner`: reads `.sql` files lexicographically, applies pending — correct

#### Additions (from `api/lib/utils/database/`)
- Connection pool configuration options on `PGAdapter` constructor: `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` — currently hardcoded
- `sql` tagged template helper: verify it enforces parameterization and never allows string interpolation of user input

---

### 2. `@fonderie-js/auth`

**Role:** JWT, session, OAuth, MFA, password reset, email verification.

#### Violations to fix

| Issue | File | Action |
|---|---|---|
| `import type { ICourierMessage } from '@fonderie-js/courier'` | `handlers/register.ts`, `handlers/forgot-password.ts` | Change to `@fonderie-js/core` |
| Duplicate `forget-password.ts` (typo) alongside `forgot-password.ts` | `handlers/` | Delete `forget-password.ts` |
| Tests use Jest | `src/__tests__/` | Migrate to `tsx --test` |
| No DTOs — handlers return raw DB rows | all handlers | Add DTO layer |
| Inline validation only — no normalizer functions | all handlers | Add `validateAndNormalize*` functions |

#### Schema gaps vs. API source of truth

`fonderie_users` is missing columns (ref: `api/private/migrations/20260101000000_baseline-schema.up.sql`):
```sql
first_name           TEXT
last_name            TEXT
profile_image_url    TEXT
is_email_verified    BOOLEAN NOT NULL DEFAULT false
is_active            BOOLEAN NOT NULL DEFAULT true
last_login           TIMESTAMPTZ
phone                TEXT
skills               JSONB
preferences          JSONB     -- notification channels, digest freq, locale, timezone
whitelist            BOOLEAN NOT NULL DEFAULT false
ip_whitelist         TEXT[]
mfa_backup_codes     TEXT[]
updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
```

Missing tables (ref: `api/private/migrations/20260416050000_add-mfa-support.up.sql`):
```sql
fonderie_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

fonderie_mfa_challenges (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

#### Endpoint gaps vs. API (`api/lib/routers/identity/authRouter/authRouter.ts`)

| Missing endpoint | Note |
|---|---|
| `POST /auth/send-verification-email` | Re-send verification — distinct from verify-email |
| `POST /auth/mfa/disable` | Disable MFA for authenticated user |
| `POST /auth/mfa/backup-codes` | Generate new backup codes |
| `POST /auth/mfa/challenge` | Submit backup code or TOTP when `mfaRequired: true` returned by login |

#### DTO additions (port from `api/lib/dtos/usersDto/userDto.ts`)

```typescript
toUserDTO(row): IUserDTO          // excludes password_hash, mfa_secret — snake → camelCase
validateAndNormalizeRegistrationInput(body)
validateAndNormalizeUserUpdateInput(body)
```

**Scope boundary:** Auth owns the `fonderie_users` table and all authentication endpoints.
User profile routes (`GET /users`, `PUT /users/update`, `DELETE /users`) are authentication-adjacent
but are left to the customer's codebase per SDK conventions. Auth exposes `toUserDTO` so
customers can build profile endpoints without touching the raw table.

---

### 3. `@fonderie-js/permissions`

**Role:** RBAC engine, wildcard permissions, super-role bypass, permission check middleware.

#### Critical design note
Permissions can exist as named capabilities (`WORKSPACE`, `WORKSPACE_ROLE`, etc.) independently
of any role. A role without permissions is inert. When workspaces creates system roles (ADMIN, GUEST),
it must immediately seed `fonderie_role_permissions` for those roles. The permissions package migration
must run **before** the workspaces migration because workspaces inserts into `fonderie_role_permissions`.

#### Schema correction

Current `fonderie_role_permissions` in packages uses `action TEXT / resource TEXT` pair rows.
**Replace with API's CRUD bit pattern** (source of truth):

```sql
-- permissions migration (runs before workspaces)
CREATE TABLE IF NOT EXISTS fonderie_role_permissions (
  workspace_id   UUID        NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  role_id        UUID        NOT NULL REFERENCES fonderie_roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(50) NOT NULL,
  can_create     BOOLEAN     NOT NULL DEFAULT false,
  can_read       BOOLEAN     NOT NULL DEFAULT false,
  can_update     BOOLEAN     NOT NULL DEFAULT false,
  can_delete     BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key),
  UNIQUE (role_id, workspace_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_fonderie_role_permissions_role_id
  ON fonderie_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_fonderie_role_permissions_workspace_id
  ON fonderie_role_permissions(workspace_id);
```

**Note:** `fonderie_role_permissions` has FK to `fonderie_roles`. The permissions migration must run
after workspaces — but workspaces seeds into `fonderie_role_permissions`. This is resolved by
splitting the workspaces migration into two files: one that creates the tables, one that seeds
system role permissions. The consumer app runs them in order.

#### Violations to fix

| Issue | File | Action |
|---|---|---|
| `fonderie_role_permissions` currently in `002_workspaces.sql` | test-app migrations | Move to permissions-owned migration file |
| `PermissionsEngine.can()` uses `action/resource` pairs | `engine.ts` | Rewrite to use `permission_key + can_* bits` pattern matching API's `permissionCheck.ts` |
| Engine does not aggregate across multiple roles (`BOOL_OR`) | `engine.ts` | Must aggregate across all of user's roles in workspace — same user can have ADMIN + GUEST simultaneously |
| Tests use Jest | `src/__tests__/` | Migrate to `tsx --test` |

#### Additions (port from `api/lib/utils/middleware/constants.ts`)

**Typed `PermissionKey` constants:**
```typescript
export enum PermissionKey {
  WORKSPACE        = 'WORKSPACE',
  WORKSPACE_ROLE   = 'WORKSPACE_ROLE',
  WORKSPACE_INVITE = 'WORKSPACE_INVITE',
  NOTIFICATIONS    = 'NOTIFICATIONS',
  REPORTS          = 'REPORTS',
  WORK_ORDERS      = 'WORK_ORDERS',
  INVENTORY        = 'INVENTORY',
  WORK_SCHEDULE    = 'WORK_SCHEDULE',
}

export enum Operation {
  CREATE = 'create',
  READ   = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}
```

**Permission check must use `BOOL_OR` aggregation** (from `api/lib/utils/middleware/permissionCheck.ts`):
```sql
SELECT BOOL_OR(rp.can_read) AS has_permission
FROM fonderie_workspace_members wm
JOIN fonderie_roles r ON wm.role_id = r.id
JOIN fonderie_role_permissions rp ON r.id = rp.role_id
WHERE wm.user_id = $1
  AND wm.workspace_id = $2
  AND rp.workspace_id = $2
  AND rp.permission_key = $3
GROUP BY wm.user_id, wm.workspace_id
```
This handles multi-role: if the user has ADMIN (can_read=true) + GUEST (can_read=true),
`BOOL_OR` returns true from any matching role.

---

### 4. `@fonderie-js/workspaces`

**Role:** Org management, member roles, PIN invitations, workspace context middleware.

#### Critical fix — workspace identity via header

The current `workspaceContextMiddleware` reads workspace ID only from URL params.
**The API uses `X-Workspace-ID` header as the primary method.** Fix the middleware:

```typescript
// Priority order matching API's workspaceContext.ts
const workspaceId =
  ctx.request.headers.get('X-Workspace-ID') ??   // primary
  ctx.meta['query']?.['workspace'] ??              // fallback
  ctx.meta['params']?.['workspaceId'];             // legacy / nested routes
```

UUID validation must be applied before querying the database.

#### ICourierMessage dependency fix

`handlers/invitations.ts` imports `ICourierMessage` from `@fonderie-js/courier`.
Change to `@fonderie-js/core`.

#### Schema gaps vs. API source of truth

`fonderie_workspaces` missing columns (ref: `api/private/migrations/20260221130000_enhance-workspaces.up.sql`):
```sql
description     TEXT
email           TEXT
phone           TEXT
type            TEXT NOT NULL DEFAULT 'ORGANIZATION'
settings        JSONB    -- locale, timezone, currency, dateFormat, timeFormat
business_info   JSONB    -- name, website, taxId, businessRegistration, businessType, motto, invoiceContact
payment_info    JSONB    -- provider, customerId, subscriptionId, paymentMethod, billingEmail
plan_tier       INTEGER  NOT NULL DEFAULT 0
archived_by     UUID REFERENCES fonderie_users(id)
updated_by      UUID REFERENCES fonderie_users(id)
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

`fonderie_workspace_members` multi-role fix (ref: `api/private/migrations/20260307000000_support-multiple-roles-per-workspace.up.sql`):
```sql
-- Drop: UNIQUE (user_id, workspace_id)
-- New PK: PRIMARY KEY (user_id, workspace_id, role_id)
-- Add index: idx_fonderie_workspace_members_user_workspace ON (user_id, workspace_id)
-- Add: removed BOOLEAN NOT NULL DEFAULT false
-- Add: suspended BOOLEAN NOT NULL DEFAULT false
```

`fonderie_roles` additions (ref: API baseline + multi-role migration):
```sql
is_system    BOOLEAN NOT NULL DEFAULT false
description  TEXT
updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Migrate out:** `fonderie_courier_templates` currently in `002_workspaces.sql` — remove from this
package's migration. It belongs to `@fonderie-js/courier`.

**System role seeding** (roles must be created WITH permissions — cannot create ADMIN without granting it permissions):
```sql
-- Seeded in workspaces migration, AFTER permissions migration has created fonderie_role_permissions table
-- ADMIN role: full CRUD on all permission keys
-- GUEST role: can_read only on all permission keys
-- Follows api/private/migrations/20260307000000_support-multiple-roles-per-workspace.up.sql
```

#### Endpoint gaps vs. API (`api/lib/routers/workspace/workspacesRouter/workspacesRouter.ts`)

| Missing | Method + Path |
|---|---|
| Update workspace | `PUT /workspaces/:id` |
| Get settings | `GET /workspaces/settings` |
| Update settings | `PUT /workspaces/settings` |
| Update member role (single-role) | `POST /workspaces/members/:userId/role` |
| Add role to member (multi-role) | `POST /workspaces/members/:userId/roles/:roleId` |
| Remove role from member | `DELETE /workspaces/members/:userId/roles/:roleId` |
| List member roles | `GET /workspaces/members/:userId/roles` |
| Cancel invitation | `DELETE /workspaces/invitations/:inviteId` |
| Reject invitation | `POST /invitations/:token/reject` |
| Create custom role | `POST /workspaces/roles` |
| List roles | `GET /workspaces/roles` |
| Get role | `GET /workspaces/roles/:roleId` |
| Update role | `PUT /workspaces/roles/:roleId` |
| Delete role | `DELETE /workspaces/roles/:roleId` |
| Set role permissions | `POST /workspaces/roles/:roleId/permissions` |

#### DTO additions (port from `api/lib/dtos/workspacesDto/`)

```typescript
toWorkspaceDTO(row): IWorkspaceDTO
toWorkspaceDTOWithSettings(row, defaults): IWorkspaceDTOWithSettings
validateAndNormalizeWorkspaceInput(body)         // validates type enum, rejects snake_case
validateAndNormalizeWorkspaceUpdateInput(body)
validateAndNormalizeSettingsInput(body)          // camelCase in → snake_case for DB
toMemberDTO(row): IMemberDTO
toInvitationDTO(row): IInvitationDTO
toRoleDTO(row): IRoleDTO
toSettingsResponseDTO(rawSettings): IWorkspaceSettingsResponseDTO
```

#### stray file
Delete `packages/workspaces/routes.ts` (root level, outside `src/`). Canonical file is `src/routes.ts`.

---

### 5. `@fonderie-js/courier`

**Role:** Email, SMS, push dispatch. Reads `ctx.meta['message']` post-handler. Fire-and-forget.

#### ICourierMessage ownership change

`ICourierMessage` moves OUT of courier to `@fonderie-js/core`. Courier becomes a consumer
of the interface, not its owner. Update all internal imports accordingly.

#### Schema corrections

Remove `fonderie_courier_templates` from `002_workspaces.sql`. Courier owns it.

Add `fonderie_message_log` (ref: `api/private/migrations` Phase 3 work):
```sql
CREATE TABLE IF NOT EXISTS fonderie_message_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type       TEXT        NOT NULL,
  recipient_email     TEXT,
  recipient_phone     TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending',
  provider            TEXT,
  provider_message_id TEXT,
  opened_at           TIMESTAMPTZ,
  clicked_at          TIMESTAMPTZ,
  bounce_reason       TEXT,
  webhook_payload     JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fonderie_message_log_provider_message_id
  ON fonderie_message_log(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_fonderie_message_log_status
  ON fonderie_message_log(status);
```

#### Additions

**Locale support** on `ICourierMessage` (moved to core):
Template resolver must accept `locale` and fall back gracefully:
```typescript
resolve(type: string, data: Record<string, unknown>, locale?: string): Promise<IRenderedTemplate>
// locale precedence: message.locale → workspace.settings.locale → 'en-US'
```

**`FSTemplateResolver`** — SDK doc lists it alongside `DBTemplateResolver`. Currently missing.
Reads templates from the filesystem for development and testing without DB dependency.

**Delivery webhook handlers** (port from `api/lib/controllers/integrations/webhooksController/`):
```
POST /webhooks/email/sendgrid   — HMAC-SHA256 signature verification
POST /webhooks/email/mailgun    — signature + timestamp + token verification
POST /webhooks/email/mailtrap   — no signature (testing only)
```
Updates `fonderie_message_log` status, `opened_at`, `clicked_at`, `bounce_reason`.

#### Violations to fix

| Issue | Action |
|---|---|
| Tests use Jest | Migrate to `tsx --test` |
| `ICourierMessage` defined in courier | Move to core, update all imports |
| `fonderie_courier_templates` in wrong migration | Remove from workspaces, add to courier |
| No locale support | Add `locale` to dispatch flow |
| No delivery tracking | Add `fonderie_message_log` + webhook handlers |

---

### 6. `@fonderie-js/billing`

**Role:** Multi-provider subscription billing, plans, usage metering.

#### Confirm correct (SDK doc)
- `IBillingProvider` interface + `StripeProvider` implementation — provider-agnostic pattern is correct
- `requirePlan` middleware exists

#### Additions (port from `api/lib/models/platform/subscriptionModel/`, `api/lib/dtos/platformDto/billingDto.ts`)

**Missing plan admin endpoints:**
```
POST   /billing/plans          — create plan
PUT    /billing/plans/:planId  — update plan
DELETE /billing/plans/:planId  — delete plan
GET    /billing/plans/:planId/features  — list plan features
POST   /billing/plans/:planId/check-transition  — validate plan upgrade/downgrade
```

**DTO additions:**
```typescript
toSubscriptionDTO(row): ISubscriptionDTO
toPlanDTO(row): IPlanDTO
toUsageDTO(row): IUsageDTO
```

#### Violations to fix

| Issue | Action |
|---|---|
| Tests use Jest | Migrate to `tsx --test` |
| No DTOs | Add DTO layer per above |

---

### 7. `@fonderie-js/config`

**Role:** DB-backed remote config, multi-environment override, poll-based refresh.

**This is the closest package to complete.** Work is primarily conventions and cleanup.

#### Violations to fix

| Issue | File | Action |
|---|---|---|
| Orphan file `.ts` (no stem) | `config/src/.ts` | Delete |
| Tests use Jest | `src/__tests__/` | Migrate to `tsx --test` |
| `getConfig` export unclear | `src/index.ts` | Verify it is exported as a named export per SDK Package Overview |

#### Confirm correct (from `api/lib/models/config/systemConfigModel/systemConfigModel.ts`)
- Environment precedence: `environment = 'production'` overrides `environment = 'all'`
- Poll interval defaults to 30s
- `RemoteConfigModule` registers first in all apps — this must be documented in module's README

---

## Conventions Checklist (applies to all packages)

- [ ] `strict: true` in all `tsconfig.json`
- [ ] `exactOptionalPropertyTypes: true` — no `undefined` assigned to optional props
- [ ] `verbatimModuleSyntax: true` — `import type` for all type-only imports
- [ ] `tsx --test` replaces Jest in every package
- [ ] SQL aliases use camelCase: `created_at AS "createdAt"`
- [ ] All SQL goes through `IStoreAdapter.query()` — no raw `pg.Pool` usage
- [ ] All `fonderie_` table names use the prefix
- [ ] Node built-ins use `node:` prefix — `import { randomBytes } from 'node:crypto'`
- [ ] `tsup` dual ESM+CJS output — `"types"` condition before `"import"` and `"require"` in exports
- [ ] `ICourierMessage` imported from `@fonderie-js/core` in all packages

---

## Files to Delete Before Starting

| File | Reason |
|---|---|
| `packages/auth/src/handlers/forget-password.ts` | Typo duplicate of `forgot-password.ts` |
| `packages/config/src/.ts` | Orphan file with no stem |
| `packages/workspaces/routes.ts` | Stray file outside `src/` — canonical is `src/routes.ts` |

---

## Step-by-Step Execution Plan

Each step is self-contained and mergeable independently.

```
Step 0 — core
  0a. Delete the three stale files listed above
  0b. Move ICourierMessage to core/src/types.ts (add locale field)
  0c. Type ctx.meta well-known keys
  0d. Add parser utility
  0e. Add response helpers (setApiResponse, setErrorResponse, IApiError)
  0f. Add bodyParserMiddleware, corsMiddleware, loggerMiddleware, defineConfig exports
  0g. Migrate tests to tsx --test
  0h. Enforce tsconfig conventions

Step 1 — store
  1a. Add getMigrationsPath() convention
  1b. PGAdapter pool configuration options
  1c. Verify sql helper enforces parameterization
  1d. Migrate tests to tsx --test

Step 2 — auth
  2a. Fix ICourierMessage import (core)
  2b. Expand fonderie_users schema (12 missing columns)
  2c. Add fonderie_sessions migration
  2d. Add fonderie_mfa_challenges migration
  2e. Add missing endpoints (send-verification, mfa/disable, backup-codes, challenge)
  2f. Add toUserDTO and validators
  2g. Migrate tests to tsx --test

Step 3 — permissions
  3a. Replace action/resource schema with permission_key + CRUD bits
  3b. Move fonderie_role_permissions into permissions-owned migration
  3c. Rewrite engine.can() to use CRUD bit columns with BOOL_OR aggregation
  3d. Add typed PermissionKey enum and Operation enum
  3e. Migrate tests to tsx --test

Step 4 — workspaces
  4a. Fix workspace context middleware — X-Workspace-ID header as primary source
  4b. Fix ICourierMessage import (core)
  4c. Expand fonderie_workspaces schema (9 missing columns)
  4d. Fix fonderie_workspace_members — multi-role PK, add removed/suspended columns
  4e. Expand fonderie_roles — add is_system, description, updated_at
  4f. Remove fonderie_courier_templates from workspaces migration
  4g. Add system role seeding (ADMIN + GUEST with permissions) in same migration transaction
  4h. Add all 15 missing endpoints
  4i. Add full DTO layer (7 DTOs)
  4j. Delete stray root-level routes.ts
  4k. Migrate tests to tsx --test

Step 5 — courier
  5a. Update ICourierMessage imports to core
  5b. Add fonderie_courier_templates migration (received from workspaces)
  5c. Add fonderie_message_log migration
  5d. Add locale support to template resolver
  5e. Add FSTemplateResolver
  5f. Add delivery webhook handlers (SendGrid, Mailgun, Mailtrap)
  5g. Migrate tests to tsx --test

Step 6 — billing
  6a. Add 5 missing plan admin endpoints
  6b. Add DTO layer (toSubscriptionDTO, toPlanDTO, toUsageDTO)
  6c. Migrate tests to tsx --test

Step 7 — config
  7a. Delete orphan .ts file
  7b. Verify getConfig named export
  7c. Verify environment precedence logic
  7d. Migrate tests to tsx --test
```

---

*Shipping peace of mind. Each package is a guarantee, not a shortcut.*
