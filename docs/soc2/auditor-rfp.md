# Request for Proposal — SOC 2 examination

> Template to send to CPA firms. Commercial values are pre-filled with proposed
> defaults (issue/response dates, contact, timeline) — **review and adjust before
> sending**. Keep every factual claim accurate — the readiness state below is
> intentionally honest so firms scope realistically.
>
> Contact: **Louis Choleski**, Fonderie, Inc. · security@fonderiejs.com · Issued:
> **2026-08-18** · Responses due: **2026-09-08**.

## 1. About Fonderie

Fonderie, Inc. builds **Fonderie** — an open-source (MIT), self-hosted backend
SDK (`@fonderie/*`) that other companies embed to run auth, billing, customers,
and related SaaS backends. Founder/acting Security Officer: **Louis Choleski**.
Headcount: **1 (solo founder)**. Website: fonderiejs.com.

## 2. Read this first — system boundary (scoping question)

**Fonderie is self-hosted.** The SDK runs inside each customer's own process and
database; Fonderie, Inc. does not, today, operate a multi-tenant production
service that stores end-customer data. This makes the SOC 2 **system boundary a
threshold question we need the firm to advise on**, not an assumption:

- What Fonderie, Inc. *does* run: source code + release supply chain (GitHub,
  CI, npm OIDC publishing), the marketing site (fonderiejs.com), and corporate
  SaaS (email, etc.). **Fonderie, Inc. operates no hosted API, dashboard, or
  managed offering and processes no end-customer data** — the SDK executes
  entirely within each customer's own environment.
- Open questions for proposers:
  1. Given the self-hosted model, is a SOC 2 the right attestation, or is the
     buyer signal better served by the **SDK's security posture** (e.g. the
     controls in our [control matrix](control-matrix.md)) plus a SOC 2 scoped to
     our **corporate/development environment and software supply chain**?
  2. If SOC 2, what is the defensible **system description** and boundary?
  3. Where would a **future managed/cloud offering** change scope? (None is
     currently planned.)

We would rather pay for the report our customers actually need than the
best-known acronym. Proposals should address this directly.

## 3. Scope we currently anticipate

Subject to §2, we expect:

- **Framework:** SOC 2 (AICPA TSP section 100).
- **Trust Services Criteria:** **Security (Common Criteria)** required;
  **Availability**, **Confidentiality**, and **Privacy** as advised (our
  [control matrix](control-matrix.md) already maps all four).
- **Report type:** **Type I** (design, point-in-time) first, then **Type II**
  (operating effectiveness) over a **6-month** window.
- **Environment:** software development lifecycle, change management, and release
  supply chain; corporate identity/access; **production infrastructure once provisioned for our own operations — see §4**.

## 4. Readiness state (honest)

We have completed a **codebase readiness assessment**; we are **not** claiming
SOC 2 readiness or certification.

- ✅ **Technical controls implemented and CI-enforced** — fail-closed prod config,
  RBAC/tenant isolation, MFA, at-rest encryption for MFA secrets, rate limiting,
  secure headers, tamper-evident audit log, secret scanning, SBOM, SHA-pinned
  actions, OIDC signed releases with provenance. Verified against a self-checking
  [control matrix](control-matrix.md).
- ◑ **Policies:** 13 written, **pending formal adoption**
  ([adoption record](policy-adoption-record.md)).
- ⛔ **Production infrastructure** (managed Postgres/TLS, PITR backups, KMS,
  secrets manager, log aggregation, IdP/MFA) **not yet provisioned**.
- ⛔ **Operating evidence** (risk assessment, access reviews, personnel controls)
  **not yet running**.

Full gating list: [readiness-punchlist.md](readiness-punchlist.md). We plan to
onboard an evidence platform (**evaluating: Vanta / Drata / Secureframe** — see
[vanta-onboarding.md](vanta-onboarding.md)).

## 5. What we're asking the firm to provide

1. Advisory on §2 (scoping / report fit) before fieldwork.
2. The SOC 2 examination and report (Type I, then Type II).
3. A gap/readiness review against our current state, if offered.
4. Named engagement team with SOC 2 experience for **developer-tool / OSS / SaaS**
   companies of our size.

## 6. Proposal requirements

Please include:

- Firm background: **CPA license/state**, AICPA peer-review status, # of SOC 2
  reports issued in the last year.
- Your position on the §2 scoping question.
- Proposed **timeline** from kickoff to Type I, and to Type II readiness.
- **Fee structure** (Type I, Type II, readiness review) — fixed vs. hourly,
  and any evidence-platform partnerships/discounts.
- Sample report or redacted example.
- Use of subcontractors/offshore; data handling of our evidence.
- Two **references** from comparable engagements.

## 7. Evaluation criteria

| Weight | Criterion |
|---|---|
| 30% | Quality of §2 scoping advice (fit for a self-hosted OSS model) |
| 25% | Relevant experience (dev-tool / SaaS, early-stage) |
| 20% | Total cost (Type I + Type II + readiness) |
| 15% | Timeline / availability |
| 10% | References & report quality |

## 8. Timeline

| Milestone | Date |
|---|---|
| RFP issued | **2026-08-18** |
| Questions due | **2026-08-28** |
| Proposals due | **2026-09-08** |
| Firm selected | **2026-09-19** |
| Target Type I | **Q4 2026** |
| Target Type II window start | **Q1 2027** |

---

**Submission:** email proposals to **security@fonderiejs.com** by the date above. Questions to the
same address. Non-binding; Fonderie, Inc. may decline all proposals. No fees for
proposing.
