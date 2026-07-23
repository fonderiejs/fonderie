---
"@fonderie/customers": minor
---

Add referral codes to customers. Every customer now auto-gets a random, **workspace-unique** `referralCode` at creation (safe to share — non-sequential, so it can't be guessed by incrementing), alongside the existing sequential `referenceCode` and the UUID primary key. New customers can pass `referredByCode` at signup: it resolves to the referrer within the same workspace and sets `referredBy` (a nullable FK), giving a clean 1:many referrer→referees relationship. An unknown `referredByCode` is ignored, not an error. Two workspaces may share a referral code; two customers in one workspace cannot (enforced by a partial unique index). Verified end-to-end against Postgres.
