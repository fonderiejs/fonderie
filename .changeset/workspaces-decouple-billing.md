---
"@fonderie/workspaces": minor
---

Decouple workspaces from billing. `@fonderie/workspaces` no longer hard-depends on `@fonderie/billing` — you can register and boot workspaces (create/read/update, invitations, roles, members) without wiring billing or a Stripe provider. Billing stays an *optional* enhancement: when it's registered, seat limits on invitations are enforced; when it's absent, invitations are unlimited (fail-open, as before). Implementation also fixes an architecture-law violation — workspaces now reads billing's seat limit through `ctx.meta['billing']` (the sanctioned inter-package channel) instead of importing `getPlanLimit` from the billing package. Surfaced by the crewfinding backend rewrite (Phase 1), where a field-service app that only reads a workspace was forced to wire payments.
