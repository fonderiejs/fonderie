<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/workspaces — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_role_bin`

```sql
id                       UUID PRIMARY KEY
workspace_id             UUID NOT NULL
snapshot                 JSONB NOT NULL
deleted_by               UUID
deleted_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

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

### `fonderie_workspace_brakes`

```sql
workspace_id             UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE
user_id                  UUID NOT NULL
actions                  INT NOT NULL
braked_at                TIMESTAMPTZ NOT NULL DEFAULT now()
-- PRIMARY KEY (workspace_id, user_id)
```

### `fonderie_workspace_destructive_actions`

```sql
id                       BIGSERIAL PRIMARY KEY
workspace_id             UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE
actor_id                 UUID NOT NULL
kind                     TEXT NOT NULL
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

### `fonderie_workspace_ownership_offers`

```sql
workspace_id             UUID PRIMARY KEY REFERENCES fonderie_workspaces(id) ON DELETE CASCADE
from_user_id             UUID NOT NULL
to_user_id               UUID NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at               TIMESTAMPTZ NOT NULL
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
| POST | `/workspaces` | `requireAuth → validate(createWorkspaceSchema) → T(K.workspaceCreated, () => ({}), (r) => (r?.['workspace'] as { id?: string } | undefined)?.id) → workspace.create` |
| PUT | `/workspaces` | `requireAuth → wsCtx → manager → validate(updateWorkspaceSchema) → T(K.workspaceUpdated) → workspace.update` |
| GET | `/workspaces/:id` | `requireAuth → wsCtx → workspace.get` |
| POST | `/workspaces/archive` | `requireAuth → wsCtx → owner → T(K.workspaceArchived) → workspace.archive` |
| GET | `/workspaces/current` | `requireAuth → wsCtx → workspace.get` |
| GET | `/workspaces/current/permissions` | `requireAuth → wsCtx → access.mine` |
| GET | `/workspaces/invitations` | `requireAuth → wsCtx → invitation.list` |
| POST | `/workspaces/invitations` | `requireAuth → wsCtx → manager → validate(createInvitationsSchema) → T(K.invitationCreated, (_c, r) => ({ inviteIds: ((r?.['invitations'] as Array<{ invitationId: string }> | undefined) ?? []).map((i) => i.invitationId) })) → invitation.invite` |
| DELETE | `/workspaces/invitations/:inviteId` | `requireAuth → wsCtx → manager → brake('invitation.cancel') → T(K.invitationCancelled, inviteOf) → invitation.cancel` |
| POST | `/workspaces/invitations/:inviteId/resend` | `requireAuth → wsCtx → manager → T(K.invitationResent, inviteOf) → invitation.resend` |
| POST | `/workspaces/invitations/accept` | `acceptLimit → requireAuth → validate(acceptInvitationSchema) → T(K.invitationAccepted, () => ({}), (r) => r?.['workspaceId'] as string | undefined) → invitation.accept` |
| POST | `/workspaces/leave` | `requireAuth → wsCtx → T(K.memberLeft) → member.leave` |
| GET | `/workspaces/members` | `requireAuth → wsCtx → member.list` |
| DELETE | `/workspaces/members/:userId` | `requireAuth → wsCtx → manager → brake('member.remove') → T(K.memberRemoved, target) → member.remove` |
| DELETE | `/workspaces/members/:userId/brake` | `requireAuth → wsCtx → owner → T(K.managerReleased, target) → async (ctx) => { const userId = (ctx.meta['params'] as Record<string, string> | undefined)?.['userId'] ?? ''; return (await releaseBrake(store, ctx.workspace!.id, userId)) ? setApiResponse(HTTP.OK, 'MANAGER_RELEASED', 'They can delete again.') : setApiResponse(HTTP.NOT_FOUND, 'NOT_PAUSED', 'That person is not paused.'); }` |
| DELETE | `/workspaces/members/:userId/manager` | `requireAuth → wsCtx → owner → T(K.managerUnset, target) → member.unsetManager` |
| POST | `/workspaces/members/:userId/manager` | `requireAuth → wsCtx → owner → T(K.managerSet, target) → member.setManager` |
| GET | `/workspaces/members/:userId/roles` | `requireAuth → wsCtx → member.getUserRoles` |
| POST | `/workspaces/members/:userId/roles` | `requireAuth → wsCtx → manager → validate(addMemberRoleSchema) → T(K.memberRoleAdded, (c) => ({ ...target(c), ...roleOf(c) })) → member.addRole` |
| DELETE | `/workspaces/members/:userId/roles/:roleId` | `requireAuth → wsCtx → manager → T(K.memberRoleRemoved, (c) => ({ ...target(c), ...roleOf(c) })) → member.removeRole` |
| GET | `/workspaces/permissions/catalog` | `requireAuth → wsCtx → access.catalog` |
| POST | `/workspaces/restore` | `requireAuth → wsCtx → manager → T(K.workspaceRestored) → workspace.restore` |
| GET | `/workspaces/roles` | `requireAuth → wsCtx → role.list` |
| POST | `/workspaces/roles` | `requireAuth → wsCtx → manager → validate(createRoleSchema) → T(K.roleCreated, (_c, r) => ({ roleId: (r?.['role'] as { id?: string } | undefined)?.id })) → role.create` |
| DELETE | `/workspaces/roles/:roleId` | `requireAuth → wsCtx → manager → brake('role.delete') → T(K.roleDeleted, roleOf) → role.remove` |
| GET | `/workspaces/roles/:roleId` | `requireAuth → wsCtx → role.get` |
| PUT | `/workspaces/roles/:roleId` | `requireAuth → wsCtx → manager → validate(updateRoleSchema) → T(K.roleUpdated, roleOf) → role.update` |
| GET | `/workspaces/roles/:roleId/permissions` | `requireAuth → wsCtx → role.getPermissions` |
| POST | `/workspaces/roles/:roleId/permissions` | `requireAuth → wsCtx → manager → validate(setRolePermissionsSchema) → T(K.rolePermissionsSet, roleOf) → role.setPermissions` |
| GET | `/workspaces/roles/bin` | `requireAuth → wsCtx → manager → role.listBin` |
| DELETE | `/workspaces/roles/bin/:roleId` | `requireAuth → wsCtx → owner → T(K.roleBinPurged, roleOf) → role.purge` |
| POST | `/workspaces/roles/bin/:roleId/restore` | `requireAuth → wsCtx → manager → T(K.roleRestored, roleOf) → role.restore` |
| GET | `/workspaces/settings` | `requireAuth → wsCtx → workspace.getSettings` |
| PUT | `/workspaces/settings` | `requireAuth → wsCtx → manager → validate(updateSettingsSchema) → T(K.settingsUpdated) → workspace.updateSettings` |
| DELETE | `/workspaces/transfer-ownership` | `requireAuth → wsCtx → owner → T(K.ownershipWithdrawn) → member.withdrawOwnershipOffer` |
| GET | `/workspaces/transfer-ownership` | `requireAuth → wsCtx → member.getOwnershipOffer` |
| POST | `/workspaces/transfer-ownership` | `requireAuth → wsCtx → owner → stepUp → validate(transferOwnershipSchema) → T(K.ownershipOffered, (c) => ({ targetUserId: (c.meta['body'] as { userId?: string } | undefined)?.userId })) → member.transferOwnership` |
| POST | `/workspaces/transfer-ownership/accept` | `requireAuth → wsCtx → T(K.ownershipTransferred, (_c, r) => ({ targetUserId: r?.['previousOwnerId'] as string | undefined })) → member.acceptOwnership` |
| POST | `/workspaces/transfer-ownership/decline` | `requireAuth → wsCtx → T(K.ownershipDeclined) → member.declineOwnership` |
