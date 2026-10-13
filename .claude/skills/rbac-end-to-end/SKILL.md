---
name: rbac-end-to-end
description: Use whenever a task touches roles, permissions or who-may-do-what in a Fonderie app — adding a permission, guarding a route, seeding default roles, a role editor screen, assigning roles to members, hiding buttons a user may not use, or a 403 MANAGER_REQUIRED / PERMISSION_DENIED someone did not expect. Covers the full chain (permission catalog → seed → route guard → effective-permissions read → client gate → tests) so the layers cannot drift. Triggers on "add a permission", "who can delete", "role editor", "assign role", "hide this for non-admins", "requirePermission", "requireManager", "RBAC".
---

# RBAC end to end

A permission exists in five places. When one is missing the system still runs,
it is just wrong: a switch in the role editor that guards nothing, a route any
guest can call, a button every member sees and most of them get refused.

```
catalog ──► seed ──► route guard ──► effective permissions ──► client gate
   └───────────────────── tests read the catalog ─────────────────────┘
```

## 1. The catalog is the single list

Declare every `(resource, operation)` the app checks in **one** place, owned by
the server, and derive everything else from it: the role editor's switch grid,
the default-role seed, and a test that fails when a route guards a resource the
catalog does not list (or the catalog lists one no route guards).

Never hard-code the resource list in a screen. A switch the server never checks
is worse than no switch — it tells an owner they restricted something they did
not.

## 2. Seed defaults per workspace

A role with no permission rows denies everything. Every system role a member
can land on (including the default role for invitees) needs its rows seeded
when the workspace is created, and backfilled by migration for existing
workspaces. Decide per role: what may a newly invited member do on day one?

System roles are not editable through the role editor; if their grants must be
tunable, that is a deliberate feature with its own route, not a bypass.

## 3. Guard every route

- Workspace-admin routes (members, invitations, roles, profile, settings,
  billing) → `requireManager` / `requireBillingManager`.
- App resources → `requirePermission(op, resource)` with the catalog's names.
- A brick whose routes have no guard hook at all is a package gap: add a config
  option (e.g. `permission: { resource: 'customers' }`) rather than wrapping
  routes in the app.
- Check the operation matches the verb: GET=read, POST=create, PUT/PATCH=update,
  DELETE=delete. A DELETE switch with no DELETE route is dead.

## 4. Read effective permissions once

The client must not re-implement the server's rules from role names. It asks
the server for the signed-in member's effective permissions in the current
workspace (one request, cached per workspace, refreshed on role change) and
exposes `useCan(op, resource)` / `isManager`. Every hook package (React,
React Native, Vue) gets the same hook name and shape.

## 5. Gate the UI from that read

- Hide controls the member can never use; disable (with a reason) ones that
  depend on state. Do not show a button whose only outcome is a 403.
- Still handle the 403 — permissions change while a screen is open.
- Owner and manager-only actions (remove member, transfer ownership, edit
  roles) never appear on the owner's own row where the server refuses them.

## 6. Test the chain, not the parts

Minimum per resource: a member **with** the grant succeeds, a member
**without** it gets 403, and a guest (default invitee role) gets exactly what
the seed says. Run them against a real database — RBAC bugs live in the SQL
joins (workspace scoping, multi-role members, deleted roles), not in the
middleware's `if`.

Before claiming "permissions work", show the failing case: remove the grant
and watch the request fail (`verify-honestly`).

## Pitfalls seen in real audits

- Members with two roles returned as two rows → duplicate list entries and a
  "first row's role" that is wrong half the time. Group by user, return
  `roles[]`.
- Invite screen pre-selecting a system role the invite route rejects.
- No path to make anyone but the creator a manager.
- Deleting a role leaving orphan assignment rows with no warning to the owner.
- Saving a role editor before its permissions loaded wipes the role.
