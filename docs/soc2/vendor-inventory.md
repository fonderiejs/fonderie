# Vendor / subprocessor inventory

> **Draft for review.** The register the [Vendor Management Policy](../policies/vendor-management.md)
> requires. Review each vendor before onboarding and at least annually. A DPA is
> required wherever personal data is shared.

Owner: **Louis Choleski (founder, acting Security Officer)** · Last reviewed:
**2026-08-17**.

## In use today
| Vendor | Purpose | Data accessed | DPA | Security review | Notes |
|---|---|---|:--:|---|---|
| **Stripe** | Payments / billing (`@fonderie/billing`) | Customer billing data, payment metadata | **[confirm]** | Vendor is PCI-DSS + SOC 2 | Cardholder data handled by Stripe, not stored by Fonderie |
| **GitHub** | Source hosting, CI/CD, security advisories | Source code, CI logs | **[confirm]** | SOC 2 (GitHub/Microsoft) | Branch protection + OIDC publishing |
| **npm (npmjs)** | Package registry / OIDC publishing | Public package artifacts | n/a (public) | GitHub/Microsoft | Trusted Publishing, no tokens |

## To be added when production infrastructure is provisioned
| Vendor (TBD) | Purpose | Personal data? | Action before onboarding |
|---|---|:--:|---|
| Cloud host | Compute / networking | Yes (processes) | Security review + DPA |
| Managed Postgres | Primary datastore | Yes | Security review + DPA; enable PITR + KMS |
| Email / SMS / push provider | Transactional messaging (`@fonderie/courier`) | Yes (contact data) | Security review + DPA |
| Error tracking | Exception monitoring | Possibly (scrub PII) | Security review + DPA; PII scrubbing |
| Log / monitoring platform | Logs, metrics, alerting | Possibly | Security review + DPA; access controls |

---

Material subprocessor changes are disclosed to customers per contract. When a
vendor is added, move it to the "In use today" table with its review date and
DPA status. Referenced by the [control matrix](control-matrix.md) (CC9.2).
