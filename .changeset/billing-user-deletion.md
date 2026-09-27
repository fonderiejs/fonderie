---
'@fonderie/billing': minor
'@fonderie/auth': minor
'@fonderie/client': minor
'@fonderie/react-admin': minor
'@fonderie/vue-admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/admin': patch
---

Deleting an account now stops its billing, and purging it erases the payment provider's copy.

Before: `@fonderie/auth` soft-deleted the user and emitted `fonderie.user.deleted`, but nothing listened — an active subscription kept renewing on a card the person could no longer sign in to cancel.

- **Billing, on `fonderie.user.deleted`** (needs the event bus): cancels the user's subscription at the provider — immediately by default; `onSubscriberDeleted: 'cancel-at-period-end' | 'keep'` to change that — and disarms off-session charging (auto-recharge off, stored card and any pending recharge key forgotten). No automatic refund; the app decides. Workspace subscriptions are untouched. Idempotent: an "already canceled" answer from the provider is success, a real failure throws so the bus redelivers.
- **Billing, on `fonderie.user.purged`:** deletes every provider customer record the user had (subscription and wallet customers) — the email and saved cards. The provider keeps its invoices; local subscriptions, ledger and balances stay as financial records keyed by an id that no longer resolves to a person. New optional provider method `deleteCustomer` (Stripe: `customers.del`, already-deleted is a no-op).
- **Auth:** `purgeSoftDeletedUsers` / `startUserRetention` take an optional `bus` and emit `fonderie.user.purged` { userId } for each hard-deleted account, after the delete. `EVENT_KEYS.userPurged`. The admin user lookup by id resolves soft-deleted accounts (with `deletedAt`); `GET /_admin/users?deleted=1` lists only them.
- **Client / hooks:** `listUsers({ deleted: true })`; `useAdminUsers` passes it through.
- **Console:** Users gets an Active / Deleted switch; a deleted account shows "Deleted on …" instead of account actions, sessions and sign-ins, and keeps its Plan & credits.
