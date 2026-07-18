# Per-run checklist scores (round 0-baseline, 2026-07-18)

Rubric: `CHECKLIST.md`. Model claude-opus-4-8, naive prompt, isolated workdir.
✓ = pass, ✗ = fail. Scored by inspecting each run's produced `src/` (+ the
delegated `@fonderie/auth@1.3.0` behaviour for the fonderie condition).

| # | Criterion | a1 | a2 | a4 | b1 | b5 | b6 |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | Strong password hash | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 | Session/JWT signed | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3 | Secret from env, no insecure fallback | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| 4 | Sign-up endpoint | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5 | Login endpoint | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 | Logout / session invalidation | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| 7 | Input validation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8 | No credential leak | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 9 | Brute-force / rate limit | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| 10 | Parameterized DB access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 11 | tsc clean | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 12 | Password policy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| | **Total /12** | **9** | **9** | **9** | **12** | **12** | **12** |

## The 3 scratch failures are identical across all runs

- **#3** every scratch run ships `const JWT_SECRET = process.env.JWT_SECRET ||
  'dev-secret-change-me'` (a4: `'dev-only-insecure-secret-change-me'`) — a
  deployable insecure default. The fonderie runs read the secret from env and
  **throw** if absent (`if (!jwtSecret) throw` / `requireEnv('JWT_SECRET')`).
- **#6** no scratch run implements logout or session invalidation (stateless
  JWT, no revocation). `@fonderie/auth` mounts `/auth/logout`.
- **#9** no scratch run rate-limits login. `@fonderie/auth@1.3.0` enables
  brute-force protection by default (the auth-1.2.0 design lesson, now the
  module default); no fonderie run disables it.

These are exactly the "boring parts every product re-derives and re-ships the
same flaw" from FONDERIE.md — measured, not asserted.
