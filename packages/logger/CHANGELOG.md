# @fonderie/logger

## 0.2.0

### Minor Changes

- 9e880d1: Request correlation, end-to-end (telemetry Phase 1). The logger's request
  middleware now honours an inbound `X-Request-ID` (client or load balancer) when
  it's a bounded, safe token, generates one only if absent/unsafe, and **echoes it
  in the response header** — so a single id threads the client call → server logs →
  audit trail and can be quoted in a bug report. `@fonderie/client` sends
  `X-Request-ID` on every request (uuid where available, a portable fallback for
  React Native/Hermes) and surfaces it on `FonderieApiError.requestId`.
  Metadata-only and pseudonymous — no payloads captured; IP-minimization policy and
  retention are separate follow-ups.

## 0.1.2

### Patch Changes

- efd6888: Verify OIDC Trusted Publishing after repo recreation (no functional change).

## 0.1.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.
- Updated dependencies [01a2b72]
  - @fonderie/core@0.1.5

## 0.1.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
