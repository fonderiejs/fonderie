---
'@fonderie/client': minor
---

Align `IUserDTO` and `IPlanDTO` with what the server actually sends

Three drifts between the client types and the server DTOs:

- `IUserDTO.skills` was declared as a required `IUserSkill[]`, but no endpoint has
  ever returned it — the server never mentions `skills` anywhere. Any code
  trusting the type and reading `user.skills.map(...)` would throw on undefined.
  Removed, along with the now-unused `IUserSkill` type and its export.
- `IUserDTO.isPhoneVerified` is sent by the server but was not declared, so it
  was invisible to hooks and screens.
- `IPlanDTO.pricingStale` is sent when pricing came from a stale cache during a
  provider outage. Now declared as optional so a billing screen can mark prices
  as indicative.
