---
"@fonderie/logger": minor
---

Move `@fonderie/core` from `dependencies` to `peerDependencies`. Core holds module-level shared state (the `background()` runner registry), and the repo convention — now written in `docs/ARCHITECTURE.md` — is that a brick importing a stateful brick declares it as a peer, so the whole app shares exactly one copy.

This is a **minor**, not a patch, because it changes what a consumer must have installed. On npm 7+ (auto-installed peers) nothing changes. On pnpm strict mode, npm <7, or with `--legacy-peer-deps`, installing `@fonderie/logger` *without* `@fonderie/core` previously worked (the hard dep pulled core in) and now reports a missing peer — install `@fonderie/core` alongside it. Unlike the customers/workspaces peer fix, those consumers were not already broken, hence the bump.
