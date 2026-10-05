---
'@fonderie/workspaces': patch
---

Concurrent changes to one team are now applied one at a time (database audit,
batch 2). Each was reproduced with a race test that fails on the previous code.

- **Seat limit** — invites checked the seat count and inserted separately, so
  two managers inviting at once with one seat left both got it (N at once: N-1
  over). The count and the inserts now run under a lock on the workspace row.
- **Ownership transfer** — two transfers at once both answered "transferred"
  though only one applied, and a member removed mid-transfer could become the
  owner. The transfer now locks the workspace and the new owner's membership and
  reports failure when it did not apply.
- **Removing vs. assigning** — a role assigned while the person was being
  removed stayed live (a removed person holding a role), and revoking manager
  rights while another role was removed could leave someone with no role at all.
  Every change to a person's roles (remove, assign, set/unset manager, delete a
  role they hold) now takes one lock on their membership first. Removing someone
  who is not a member answers 404 MEMBER_NOT_FOUND instead of a misleading 200.
- **Role permissions** — two saves at once produced the UNION of both (switches
  nobody chose). The role row is locked; the last save wins; one INSERT.
- **Invitation accept** — the claim now re-checks expiry and the credential
  (a resend replaces it) in the same statement, and grants the role it claims —
  with the "still assignable" check inside the insert, rolled back if not.
