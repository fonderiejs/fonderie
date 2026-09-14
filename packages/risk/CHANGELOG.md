# @fonderie/risk

## 0.2.7

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0

## 0.2.6

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0

## 0.2.5

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0

## 0.2.4

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 0.2.3

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 0.2.2

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 0.2.1

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 0.2.0

### Minor Changes

- 39f93a1: New brick: `@fonderie/risk` — a generic signal → meaning → decision engine.
  `assess(subject, ctx)` scores an action (trial start, login, registration,
  promo) against weak signals and a tunable ruleset and returns a graded verdict
  with reasons; `record()` reports the outcome. The engine **decides, never
  enforces** — it performs no external side effect; the app maps the verdict to
  an action. Ships the `trial.start` ruleset, a hashed `risk_events` store with a
  PII firewall, and peer-depends only on `@fonderie/core` + `@fonderie/store`.
  Experimental (0.x).
