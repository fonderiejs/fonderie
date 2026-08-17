# Information Security Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **[assign — e.g. CTO / Security Officer]** · Approver: **[assign]** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose
Fonderie, Inc. ("Fonderie") builds infrastructure that other companies trust with
their users' data. This master policy states our commitment to protecting the
confidentiality, integrity, and availability of that data and of our own systems,
and it anchors the sub-policies that implement it.

## 2. Scope
Applies to all employees, contractors, and systems that store, process, or
transmit Fonderie or customer data — production infrastructure, source code,
corporate accounts (email, chat, cloud), and endpoints. Third parties are bound
through contracts and the Vendor Management Policy.

## 3. Roles & responsibilities
- **Security Officer ([assign])** — owns this program, approves policies and
  exceptions, runs the annual review, and is the point of contact for security.
- **Engineering** — implements and operates technical controls; follows the
  Change Management and Secure SDLC policy.
- **All personnel** — complete security training, follow these policies, and
  report suspected incidents immediately.

## 4. Principles
- **Least privilege & need-to-know** for every access decision.
- **Defense in depth** — controls at the network, application, and data layers.
- **Secure by default** — the audited path is the default path (fail-closed
  auth, MFA, RBAC, rate limiting are on without opt-in).
- **Accountability** — actions are logged and attributable to a unique identity.

## 5. Policy
- Data is classified and handled per the **Data Classification Policy**.
- Access is granted per the **Access Control Policy** and reviewed quarterly.
- Cryptographic protection follows the **Cryptography Policy** (TLS in transit;
  encryption at rest; bcrypt passwords; encrypted MFA secrets).
- Changes ship only through the **Change Management Policy**; `main` is a
  protected branch (required PR + green CI).
- Events are logged and monitored per the **Logging & Monitoring Policy**.
- Incidents are handled per the **Incident Response Plan**, with customer
  notification within 72 hours where legally or contractually required.
- Availability is protected per the **Business Continuity & DR Policy**.
- Vendors are reviewed before onboarding and annually.
- Personnel are screened, trained, and offboarded per the **Personnel Security
  Policy**.

## 6. Exceptions
Any deviation must be documented, risk-assessed, time-boxed, and approved in
writing by the Security Officer, with a remediation date.

## 7. Enforcement
Violations may result in disciplinary action up to termination and, where
applicable, legal action.

## 8. Review
Reviewed at least annually and after any material change to the business,
systems, or threat landscape.
