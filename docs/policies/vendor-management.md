# Vendor / Subprocessor Management Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Ensure third parties that store or process Fonderie or customer data meet our
security bar. Covers all vendors and subprocessors with access to such data.

## 2. Policy
- Maintain a **vendor/subprocessor inventory** recording the data each accesses.
  - **In use today:** Stripe (payments), GitHub (source, CI, private security
    advisories), npm (package registry / OIDC publishing).
  - **To be added when provisioned:** cloud host, managed Postgres, email/SMS/push
    provider, error tracking, log/monitoring platform.
- **Before onboarding**, review the vendor's security posture (SOC 2 / ISO report
  or a security questionnaire) and sign a **Data Processing Agreement (DPA)**
  where personal data is shared.
- **Reassess annually** and on any material change to the vendor or the data
  shared.
- Access is provisioned least-privilege and **revoked promptly on
  decommissioning**.
- Material subprocessor changes are disclosed to customers per contract.

## 3. Review & enforcement
The inventory and reviews are owned by the Security Officer. Enforcement per the
Information Security Policy.
