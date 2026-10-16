---
'@fonderie/workspaces': minor
---

Migration `012_profile_on_branch_only.sql` drops the columns 9.0 left dead:
`fonderie_workspaces.motto / phone / address / industry / email / website /
logo_url / tax_registrations` and `fonderie_workspace_branches.domain` (with
its unique index). The profile has lived on the default branch since 9.0.0;
this only removes the stale copies, after one last safety net that gives a
default branch to any workspace row still without one. It is **destructive**
(`DROP COLUMN`): a deploy gate such as `classifyMigration` will refuse it
until approved, and it must not run on a database still served by a version
before 9.0.0. `importWorkspace` now lands motto / industry on the default
branch and phone / address as its primary phone and head office.
