# Data Retention & Disposal Policy

> **Status:** ADOPTED — effective 2026-08-18, approved by Louis Choleski (founder,
> acting Security Officer). Reviewed at least annually and on material change.
> Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 1.0 · Effective: **2026-08-18** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Define how long Fonderie keeps data and how it is securely disposed of. Covers
customer data, audit/event logs, backups, and application logs.

## 2. Retention schedule
| Data | Retention | Notes |
|---|---|---|
| Audit / event log | **1 year** | Then purged via `purgeEvents` |
| Soft-deleted user accounts | **30 days** | Then hard-deleted via `purgeSoftDeletedUsers` |
| Application logs | **90 days hot / 1 year archived** | Per Logging Policy |
| Backups | **30 days** | Per BC/DR Policy |
| Customer data (active) | Life of the contract + **30 days** | Then deleted |

## 3. Disposal
- Aged records are purged on a **scheduled job** using the in-product helpers
  (`purgeEvents`, `purgeSoftDeletedUsers`); backups age out per BC/DR.
- Disposal is logged.

## 4. Right to erasure & portability
- Deletion requests are honored within **30 days**.
- Users can export their own data via the **SAR endpoint** (`GET /users/export`),
  which returns profile and session metadata and excludes secrets.

## 5. Review & enforcement
Reviewed annually. Enforcement per the Information Security Policy.
