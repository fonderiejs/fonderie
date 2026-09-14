---
'@fonderie/auth': minor
---

Phone sign-ins now appear in login history.

A phone sign-in COMPLETES in `verify()`, not `login()`: `/auth/login` only sends
the code and issues a short-lived pending token, because possession of the phone
is the sole credential and issuing real tokens earlier would authenticate anyone
who typed a number.

Login history enumerated the login routes — `login()` and the OAuth callbacks —
and never looked in a route named `verify`. The phone flow predates that feature
by four months, so it was simply never covered. The security screen showed every
other method and silently omitted this one, which is worse than showing nothing:
an owner reading it concludes there were no phone sign-ins.

Success and both failure paths are recorded (`invalid_pin`, `expired_pin`) with
the caller's IP and user-agent. The failures matter most — a run of them is what
tells an owner someone is guessing at their phone login.

No migration: `fonderie_login_events.method` is an unconstrained TEXT column.
