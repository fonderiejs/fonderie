# Data Retention & Disposal Policy

> **Status:** ADOPTED — effective 2026-08-18, approved by Louis Choleski (founder,
> acting Security Officer). Reviewed at least annually and on material change.
> Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 1.0 · Effective: **2026-08-18** · Review: at least
> annually and on material change.
>
> **Version 1.1 — DRAFT, awaiting approval (2026-10-05).** Material change: the
> account-deletion workflow (§4) replaced the bare 30-day purge. Until approved,
> version 1.0 is in force; the changes are listed in §6.

## 1. Purpose & scope
Define how long Fonderie keeps data and how it is securely disposed of. Covers
customer data, audit/event logs, backups, and application logs.

## 2. Retention schedule
| Data | Retention | Notes |
|---|---|---|
| Audit / event log | **1 year** | Then purged via `purgeEvents` |
| Accounts whose deletion was confirmed | **30 days** (grace period, restorable) | Then erased in every module via `runAccountDeletionSchedule` (§4) — unless under a legal hold |
| Deleted customers, roles, webhook endpoints (undo bin) | **30 days** | Restorable, then purged by the scheduled job; only the workspace owner removes one early |
| Erasure receipts | **Life of the service** | No personal data: identifiers as keyed hashes only (§4) |
| Financial records of an erased account (invoices, ledger, subscriptions) | **As accounting law requires** (6–10 years by jurisdiction) | Pseudonymized: keyed by an id that no longer resolves to a person |
| Application logs | **90 days hot / 1 year archived** | Per Logging Policy |
| Backups | **30 days** | Per BC/DR Policy |
| Customer data (active) | Life of the contract + **30 days** | Then deleted |

## 3. Disposal
- Aged records are purged on a **scheduled job** (daily) using the in-product
  helpers (`purgeEvents`, `runAccountDeletionSchedule`); backups age out per BC/DR.
- Disposal is logged.

## 4. Right to erasure & portability
Users can export their own data via the **SAR endpoint** (`GET /users/export`),
which returns profile and session metadata and excludes secrets.

Account deletion (design: `docs/ACCOUNT-DELETION-DESIGN.md` in the product repo):

1. **Proof.** The person asks from a signed-in session and confirms with a
   one-time code sent to a verified channel they choose (email or SMS); with
   two-factor on, also their second factor. A person who owns a team with other
   members must transfer it first.
2. **Archive.** On confirmation the account is archived at once: sessions end,
   it cannot sign in, teams no longer show it, and billing is set to cancel at
   period end. The person is told the deletion date.
3. **Grace period — 30 days.** Signing in shows the request and deletion dates
   and offers to keep the account. One reminder is sent 7 days before the date,
   on the same channel, only if the person has not tried to sign in since.
4. **Erasure.** On the date, the daily schedule erases what every module holds
   about the person (payment-provider customers, workspaces they alone own,
   memberships, avatars, message logs, event payloads, webhook deliveries,
   customer-record authorship) **before** the account row is deleted. If any
   module fails, the account stays archived and the next run retries; nothing
   is half-erased. Erasure therefore completes on the first daily run after the
   30-day period.
5. **Receipt.** Each erasure leaves a receipt: request, reminder and erasure
   dates, what each module erased or kept and why, and who initiated it (the
   schedule, or an operator). The email and phone are stored only as keyed
   hashes, so a receipt proves an erasure without identifying anyone; an
   operator finds one by the address the person used.

Operator controls (admin console, every action recorded in the admin log):

- **Cancel on request** — the account is restored and the person is told.
- **Legal hold** — required reason; the schedule neither reminds nor erases the
  account until an operator lifts it (lifting requires a fresh second factor).
  Use only for a documented legal or fraud reason, and review open holds
  monthly.
- **Erase now** — for an urgent, verified request, only on an account the person
  already asked to delete and that is not held; requires a fresh second factor.
- **Receipts export** (CSV / JSON) — the auditor's evidence of erasure.

**What is kept, pseudonymized:** financial records required by accounting law
(see §2), and the security audit trail keyed by the opaque user id.

**Backups** are not rewritten; they age out per BC/DR (30 days). **Before
restoring a backup**, export the erasure receipts; **after**, erase again every
account listed with an erasure date later than the backup — otherwise a
restore brings erased people back.

## 5. Review & enforcement
Reviewed annually. Enforcement per the Information Security Policy.

## 6. Changes in version 1.1 (draft)
- §2: deleted accounts are erased in every module, not only the account row;
  added erasure receipts and pseudonymized financial records.
- §3: the purge helper is `runAccountDeletionSchedule`.
- §2: the undo bin — deleted customers, custom roles and webhook endpoints
  are kept 30 days for restore (insider-threat protection), then purged.
- §4: the deletion workflow (proof, archive, reminder, erasure, receipt),
  operator controls (cancel, legal hold, erase now, receipts export), and the
  backup-restore re-erasure step.
