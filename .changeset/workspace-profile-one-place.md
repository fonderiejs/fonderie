---
'@fonderie/workspaces': minor
'@fonderie/billing': patch
---

The workspace profile is stored once, on the default branch. `IWorkspaceDTO`'s
motto, industry, website, logoUrl, taxRegistrations, email, phone and address
are read from the default branch and its primary email, primary phone and head
office in the same query; nothing is copied onto the workspace row any more
(the copy, kept in step by hand since branches arrived, was the kind of
duplicate that silently drifts). `PUT /workspaces` still writes those fields,
to the branch — and now refuses with 422 a value it could not keep (a phone
that is not E.164, a full list) instead of dropping it. Billing's account
eraser reads the business email from the branch too. The old profile columns
on `fonderie_workspaces` are dead and go with a later migration, once every
deployment runs this version.
