---
'@fonderie/workspaces': major
'@fonderie/billing': patch
'@fonderie/client': minor
---

Everything about a business is stored once.

- **The workspace profile lives on the default branch.** `IWorkspaceDTO`'s
  motto, industry, website, logoUrl, taxRegistrations, email, phone and
  address are read from the default branch and its primary email, primary
  phone and head office in the same query; nothing is copied onto the
  workspace row any more (the copy, kept in step by hand since branches
  arrived, was the kind of duplicate that silently drifts). `PUT /workspaces`
  still writes those fields, to the branch — and now refuses with 422 a value
  it could not keep (a phone that is not E.164, a full list) instead of
  dropping it.
- **A branch's `domain` is derived, not typed (BREAKING).** It is the host of
  the branch's primary email (`bureau@quebecmover.com` → `quebecmover.com`),
  so it can never disagree with how the branch is reached. `domain` is no
  longer accepted on `POST`/`PATCH /workspaces/branches` (stripped), there is
  no `409 DUPLICATE_DOMAIN`, and `findBranchByDomain(host)` answers the live
  branch whose primary email is on that host, the default branch first.
  `@fonderie/client`'s `ICreateWorkspaceBranchInput` loses `domain`.
- Billing's account eraser reads the business email from the branch.
- The old profile and domain columns on the workspace tables are dead and go
  with a later migration, once every deployment runs this version.
