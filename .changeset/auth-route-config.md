---
"@fonderie/auth": minor
---

Add `routes` to `IAuthConfig` — override the HTTP path (and optionally method) of any auth route, keyed by a stable id (`register`, `forgotPassword`, `me`, `updateProfile`, …). Lets an app match an existing frontend's contract **without a gateway or path shim** — e.g. `routes: { forgotPassword: '/auth/forgot-password', updateProfile: { method: 'PATCH', path: '/users/me' } }`. A bare string overrides the path; an object can also change the method; unset routes keep their defaults. Surfaced by the crewfinding rewrite: this eliminates the app-side path shim the Phase-1 re-run needed, taking adoption-under-an-existing-frontend to fully drop-in for the auth surface.
