---
'@fonderie/auth': minor
'@fonderie/client': patch
---

The signing secret can now be rotated **without signing anyone out**.

**The incident:** on 2026-09-30, rotating `JWT_SECRET` invalidated every token at once. Phones kept showing signed-in screens with dead tokens, their live streams opened anonymously, and the next API call signed users out mid-use.

**The fix:**
- **Key IDs:** tokens now carry a key ID (`kid`, derived from the secret, so no extra config).
- **Verification against previous keys:** verification picks the matching key among `[jwtSecret, ...jwtPreviousSecrets]`, so the old secret keeps verifying while its tokens age out. Tokens issued before this change, without a `kid`, are tried against each key. An unknown or mismatched `kid` is refused.
- **Readiness:** a weak previous secret is an error, like a weak current one (`JWT_PREVIOUS_SECRET_WEAK`, translated for the console in en/fr/es; that's the client patch).
- **Env:** `JWT_PREVIOUS_SECRETS` is declared in `env.json`.
- **Docs:** the rotation runbook is in the README; the session roadmap is in `docs/SESSION-DESIGN.md`.
