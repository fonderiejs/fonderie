---
"@fonderie/config": patch
---

Test coverage + docs pass over the control plane: unit tests for the previously
proof-only paths (rollback config/secret, config/secret revisions, secret reveal,
delete secret), and a rewritten README documenting versioning, optimistic
concurrency, rollback, secrets (masked/encryptable), the admin HTTP surface, the
CLI, and push propagation. Dependencies confirmed minimal (zero runtime deps;
peers core/store/pg only).
