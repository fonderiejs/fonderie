---
"@fonderie/config": minor
---

Config control-plane, phase 3 — the **secret** kind (ConfigMap vs Secret). A
separate `fonderie_secrets` table + read path sharing config's exact lifecycle
(version index, optimistic concurrency, advisory-locked writes, revisions,
rollback, push-notify) but with secret-grade exposure: admin `getSecret` /
`listSecrets` return **metadata only — never the value** (masked), and the value
is **encrypted at rest** via a pluggable `ISecretEncryptor` (`noopEncryptor`
default; `createAesGcmEncryptor(keyHex)` for real AES-256-GCM). `revealSecret` is
the single decrypt path. `pg_notify` payloads carry the environment only, never
the value. Exports: `setSecret`/`getSecret`/`revealSecret`/`listSecrets`/
`rollbackSecret`/`listSecretRevisions`/`deleteSecret`, `ISecretEntry`/
`ISecretRevision`, `ISecretEncryptor`/`noopEncryptor`/`createAesGcmEncryptor`.
