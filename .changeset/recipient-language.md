---
'@fonderie/core': minor
'@fonderie/courier': minor
'@fonderie/workspaces': minor
'@fonderie/billing': minor
---

Every email is written in its recipient's language, including the ones sent without a signed-in user.

Billing receipts and notices, and workspace invitations, passed no language, so a French- or Chinese-speaking customer got them in the system default (English). Courier now decides in this order:

1. the `locale` the sender passed (auth already passes the signed-in user's);
2. **the language of the account the recipient's email or phone belongs to** (`@fonderie/auth`'s users, same database);
3. the new `fallbackLocale` on the message: the business's language, for someone without an account;
4. the system default.

- `ICourierMessage.fallbackLocale` (core).
- Courier: the account lookup is on by default; `recipientLocaleLookup: false` turns it off (e.g. when accounts live in another database). The message log records the language actually used.
- Workspaces: an invitation carries the workspace's language as its fallback, so a Quebec business invites in French. An invitee who already has an account still gets their own language.
- Billing: `IBillingRecipient` takes `locale` and `fallbackLocale`, so an app's `resolveRecipient` can say which language to use. Without either, courier uses the recipient's account.
