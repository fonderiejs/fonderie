---
'@fonderie/courier': minor
---

Add `replyTo` to the email channel

Needed as soon as an app sends from a dedicated sending subdomain — the shape
that isolates sending reputation from the apex, and the one every mature sender
converges on. Such a subdomain has no MX, so a reply to the From address
**bounces**.

Recipients do reply to transactional mail: a question about a receipt, a "this
wasn't me" about a password reset. A bounced reply is worse than no reply,
because the sender believes they reached you.

`replyTo` is optional and omitted from the payload entirely when unset — an
explicit null is a different thing to a provider API than an absent key. Wired
for both send paths (`reply_to` for the Resend API, `replyTo` for SMTP), and it
never substitutes for `from`: From carries the authenticated identity and DKIM
alignment, `replyTo` only routes human replies.
