---
'@fonderie/client': minor
---

`AdminClient.issueToken()` and `.revokeToken()`

The root-token-only writes behind `@fonderie/admin`'s scoped tokens, with
`AdminScope`, `IAdminTokenRecord`, `IAdminIssueTokenInput` and
`IAdminIssuedToken` (the plaintext, returned once). `IAdminTokensReport`
gains `issued` — null when the deployment gave `AdminModule` no store.
