# Auditor RFP — cover email

> Send with [`auditor-rfp.md`](auditor-rfp.md). Fill the **[bracketed]** values;
> keep the due date consistent with the RFP's §8. Honest by design — it states
> the infra/evidence gaps so no firm scopes against assumptions.

**Subject:** RFP — SOC 2 examination for Fonderie, Inc. (proposals due [date])

Hi [Name],

Fonderie, Inc. is evaluating CPA firms for a SOC 2 examination and I'd like to
invite [Firm] to propose. The full RFP is attached.

One thing worth flagging up front, because it shapes the engagement: **Fonderie
is a self-hosted, open-source backend SDK** — it runs inside our customers' own
infrastructure, so we don't currently operate a multi-tenant service that stores
their end-user data. Before scoping fieldwork, we're specifically looking for a
firm's view on whether a SOC 2 is the right attestation given that model, and if
so, what the defensible **system boundary** is (our corporate/development
environment and software supply chain vs. a hosted service). Section 2 of the RFP
covers this in detail.

To set expectations on where we are: our **technical controls are implemented and
continuously verified in CI**, our security policies are written and pending
formal adoption, and our production infrastructure and operating evidence are the
next things we're standing up. We're happy to walk you through the current
control set.

If you're interested, please send a proposal to [email] by **[date]** covering
the items in Section 6. Questions welcome to the same address.

Thanks,
Louis Choleski
Founder, Fonderie, Inc.
[email] · fonderiejs.com
