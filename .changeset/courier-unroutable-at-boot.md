---
'@fonderie/courier': minor
---

Catch an undeliverable message type at BOOT instead of at the first user who
triggers it.

`dispatch` logs `no channels configured for message type` and returns. The
notice is published, never delivered, never retried — and the outbox reports
success, because the event WAS consumed: courier took it and chose to do
nothing. No metric moves. The only trace is a log line nobody reads.

That is not hypothetical. A real app lost three auth notices this way
(`oauth-linked`, `oauth-unlinked`, `oauth-registration`) simply because its
channel map was hand-written and the package had since added them — and a
`password-revoked` security notice would have been the fourth: a user's
password removed and the mail explaining why silently dropped.

The config guard now also reports the inverse of the gap it already caught: a
message type that ships a **default template** but is routed to **no channel**.
Shipping a package's defaults is a statement that the app means to send those
notices, so content-without-a-route is almost always drift. It flows through
`checkReadiness` as well as the boot warning, so it surfaces wherever the app
already reports health.

A type mapped to an **empty** channel list is understood as a deliberate
"this app does not send that one" (a phone OTP in an email-only product) and is
never reported. An ABSENT key is the drift. That distinction is what keeps the
guard worth reading rather than something to mute.

Deriving `channels` from the package's own `MESSAGE_KEYS` rather than listing
types by hand stops it drifting in the first place.
