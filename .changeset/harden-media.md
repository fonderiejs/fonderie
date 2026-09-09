---
'@fonderie/media': patch
---

Harden avatar upload (audit follow-ups):

- **Size guard before decode:** reject an oversized upload by its base64 length
  *before* decoding, bounding the decode allocation — previously a large payload
  was fully materialized into a buffer only to be rejected. (Pair with a
  request-body-size limit at the adapter for full coverage.)
- **Owner authorization:** uploads now default to **self-owned user assets
  only** (`ownerType: 'user'`, `ownerId` = the caller). A new optional
  `config.authorizeOwner(ctx, owner)` hook permits other owners (workspace
  logos, customer photos). Previously any `ownerType`/`ownerId` was accepted.
- **No orphaned bytes:** if the metadata insert fails after the bytes are
  stored, the stored object is deleted before the error propagates.
- **Docs:** `GET /media/:id` is a public capability URL (unguessable UUID) — not
  an access-controlled store for private assets; and consumers must run
  `@fonderie/storage`'s migration alongside media's.
