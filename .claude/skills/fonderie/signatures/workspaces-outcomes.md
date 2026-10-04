<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/workspaces — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_role_user_workspaces`

```sql
user_id                  UUID NOT NULL
workspace_id             UUID NOT NULL
role_id                  UUID NOT NULL
confirmed                BOOLEAN NOT NULL DEFAULT false
removed                  BOOLEAN NOT NULL DEFAULT false
suspended                BOOLEAN NOT NULL DEFAULT false
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- PRIMARY KEY (user_id, workspace_id, role_id)
```

### `fonderie_roles`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                     TEXT NOT NULL
workspace_id             UUID
is_system                BOOLEAN NOT NULL DEFAULT false
active                   BOOLEAN NOT NULL DEFAULT true
description              TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_workspace_invitations`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id             UUID NOT NULL
email                    TEXT NOT NULL
role_id                  UUID NOT NULL
token                    TEXT UNIQUE
pin                      TEXT
status                   TEXT NOT NULL DEFAULT 'PENDING'
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_workspaces`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                     TEXT NOT NULL
slug                     TEXT NOT NULL
type                     TEXT NOT NULL DEFAULT 'ORGANIZATION'
description              TEXT
plan                     TEXT NOT NULL DEFAULT 'free'
owner_id                 UUID NOT NULL
settings                 JSONB NOT NULL DEFAULT '{}'
archived_at              TIMESTAMPTZ
archived_by              UUID
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
is_personal              BOOLEAN NOT NULL DEFAULT false
motto                    TEXT
phone                    TEXT
business_type            TEXT
address                  JSONB NOT NULL DEFAULT '{}'
legal_name               TEXT
email                    TEXT
website                  TEXT
logo_url                 TEXT
tax_registrations        JSONB NOT NULL DEFAULT '[]'
languages                TEXT[] NOT NULL DEFAULT '{}'
```

Raw SQL ships in `node_modules/@fonderie/workspaces/dist/migrations/sql/` — read it there if you must; never download tarballs.

## Seeded rows (behavioral contract)

```sql
INSERT INTO fonderie_roles (name, workspace_id, is_system, description) VALUES ('ADMIN', NULL, true, 'System administrator with full access'), ('GUEST', NULL, true, 'Guest user with read-only access') ON CONFLICT DO NOTHING;
```

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/workspaces` | `requireAuth → workspace.list` |
| POST | `/workspaces` | `requireAuth → validate(createWorkspaceSchema) → workspace.create` |
| PUT | `/workspaces` | `requireAuth → wsCtx → manager → validate(updateWorkspaceSchema) → workspace.update` |
| GET | `/workspaces/:id` | `requireAuth → wsCtx → workspace.get` |
| POST | `/workspaces/archive` | `requireAuth → wsCtx → manager → workspace.archive` |
| GET | `/workspaces/current` | `requireAuth → wsCtx → workspace.get` |
| GET | `/workspaces/current/permissions` | `requireAuth → wsCtx → access.mine` |
| GET | `/workspaces/invitations` | `requireAuth → wsCtx → invitation.list` |
| POST | `/workspaces/invitations` | `requireAuth → wsCtx → manager → validate(createInvitationsSchema) → invitation.invite` |
| DELETE | `/workspaces/invitations/:inviteId` | `requireAuth → wsCtx → manager → invitation.cancel` |
| POST | `/workspaces/invitations/:inviteId/resend` | `requireAuth → wsCtx → manager → invitation.resend` |
| POST | `/workspaces/invitations/accept` | `acceptLimit → requireAuth → validate(acceptInvitationSchema) → invitation.accept` |
| POST | `/workspaces/leave` | `requireAuth → wsCtx → member.leave` |
| GET | `/workspaces/members` | `requireAuth → wsCtx → member.list` |
| DELETE | `/workspaces/members/:userId` | `requireAuth → wsCtx → manager → member.remove` |
| DELETE | `/workspaces/members/:userId/manager` | `requireAuth → wsCtx → owner → member.unsetManager` |
| POST | `/workspaces/members/:userId/manager` | `requireAuth → wsCtx → owner → member.setManager` |
| GET | `/workspaces/members/:userId/roles` | `requireAuth → wsCtx → member.getUserRoles` |
| POST | `/workspaces/members/:userId/roles` | `requireAuth → wsCtx → manager → validate(addMemberRoleSchema) → member.addRole` |
| DELETE | `/workspaces/members/:userId/roles/:roleId` | `requireAuth → wsCtx → manager → member.removeRole` |
| GET | `/workspaces/permissions/catalog` | `requireAuth → wsCtx → access.catalog` |
| POST | `/workspaces/restore` | `requireAuth → wsCtx → manager → workspace.restore` |
| GET | `/workspaces/roles` | `requireAuth → wsCtx → role.list` |
| POST | `/workspaces/roles` | `requireAuth → wsCtx → manager → validate(createRoleSchema) → role.create` |
| DELETE | `/workspaces/roles/:roleId` | `requireAuth → wsCtx → manager → role.remove` |
| GET | `/workspaces/roles/:roleId` | `requireAuth → wsCtx → role.get` |
| PUT | `/workspaces/roles/:roleId` | `requireAuth → wsCtx → manager → validate(updateRoleSchema) → role.update` |
| GET | `/workspaces/roles/:roleId/permissions` | `requireAuth → wsCtx → role.getPermissions` |
| POST | `/workspaces/roles/:roleId/permissions` | `requireAuth → wsCtx → manager → validate(setRolePermissionsSchema) → role.setPermissions` |
| GET | `/workspaces/settings` | `requireAuth → wsCtx → workspace.getSettings` |
| PUT | `/workspaces/settings` | `requireAuth → wsCtx → manager → validate(updateSettingsSchema) → workspace.updateSettings` |
| POST | `/workspaces/transfer-ownership` | `requireAuth → wsCtx → owner → validate(transferOwnershipSchema) → member.transferOwnership` |
