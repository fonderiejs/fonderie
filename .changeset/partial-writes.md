---
'@fonderie/admin': patch
'@fonderie/media': minor
'@fonderie/billing': minor
'@fonderie/courier': patch
'@fonderie/auth': patch
---

Writes that belong together now commit together, so a failure between two statements can no longer leave a half-updated record.

- `@fonderie/admin`: changing an operator's scopes or disabling them ends their sessions in the same statement. A failure between the two used to leave a demoted or disabled operator signed in with the rights they just lost. Issuing a recovery link signs the operator out in the same transaction as the link, so a failed link no longer leaves them signed out with no way back in.
- `@fonderie/media`: `DELETE /media/:id` deletes the asset row first (ownership checked in the same statement) and the stored bytes after. Deleting the bytes first, then failing on the row, used to leave an asset that 404s forever; a failed byte delete now leaves only an unreachable blob and the delete still succeeds. New `MediaAssetModel.deleteOwned(id, userId)`.
- `@fonderie/billing`: auto-recharge records each fact in one statement. The claim also persists the charge's idempotency key (new `mintKeyPrefix` option on `claimAutoRecharge`), so a claimed window always has its key recorded. A decline is counted and the key released together (new `clearPendingKey` option on `recordRechargeFailure`), so a dead card is no longer retried forever without being disabled. A success resets failures and releases the key together (`clearPendingKey` on `recordRechargeSuccess`), so a captured charge's key is no longer left pending, where it was re-sent every window, credited nothing and, after 23 hours, disabled auto-recharge as an unreconciled charge.
- `@fonderie/billing`: the subscription webhook records a consumed trial in the same transaction as the subscription write. A failure after the write used to leave a trialing subscription with no trial on record, and a retry arriving after a newer event was rejected as stale, so a cancel → resubscribe could start a second trial.
- `@fonderie/courier`: the provider message id and the `sent` status are written in one statement. A failure between the two used to leave a sent message logged as `pending` with a provider id.
- `@fonderie/auth`: `purgeSoftDeletedUsers` with a bus purges one account per transaction and announces `fonderie.user.purged` before that transaction commits. A bus failure in the middle of a bulk delete used to lose every remaining announcement for accounts that were already gone, so billing never deleted their payment-provider customers. A failed announcement now rolls back its own delete, and the next run picks that account up. Without a bus, the purge is still one statement.
