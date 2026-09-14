---
'@fonderie/auth': minor
---

Warn when a security event is recorded with no caller identity at all.

A real HTTP request arriving through an adapter carries a user-agent and a
resolved client IP. BOTH being absent means the context was built by hand —
almost always `fonderie.handle(new Request(...))` called directly, with the
caller's headers dropped and no `{ meta: { clientIp } }` seed.

Nothing fails. The sign-in works, the session opens, and the damage only
appears later in login history: "Unknown device" with no IP, and only for the
affected method — which reads as a display bug rather than missing security
data. It happened on an OAuth callback, so the blank rows were exactly the
sign-ins whose history matters most.

Reported once per process, because the condition is a property of how the app
is wired rather than of any one request, and repeating it per login would bury
it. The message names both halves of the fix: forward the user-agent header,
and pass the resolved IP as `handle(req, { meta: { clientIp } })` — resolved
with `resolveClientIp` from `@fonderie/core/middlewares` rather than read off
the socket, or a proxied deployment records the proxy.

Only one of the two missing is deliberately NOT reported: a request can lack a
user-agent, and an IP can be unresolvable on some transports. Both missing
together is the signature worth flagging, and keeping it that narrow is what
stops the warning becoming noise people mute.
