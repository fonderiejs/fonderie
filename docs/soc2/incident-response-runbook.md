# Incident response runbook

> **Draft for review.** Operational step-by-step for handling a security
> incident — the concrete companion to the [Incident Response Plan](../policies/incident-response.md)
> (CC7.3–7.5). Keep it printable and current.

## Quick reference
- **Incident Commander / Security Officer:** Louis Choleski (founder)
- **Report channel:** GitHub → Security → *Report a vulnerability* (private), per
  [`SECURITY.md`](../../SECURITY.md)
- **Incident log:** `[link — tracker / doc]`

| Sev | Definition | Response |
|---|---|---|
| SEV1 | Confirmed breach / data at risk / major outage | Immediate, drop everything |
| SEV2 | Significant risk, contained or partial | Within 1 hour |
| SEV3 | Minor, no data exposure | Next business day |

## Phase 1 — Detect & declare (first 15 min)
1. Capture the signal: alert, report, or observation. Record time (UTC) and source.
2. Open an incident record; assign a SEV; you are Incident Commander until reassigned.
3. Start a timeline — append every action with a timestamp.
4. Do **not** alter or delete evidence; preserve logs.

## Phase 2 — Contain
Pick what applies. Product controls that help:
- **Suspected token/session compromise:** invalidate sessions. A password reset
  triggers `SessionModel.deleteByUser` (revokes all sessions); or delete the
  affected sessions directly. Access tokens die with their session (`sid`).
- **Leaked/weak signing secret:** rotate `jwtSecret` and redeploy — all existing
  tokens become invalid (fail-closed boot rejects a bad secret).
- **Leaked DB credential:** rotate the DB password/URL at the provider; the app
  reconnects with the new secret.
- **Leaked publish/CI credential:** revoke the token in GitHub/npm; because
  releases use OIDC (no static npm token), rotate any GitHub PAT/secret.
- **Compromised user account:** suspend the user (`suspended = true` blocks
  auth); force MFA re-enrollment.
- **Abuse / brute force:** rate limiting is already active; tighten limits or
  block the source at the edge if needed.
- **Suspected audit tampering:** run `verifyEventChain(store, key)` to identify
  altered rows.

## Phase 3 — Eradicate & recover
1. Remove the root cause (patch, revoke, reconfigure).
2. Restore affected data from a clean backup if needed (see [`../OPERATIONS.md`](../OPERATIONS.md)); verify integrity.
3. Confirm controls are back to their intended state; watch for recurrence.

## Phase 4 — Notify
- **Customers / regulators:** within **72 hours** of confirming a breach involving
  personal data, or per contract. Use the template below.
- **Internal:** keep stakeholders updated at a cadence matching severity.

## Phase 5 — Post-incident (within 5 business days)
Blameless post-mortem. Fill the template:
- **Summary** — what happened, in one paragraph.
- **Timeline** — detection → containment → recovery (UTC).
- **Impact** — data/users/systems affected.
- **Root cause** — the actual cause, not the symptom.
- **What went well / what didn't.**
- **Corrective actions** — each with an owner and due date; track to closure.

## Communication template (customer notice)
> Subject: Security notice regarding your Fonderie account
>
> On [date] we identified [brief description]. [What data was / was not affected.]
> We have [containment actions taken]. [What the customer should do, if anything.]
> We will follow up with [next update]. Questions: [contact].

---

Tabletop-exercise this runbook at least **annually**. Reference:
[Incident Response Plan](../policies/incident-response.md),
[control matrix](control-matrix.md) (CC7.3–7.5).
