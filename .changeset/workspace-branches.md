---
'@fonderie/workspaces': minor
'@fonderie/client': minor
'@fonderie/react-workspaces': minor
'@fonderie/vue-workspaces': minor
---

Branches: a workspace can have several customer-facing identities, each with
its own name, logo, slogan, sector, website, domain, language, tax
registrations, emails, phones and locations. Before this, a business with
more than one front (a Québec branch and an Ontario branch, each with its own
address, phone and tax numbers) had one profile for all of them, so every
customer saw the head office's identity on their documents.

- `fonderie_workspace_branches` (migration 011); every workspace gets a default
  branch built from its current profile, and every existing contact row moves
  under it — a workspace with one branch behaves exactly as before.
- Emails, phones and locations belong to a branch: one primary email, one
  primary phone and one head office PER BRANCH; `GET /workspaces/contacts`
  returns every branch's (each row names its `branchId`) or one branch's
  with `?branchId=`; add / create accept `branchId` (default: the default
  branch).
- `IWorkspaceDTO`'s motto / industry / website / logo / tax registrations and
  email / phone / address mirror the DEFAULT branch, both ways: `PUT
  /workspaces` with those fields lands on it, and setting another branch as
  the default moves the mirror.
- Routes (members read, managers write): `GET/POST /workspaces/branches`,
  `GET/PATCH /workspaces/branches/:branchId`, `POST …/default`, `…/archive`,
  `…/restore`. A branch's `domain` is a host name, lower-cased, one live
  branch per host across every workspace (409 DUPLICATE_DOMAIN) — what a
  sign-up funnel on that host uses to know which branch it belongs to
  (`findBranchByDomain`). The default cannot be archived (409
  DEFAULT_ARCHIVE); an archived branch takes no contact (409 BRANCH_ARCHIVED).
- Client: `listBranches`, `createBranch`, `getBranch`, `updateBranch`,
  `setDefaultBranch`, `archiveBranch`, `restoreBranch`; `getContacts({
  branchId })`. Hooks / composables: `useWorkspaceBranches()` (list,
  `defaultBranch`, create / update / setDefault / archive / restore) and
  `useWorkspaceBranch(id)`; `useWorkspaceContacts` and
  `useWorkspaceLocations` take `{ branchId }` to narrow the shared read.
