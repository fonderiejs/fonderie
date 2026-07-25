---
"@fonderie/courier": minor
---

Production-readiness preflight: at boot (`CourierModule.install`) courier now
**warns when a message type is routed to a channel that has no registered
provider** — e.g. `email-verification → email` with no email provider, which the
dispatcher would otherwise silently drop (locking users out with
`requireVerification` on). Warn-only (channel setups vary legitimately; never
blocks boot). Checks the actually-registered channels, so channels added via
`registerChannel` count as present. Exported as `validateCourierConfig` for an
app's own preflight; `Dispatcher.channelNames()` lists registered channels.
