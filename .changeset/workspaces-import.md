---
"@fonderie/workspaces": minor
---

Add `importWorkspace` + `importMembership` — the workspaces write-side of
migrating an existing app onto Fonderie (mirrors `importUser` in
`@fonderie/auth`). `importWorkspace` preserves the original id, `ownerId`,
`createdAt`, settings and org-profile fields; `importMembership` restores the
user↔workspace↔role join (replay-safe). A migration is: `importUser` →
`importWorkspace` → resolve a role (seeded system role or a custom one) →
`importMembership`. Supplied fields preserved, omitted ones take table defaults.
