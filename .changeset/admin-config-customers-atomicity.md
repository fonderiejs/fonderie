---
'@fonderie/admin': patch
'@fonderie/config': patch
'@fonderie/customers': patch
'@fonderie/client': patch
---

Race fixes in admin, config and customers.

**@fonderie/admin.** Two requests confirming the same enrollment with a valid code both signed in, and the second replaced the backup codes the first had just shown. Now exactly one confirms: the operator row is locked and the promotion only happens while the enrollment is still unconfirmed. A burst of wrong enrollment codes also all got through the lockout check before the first failure was counted. Now they are checked one at a time, so at most five are tried, as at sign-in. Two recovery links issued at the same moment both stayed live. Now issuing a link retires the earlier ones and inserts the new one in a single serialized transaction.

**@fonderie/config.** Two first writes of one key with different kinds (on/off and text, say) both saved, so the second silently changed the key's type. The kind check now runs under the key's write lock. A secret written during `rotateSecretKey()` could end up encrypted with the old key: either written over the re-encrypted value after the rotation committed, or as a new key or revision the rotation never saw. Either way, nobody could read it once the old key was gone. Secret writes and rollbacks now share a lock with the rotation and encrypt inside it. The rotation also records a key check, so an instance still running with the old key gets a clear error instead of storing unreadable values. **Run migrations before rotating:** migration `004_secret_key_check` adds the table, and it only adds.

**@fonderie/customers.** Some customers could be created or updated with codes another customer already held:

- A referral code the caller chose that another customer holds was a 500. Now it is a 409 `DUPLICATE_REFERRAL_CODE`.
- A reference code the caller chose that another customer holds was a 500 on update. Now it is a 409 `DUPLICATE_REFERENCE_CODE`, as it already was on create.
- The reference-code counter could hand out a code someone had typed in by hand. That gave a 409 on create for a code the caller never sent, and a 500 on update. The counter now skips codes that are taken.
- A generated code lost to a concurrent create is generated again instead of failing.

**@fonderie/client.** Added the `DUPLICATE_REFERRAL_CODE` error message in every UI language.
