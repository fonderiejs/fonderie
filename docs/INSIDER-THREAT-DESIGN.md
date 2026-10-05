# Insider threat: a rogue manager or owner

Status: Phases 1–3 shipped (2026-10-05); 4–5 planned.

## 1. The scenario

A business runs one workspace with several people managing it. One of them is
leaving on bad terms — or their account was taken over — and sets out to do as
much damage as possible before anyone notices: remove the other managers and the
team, delete what can be deleted, cancel the plan, copy the customer list.

Fonderie has **one owner** per workspace. The other people "running" it are
**managers**: holders of the built-in manager role (`managerRoles`, default
`ADMIN`). The rogue is either a manager or the owner.

## 2. Audit (what the code allows, 2026-10-05)

**Already protected**
- Nobody removes the owner; the owner cannot leave without transferring first.
- Only the owner makes or unmakes managers and transfers ownership (#630 closed
  "a manager strips manager rights from everyone, the owner included").
- A manager cannot grant anyone a built-in role; a custom role named `ADMIN`
  grants nothing; built-in roles cannot be edited or deleted.
- Removing a member is a soft removal; invitations are cancelled, not deleted.
- Paid invoices and approved quotes are immutable; customers on a quote or
  invoice cannot be deleted.
- The event log cannot be deleted over HTTP, each row carries an HMAC, and
  account erasure redacts personal fields but keeps the rows — an actor's trail
  survives the actor deleting their account.
- The owner of a team with other members cannot delete their account (account
  deletion D4), so a rogue owner cannot orphan the team that way.

**A rogue manager can still**
- **remove every other manager** and every member (only the owner is protected);
- **archive the whole workspace**, locking everyone out;
- delete every custom role (permanently) and rewrite their permissions;
- hard-delete records the app lets managers delete (customers not on a quote or
  invoice, the app's own records);
- cancel the subscription immediately, remove the card;
- register a webhook to their own server (a live feed), page through every
  customer (an export).

**None of it is attributable or visible.** Team changes leave no event at all,
so the audit trail cannot say who removed whom; nobody removed or demoted is
told; the owner is not alerted.

**A rogue owner can additionally** transfer ownership with no confirmation and no
notice, and do everything a manager can.

## 3. Protections, in priority order

| # | Protection | What it stops |
|---|---|---|
| 1 | **Accountable trail** — every team, role, invitation and workspace change is an event naming the workspace, the actor and the target (ids only), readable in the audit trail. | "Who did this?" has an answer; SOC 2 CC7.2 / CC8.1. |
| 2 | **Managers can't act on managers** — only the owner removes a manager; only the owner archives the workspace. | One manager purging the others; one manager locking the whole team out. |
| 3 | **Tell people** — whoever is removed or loses manager rights is told; the owner is alerted to high-impact actions (member removed, webhook created, plan cancelled, burst of deletions). | Damage going unnoticed for days. |
| 4 | **Undo instead of destroy** — custom roles, customers and webhooks go to a 30-day restorable bin. | Permanent loss from a burst of deletes. |
| 5 | **Re-confirm the big moves** — transfer ownership, cancel immediately and delete a webhook ask for the password or a code; a transfer waits for the new owner to accept. | A hijacked session doing the irreversible in seconds. |
| 6 | **Velocity brake** — more than N destructive actions in M minutes pauses the actor's manager rights and alerts the owner. | A scripted purge. |

## 4. Phases

**Phase 1 — Trail + managers can't act on managers (workspaces).** ✅ #647.
- `fonderie.workspace.*` events after every successful team, role, invitation,
  settings and workspace change: `{ workspaceId, userId: <actor>, targetUserId?,
  roleId?, inviteId? }`. Ids only — never a name or an address — so the trail
  carries no personal data and survives erasure.
- `removeMember` refuses a manager unless the actor is the owner
  (`403 MANAGER_PROTECTED`), checked under the workspace lock.
- `POST /workspaces/archive` is owner-only.

**Phase 2 — Tell people.** ✅ `workspace-member-removed`, `-member-removed-alert`
(to the owner, when a manager removed someone), `-manager-removed`,
`-ownership-received`; 5 locales; sent by a subscriber on the trail events
(`teamNotices: false` turns it off). Still open: an owner digest of other
high-impact actions (webhook created, plan cancelled, deletion bursts) — those
live in other bricks and need their own trail first.

**Phase 3 — Undo bin.** ✅ customers, custom roles, webhook endpoints: a
snapshot of the record and everything attached, written in the delete's own
transaction, restorable with the same ids for 30 days (`…/bin`, `…/bin/:id/restore`);
only the owner empties one early; `empty*Bin` from the app's cron. Snapshot +
hard delete rather than a deleted-flag: no query anywhere changes, and unique
constraints are not held by invisible rows.

**Phase 4 — Step-up** on transfer / immediate cancel / webhook delete; transfer
acceptance.

**Phase 5 — Velocity brake**, built on @fonderie/risk (decide ≠ enforce: risk
decides, workspaces suspends the manager role, the owner restores).

## 5. Decisions

| # | Question | Decision |
|---|---|---|
| I1 | Who reads the trail? | Today any member can read `GET /audit` for their workspace. Phase 1 keeps that; restricting it to managers is a permission the app grants (`audit:read`), noted as a follow-up. |
| I2 | Archive by a manager | **Owner only.** Archiving locks every member out; it is the single most damaging call a manager had. Restore stays a manager action. |
| I3 | Payload content | Ids only. The audit view resolves names at read time, so an erased person shows as an id, as the deletion design requires. |
