---
'@fonderie/react-admin': minor
'@fonderie/react-admin-screens': minor
---

Access: issue and revoke scoped tokens from the page

`useAdminTokens` gains `issue` and `revoke` (root token only; each
refreshes the list). The Access page grows the issued-token table — name,
scopes, created by, expiry, last used — with an issue form and revoke, shows
the plaintext once and says so, and explains the 401 when the shell is
running on a scoped token rather than the root. Both READMEs now recommend
giving the shell a `read` token. Phase 8e-ui of
`docs/ADMIN-BRICK-DESIGN.md`.
