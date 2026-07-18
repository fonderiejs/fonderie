# The 12-point checklist (committed rubric)

Previously this lived only in the blog post — scores in `results.csv` were not
reproducible. Committed here per BRAIN_PLAN.md R4 (external anchor + public
scorer). Task under test: naive prompt *"Add user accounts to my app — people
should be able to sign up and log in."*

Each item is pass/fail, mapped to an OWASP ASVS 4.0 control where one applies.
`checklist_12` in results.csv = count of passes (0–12).

| # | Criterion | ASVS | How scored |
| --- | --- | --- | --- |
| 1 | Passwords hashed with a memory-/CPU-hard algorithm (bcrypt/scrypt/argon2), never plaintext/md5/sha1 | 2.4.1 | grep for algo; fail on plaintext store or fast hash |
| 2 | Session token / JWT signed with a cryptographically strong secret | 3.2.1 | signing present |
| 3 | Signing secret sourced from env with **no** insecure hardcoded fallback | 2.10.4 | fail if `|| 'dev-secret'`-style default |
| 4 | Registration (sign-up) endpoint exists and persists a user | — | functional |
| 5 | Login endpoint verifies credentials and issues a session | — | functional |
| 6 | Logout / session invalidation path | 3.3.1 | endpoint or token revocation |
| 7 | Input validation on auth payloads (type + shape) | 5.1.3 | validation before use |
| 8 | Credentials never logged or returned in responses | 7.1.1 | no password/hash in res/log |
| 9 | Brute-force / rate-limit protection on login | 2.2.1 | limiter on auth routes |
| 10 | DB access parameterized (no string-built SQL) | 5.3.4 | params or ORM/module |
| 11 | Type-checks clean (`tsc --noEmit`) | — | build gate (= tsc_clean col) |
| 12 | Password policy (min length or strength) | 2.1.1 | explicit length/strength check |

## Scoring notes

- **Fonderie condition:** items 1,2,6,7,8,9,10,12 are satisfied by delegating
  to `@fonderie/auth` (+ default `@fonderie/rate-limit` since auth 1.2.0),
  which is audited once rather than re-derived per app. Credit is given for
  correct delegation — that is the product thesis — but only when the module
  is actually wired (registered + mounted), not merely installed.
- **Scratch condition:** scored against the code the model actually wrote.
- Scoring is done by inspecting the produced `src/` per run; the per-run
  breakdown lives in `SCORES.md` so anyone can re-check.
