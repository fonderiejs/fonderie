---
'@fonderie/workspaces': minor
'@fonderie/customers': minor
'@fonderie/webhooks': minor
'@fonderie/client': minor
'@fonderie/react-workspaces': minor
'@fonderie/react-customers': minor
'@fonderie/react-webhooks': minor
'@fonderie/vue-workspaces': minor
'@fonderie/vue-customers': minor
'@fonderie/vue-webhooks': minor
---

Deleting a customer, a custom role or a webhook endpoint can be undone for 30 days (docs/INSIDER-THREAT-DESIGN.md, Phase 3).

A rogue manager, or a slip of the finger, could permanently delete customers with every email, phone, address and note, custom roles with their permissions and assignments, and webhook endpoints with their secrets. Nothing could bring them back.

Now each delete first writes a snapshot of the record and everything attached to it into the module's bin, in the same transaction. A delete that is refused (a customer still on a job) leaves no snapshot.

- **Restore** brings the record back with its original id, in one transaction:
  - `POST /customers/bin/:id/restore`: emails, phones, addresses, notes, tags and relationships come back too.
  - `POST /workspaces/roles/bin/:id/restore`: the role's permissions come back, and former holders still in the team get it again. Anyone moved to the default role by the delete leaves that role.
  - `POST /webhooks/bin/:id/restore`: the same URL, events and signing secret.
- **What changed since is respected.** A deleted label is dropped from an email or phone; a referrer or related customer that is gone is left out. A taken reference code or role name answers `409 RESTORE_CONFLICT` and the snapshot stays in the bin.
- **List** with `GET …/bin`. The webhooks bin never shows the secret.
- **Empty one early** with `DELETE …/bin/:id`, which only the workspace owner can do. A manager who could empty the bin could delete and then erase the undo.
- **Expiry.** Call `emptyCustomerBin`, `emptyRoleBin` and `emptyEndpointBin` from your cron to drop snapshots past the 30 days.
- **Client and hooks.** `listDeleted*`, `restore*` and `purgeDeleted*` on the client; `useDeletedCustomers`, `useDeletedRoles` and `useDeletedWebhookEndpoints` in React (and React Native) and Vue.

Apply the migrations before deploying: customers `016_customer_bin`, workspaces `006_role_bin`, webhooks `002_endpoint_bin`.
