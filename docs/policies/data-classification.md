# Data Classification & Handling Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Classify data by sensitivity and define handling rules for each class. Applies to
all Fonderie and customer data in any system.

## 2. Classes
| Class | Examples | Handling |
|---|---|---|
| **Public** | Marketing, open-source code, docs | No restriction |
| **Internal** | Internal docs, non-sensitive metrics | Employees/contractors only |
| **Confidential** | Customer business data, source (private), roadmaps | Need-to-know; encrypted in transit |
| **Restricted** | Credentials, tokens, keys, PII | Least privilege; encrypted at rest & in transit; access logged; never in logs/tickets/source |

## 3. Handling rules
- Each class defines allowed storage, transmission, access, and disposal.
- **Restricted** data: protected in-product today (bcrypt password hashes,
  AES-256-GCM MFA secrets) and, at production launch, encrypted at rest via a
  managed KMS; transmitted only over TLS, access-logged, and excluded from logs
  and error traces.
- Customer data is processed **only as needed** to provide the service (data
  minimization) and per the customer contract/DPA.
- Portable media and personal devices holding Confidential/Restricted data must
  be encrypted; prefer no local copies.

## 4. Review & enforcement
Reviewed annually. Enforcement per the Information Security Policy.
