# @fonderie/risk

## 0.3.4

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0

## 0.3.3

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0

## 0.3.2

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0

## 0.3.1

### Patch Changes

- 10d3f42: Every backend brick now ships `env.json`, exported as `@fonderie/<brick>/env.json`, declaring the environment variables it depends on. For each variable the declaration says:
  - where the value comes from: read directly, fed through an option, or set by the host platform;
  - whether it is required, and whether it is a secret;
  - how it is validated and how to generate it;
  - which option it feeds;
  - its all-or-nothing feature groups, such as Sign in with Google or S3.
  
  Bricks that read nothing declare `"vars": []`.
  
  `@fonderie/cli` gains the resolver the upcoming `fonderie env` commands and the admin console build on. It walks an app's `@fonderie/*` dependencies, following their dependencies and required peers but skipping optional peers the app did not install, and merges the declarations into one list. Two bricks declaring the same name with a different kind or secret-ness are an error, never a silent pick.
  
  The monorepo's new `check:env-declarations` CI gate keeps the declarations true:
  - every `process.env` read in a brick's source is declared;
  - every variable declared as read directly is actually read;
  - all bricks resolve together without conflict.

## 0.3.0

### Minor Changes

- 8dd41f4: The risk pepper is held to core's shared secret rule (`secretStrengthProblem`: at least 32 characters, no placeholder words) instead of a private three-word denylist. In production, a pepper that passed before but contains a placeholder word such as `change-me`, `example` or `placeholder` now refuses to construct `RiskEngine` — generate one with `openssl rand -hex 32`.

## 0.2.17

### Patch Changes

- Updated dependencies [4a4541f]
  - @fonderie/core@0.23.0

## 0.2.16

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0

## 0.2.15

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0

## 0.2.14

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

## 0.2.13

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 0.2.12

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0

## 0.2.11

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 0.2.10

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 0.2.9

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0

## 0.2.8

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0

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
