---
"@fonderie/auth": minor
---

Add `importUser` — the write-side of migrating an existing user base onto
Fonderie auth. `UserModel.create` is for fresh sign-ups (new id, default
timestamps); `importUser(store, user)` instead **preserves identity**: the
original id (so foreign keys still resolve), `createdAt`, `emailVerifiedAt`, and
the legacy password hash. Pair it with the `legacyVerify` config option — import
the foreign hash as-is, and Fonderie upgrades it to bcrypt on first login
(rehash-on-login). Supplied fields are preserved; omitted ones take the table
defaults.
