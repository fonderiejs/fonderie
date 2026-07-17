---
"@fonderie/workspaces": minor
---

Remove the dead `defaultRole` config option. It was never read by any code
path and its documented `'member'` default never existed; since 1.1.1
invitations without an explicit `roleId` always resolve to the seeded
system GUEST role. Passing `defaultRole` was silently ignored before —
now it's a compile error, which is the honest signal.
