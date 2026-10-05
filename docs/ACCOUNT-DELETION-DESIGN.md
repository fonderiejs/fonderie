# Account deletion that a person can trust — design and build order

Status: **PROPOSED 2026-10-04.** Decisions D1–D8 (§5) are the recommended
defaults; change one here and say which phase it touches.

## 1. The problem

A person who asks to delete their account must be able to (a) prove it is
them, (b) know exactly when their data will be gone, (c) change their mind
until then, and (d) actually have it gone afterwards — everywhere, not just in
the users table. An operator must be able to show an auditor (SOC 2 P4.3 /
C1.2; GDPR Art. 17 + 12(3); CCPA §1798.105) that this happened.

Today none of (a)–(d) holds.

## 2. Audit (what the code does today, 2026-10-04)

Deletion is `DELETE /users` → `deleted_at = now()`, sessions dropped,
`fonderie.user.deleted` emitted. Days later `purgeSoftDeletedUsers` hard-deletes
the row and (only if given a bus) emits `fonderie.user.purged`.

**The request**
- No proof: one authenticated call deletes, no code, no re-auth.
- No message to the person — no template exists.
- No restore function anywhere (billing's comment assumes one).

**While soft-deleted**
- Email / phone login → `401 INVALID_CREDENTIALS`: the person is not told the
  account is scheduled for deletion, nor when, nor that they can stop it.
- Google / Apple login → `upsertByProvider` hits `ON CONFLICT (email)` on the
  deleted row, rewrites provider fields, then fails `500`.
- Register with the same email → unique violation → `500`. Same phone →
  overwrites the deleted row's name, then `500`.
- A password-reset token issued before deletion still resets the deleted
  row's password (`resetPassword` has no `deleted_at` check).
- Soft-deleted members still listed (name, email, avatar) and counted as seats.

**After purge — personal data that survives** (inventory per brick)

| Brick | Survives | Why |
|---|---|---|
| workspaces | memberships; personal workspace + its profile; org workspaces with an **owner that no longer exists** (no transfer possible) | `deleteUserData` exists, nothing calls it |
| media / storage | avatar row + bytes, still **publicly served** | not linked to the user |
| courier | `message_log.recipient` (email / phone) forever | no user link, no retention |
| events / audit | payloads with email, name, PINs, reset tokens | age-based purge only; per-row HMAC (deleting rows is fine, editing is "tampered") |
| auth | `login_events` rows with `user_id NULL` + `email_attempted` (every login try against the deleted account writes one) | not keyed by user |
| billing | Stripe customers created for **workspace** subscriptions with the user's email; customers created when the wallet is off | purge handler only looks at `user` subscribers |
| customers | `created_by`, note `author_id` (orphan ids) | — |
| webhooks | delivery payloads / responses forever | no retention |
| admin | `admin_log.path` holds the user id | operator trail |

## 3. Target

```
 ACTIVE ──request──▶ code sent (chosen verified channel: email / SMS)
                         │ confirm code (+ re-auth)
                         ▼
               PENDING_DELETION  (archived)
               • sessions ended, account hidden from teams
               • login ⇒ 403 ACCOUNT_PENDING_DELETION
                   { requestedAt, deleteOn } + restore token
                 ──"Keep my account"──▶ ACTIVE  (fonderie.user.restored)
               • register with same email/phone ⇒ 409 (sign in to restore)
               • deleteOn − 7 d, and NO login attempt since the request:
                   friendly reminder (same channel)
                         │ deleteOn reached
                         ▼
               PURGE  (one job, idempotent, resumable)
               1. final "your account has been deleted" notice
               2. fonderie.user.purging { userId, email, phone } ─▶ every brick
                  erases / pseudonymizes what it holds (fan-out, each reports)
               3. auth row hard-deleted (cascades)
               4. erasure receipt kept: hashed identifiers, dates, per-brick
                  results — no personal data (the auditor's evidence)
```

Legal-hold exceptions, kept **pseudonymized** (no name, email, phone): invoices,
ledger, subscriptions (tax / accounting law, 6–10 years); security audit trail
keyed by the opaque user id (SOC 2 CC7). Backups age out on their own schedule
(documented, not rewritten).

## 4. Phases

**Phase 1 — Correctness now (auth, patch).** No new flow yet; stop the bleeding.
- Login of a soft-deleted account answers `403 ACCOUNT_PENDING_DELETION` with
  `deleteOn` (only after the password / OTP / OAuth proof succeeds — never an
  account-existence oracle).
- OAuth never touches a deleted row; register / phone register answer `409
  ACCOUNT_PENDING_DELETION` instead of `500` / mutation.
- `resetPassword`, verification and MFA flows refuse deleted accounts; pending
  resets / verifications are cleared at deletion.
- Members list and seat counts skip soft-deleted users (workspaces).

**Phase 2 — The request flow (auth + client + hooks + screens).**
- `POST /users/me/deletion { channel }` → code to a VERIFIED channel the person
  picks; `POST /users/me/deletion/confirm { code }` → schedules
  (`deletion_requested_at`, `deletion_scheduled_for = now + gracePeriod`,
  `deletion_channel`), ends sessions, emits `fonderie.user.deletion_scheduled`.
- `POST /auth/account/restore` with the short-lived restore token from the 403
  (proof already given) → clears the schedule, emits `fonderie.user.restored`.
- Templates (en/fr/es/zh-Hans/zh-Hant): code, scheduled (with date + how to
  cancel), reminder, deleted.
- `useDeleteAccount` / `useRestoreAccount` (react, react-native, vue) + the
  account-deletion screen and the "your account is scheduled for deletion"
  screen in the auth screens.
- `DELETE /users` stays as a deprecated alias that requires the code.

**Phase 3 — Reminder + purge job (auth).** `startUserRetention` becomes the
deletion scheduler: reminder pass (deleteOn − 7 d, no login attempt since
request, once), purge pass (final notice → `fonderie.user.purging` fan-out →
row delete → receipt). Fails closed per user: a brick that throws leaves the
user pending and retried; the receipt records it.

**Phase 4 — Erasure in every brick.** Each subscribes to
`fonderie.user.purging` and reports `{ brick, erased, kept, reason }`:
workspaces (memberships, personal workspace, ownership rule D4), media/storage
(avatars), courier (redact recipient), events (delete rows naming the user —
row HMAC unaffected), auth (login_events by email), billing (all Stripe
customers carrying the email), customers (null `created_by` / `author_id`),
webhooks (delivery payloads mentioning the user). A gate test fails when a new
migration adds a personal-data column no brick claims.

**Phase 5 — Operator & evidence.** Console: pending deletions (requested, date,
reminder sent), cancel on request, legal hold, "erase now" for an urgent
verified request; erasure receipts list + export. Compliance doc section in
fonderie-compliance (policy, periods, backup statement).

## 5. Decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | Grace period | **30 days** (configurable). Inside GDPR's one-month response (Art. 12(3)) and CCPA's 45 days; the period Facebook / Google use. |
| D2 | Proof to request | Code to a **verified** channel the person chooses (email or SMS) + an active session. MFA users also pass MFA. |
| D3 | What login shows while pending | After the credential is proven: requested date, deletion date, "Keep my account" / "Continue deletion". Never before (no oracle). |
| D4 | Owner of a team workspace with other members | **Refuse the request** until ownership is transferred or the workspace is deleted — never orphan a team. A personal or member-less workspace is deleted with the account. |
| D5 | Reminder | Once, **7 days** before deletion, only if there was **no login attempt** since the request, on the request channel. |
| D6 | Same email/phone during the grace period | `409 ACCOUNT_PENDING_DELETION` — sign in to restore; the address frees up at purge. |
| D7 | Billing on request | Cancel **at period end** (reversible on restore); disarm off-session charging immediately; purge deletes every Stripe customer carrying the email. |
| D8 | What is kept after purge | Pseudonymized financial records (law) and the security trail by opaque id; an erasure receipt with keyed hashes of the identifiers — enough to prove erasure, not to re-identify. |
