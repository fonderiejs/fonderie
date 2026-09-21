---
'@fonderie/courier': minor
---

Offer the sender-DNS check to the doctor; `email.senderDns` for what DNS cannot tell

`describeAdmin().checks` includes `courier.sender-dns` whenever an email
channel is configured (`senderDnsCheck()` is exported for apps that wire it
themselves). New optional `email.senderDns: { dkimSelectors, returnPathDomain }`
carries the two facts `checkSenderDns` cannot discover — a selector is not
readable from DNS, and SPF checks the envelope domain, not the From.
