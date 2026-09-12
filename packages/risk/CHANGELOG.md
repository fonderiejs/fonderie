# @fonderie/risk

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
