# Access review register

> **Draft template for review.** Records the periodic access reviews required by
> the [Access Control Policy](../policies/access-control.md) (CC6.1–CC6.3).
> Perform at least **quarterly** and on any role change or departure. Keep this
> file current — a completed review row is the audit evidence.

Owner: **Louis Choleski (founder, acting Security Officer)** · Cadence:
**quarterly** · Last review: **[date]** · Next due: **[+3 months]**.

## 1. Systems in scope
Every system that grants access to Fonderie or customer data. Update as
infrastructure is provisioned.

| System | What it grants | MFA | Notes |
|---|---|:--:|---|
| GitHub (`fonderiejs`) | Source, CI/CD, releases, branch protection | Required | Org owner set; CODEOWNERS routing |
| npm (`@fonderie`) | Package publish (OIDC) | Required | Trusted Publishing; no static tokens |
| Stripe | Billing dashboard / API | Required | Payments subprocessor |
| Cloud host | Production compute | Required | **[to be provisioned]** |
| Managed Postgres | Production data | Required | **[to be provisioned]** |
| Secrets manager / KMS | Production secrets & keys | Required | **[to be provisioned]** |
| Log / monitoring | Logs, alerts | Required | **[to be provisioned]** |

## 2. Access matrix (who has what)
One row per person × system. Principle: least privilege.

| Person | System | Role / privilege | Granted | Justification |
|---|---|---|---|---|
| Louis Choleski | GitHub | Org owner / admin | [date] | Founder / maintainer |
| Louis Choleski | npm | Publish (via OIDC) | [date] | Releases |
| Louis Choleski | Stripe | Admin | [date] | Billing owner |
| _(add rows as the team grows)_ | | | | |

## 3. Review log
Record each review. "Changes" = access removed/added and why.

| Review date | Reviewer | Systems reviewed | Findings / changes | Sign-off |
|---|---|---|---|---|
| [YYYY-MM-DD] | Louis Choleski | All | [e.g. none / revoked X] | ✅ |

## 4. Procedure
1. For each system, list current accounts and privileges.
2. Confirm each is still needed and least-privilege; remove anything stale.
3. Verify MFA is enabled on every account.
4. Confirm departed personnel have **no** remaining access (ties to the
   [Personnel Security Policy](../policies/personnel-security.md), ≤24h revoke).
5. Record the review in §3 and note any changes.
