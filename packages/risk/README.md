# @fonderie/risk

A generic **signal → meaning → decision** engine. Assess an action — a trial
start, a login, a registration, a promo redemption — against weak signals and a
tunable ruleset, and get back a graded **verdict with reasons**. What to *do*
with a verdict is your application's call.

> **Decides, never enforces.** The engine is pure and synchronous: it reads
> signals and returns a verdict. It never calls Stripe, sends an email, or
> cancels anything. Every side effect — deny, challenge, step-up MFA, revoke,
> alert — lives in your app, which has the context to do it right. This is what
> keeps the brick sound and reusable across subjects.

Status: **experimental** (0.x — API may move).

## Use it

```ts
import { RiskEngine, DEFAULT_RULESETS } from '@fonderie/risk';
import { getMigrationsPath } from '@fonderie/risk/migrations';
// run getMigrationsPath()'s SQL with your store's migration runner first.

const risk = new RiskEngine(store, {
  rulesets: DEFAULT_RULESETS,          // ships a 'trial.start' ruleset; add your own
  pepper: process.env.RISK_PEPPER,     // required in production
});

const verdict = await risk.assess('trial.start', {
  actorId: user.id,
  identifiers: [                        // hashed by the engine — raw values never stored
    { kind: 'card', value: cardFingerprint },
    { kind: 'device', value: deviceId },
    { kind: 'ip', value: ip },
    { kind: 'email-domain', value: emailDomain },
  ],
  attributes: { accountAgeMinutes, disposableEmail },
});

// The app maps the verdict to an action — the engine never does.
if (verdict.tier === 'high')   return deny(verdict.reasons);
if (verdict.tier === 'medium') return challenge();
await risk.record(verdict.assessmentId, 'allowed');   // makes the identifiers "seen" next time
```

## Rulesets are data

A ruleset binds a subject to weighted signals and tier thresholds — move
weights without a deploy. Signals are `reuse` (identifier seen before),
`velocity` (count in a window), or `attr` (a fact from the context). See the
shipped `TRIAL_START_RULESET`.

## What it stores

One `risk_events` table of **hashed** identifiers (sha256 + pepper — never raw),
with short retention and a hard wall against the analytics pipeline. `assess()`
writes provisional rows; `record()` promotes them to the real outcome;
`purgeExpired()` (call on a timer) enforces retention.

Peer-depends on `@fonderie/core` and `@fonderie/store`; imports no other brick.
See `docs/RISK-BRICK-DESIGN.md` for the full design.
