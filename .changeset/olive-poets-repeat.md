---
'@fonderie/courier': minor
---

Add `checkSenderDns` — verify the sending domain actually authorises us

Courier declares a `from` address; SPF, DKIM and DMARC live in public DNS, owned
by whoever runs the domain. Nothing connects the two, and a mismatch is **not** a
send failure: the provider accepts the message and the RECEIVER drops it or files
it as spam. No bounce, no error, no log — it usually surfaces as a customer
saying "I never got the email".

DNS-only by design: no provider API and no credentials, so it works with any SMTP
backend rather than only the ones that expose a domains endpoint. `resolveTxt` is
injectable, so tests never touch the network.

Three distinctions it exists to get right, each of which would otherwise produce
a false alarm on a correct setup:

- **SPF authenticates the envelope sender (Return-Path), not the From header.**
  Hosted senders put the Return-Path on their own bounce subdomain, so the From
  domain legitimately has no SPF and DMARC passes on aligned DKIM. An absent SPF
  is therefore only a *failure* when DKIM is absent too — otherwise it is advice.
  Pass `returnPathDomain` to check SPF where it actually applies.
- **DMARC is inherited; SPF is not.** With no `_dmarc` record on a sending
  subdomain a receiver falls back to the organisational domain, so the check
  walks up and reports which domain supplied it.
- **A DKIM selector cannot be discovered from DNS.** Without `dkimSelectors`
  there is nothing to look up, reported as skipped rather than missing.

`ok` tracks hard failures only. Advisory findings — a `p=none` DMARC policy, an
absent SPF covered by DKIM — are reported through `describeSenderDnsProblems`
without flipping it, so a deliberate choice does not leave a deployment
permanently red.

Two SPF records are reported as a problem: RFC 7208 makes that a permerror, which
receivers treat as having no SPF at all.
