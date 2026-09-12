# @fonderie/risk — design spec (for review)

Roadmap **P6**. A generic **signal → meaning → decision** engine: given an
action (a trial start, a login, a registration, a promo redemption), collect
weak signals, score them against a tunable ruleset, and return a **verdict with
reasons**. What to *do* with a verdict is the application's call.

> **Status: proposal, awaiting sign-off.** This doc is design-first on purpose
> — the trial-abuse enforcement it replaces failed adversarial review three
> times, and every failure came from one mistake this design forbids (§1). No
> package code is written until the open questions in §9 are answered.

Companion: `docs/PORTFOLIO-ROADMAP.md` (P6), `docs/ARCHITECTURE.md` (where this
brick sits), the trial-abuse history it generalizes.

---

## 1. The one principle: decide ≠ enforce

**The brick decides. The app enforces.** `@fonderie/risk` is pure and
synchronous: it reads signals and returns a verdict. It never calls Stripe,
never sends an email, never cancels anything, never mutates another brick's
state. Every external side effect — deny, challenge, step-up MFA, cancel a
subscription, alert — lives in the application, which has the context to do it
correctly (or to defer it).

This is not a stylistic choice. The trial-abuse enforcement failed review three
times, and every critical finding traced to the *brick* performing a
trial-specific side effect (canceling a Stripe subscription) across an
at-most-once event bus and async provider state. Splitting decide from enforce
removes that entire class of bug from the brick, and — not coincidentally — is
exactly what makes the engine reusable beyond trials.

---

## 2. Scope — one engine, many subjects

A **subject** names the action being assessed. The launch subjects:

| Subject | The question | App's action on a bad verdict |
| --- | --- | --- |
| `trial.start` | Is this a repeat free-trial? | deny / challenge / (app-owned) revoke |
| `auth.login` | Is this login anomalous? | step-up MFA / block / alert |
| `auth.register` | Is this a fraudulent signup? | require verification / block |
| `promo.redeem` | Is this coupon/promo abuse? | reject / cap per identity |

The engine is subject-agnostic; adding a subject is adding a ruleset (§4), not
code. `trial.start` is the first consumer (extracted from the proven
LeadEasyGen code); `auth.login` is the likely second.

---

## 3. The API — two calls

```ts
interface RiskContext {
  actorId?: string;              // the user id when known (login, trial)
  identifiers: Identifier[];     // { kind, value } — hashed by the brick on the way in
  attributes?: Record<string, string | number | boolean>;  // e.g. accountAgeMinutes
}
// Identifier kinds: 'card' | 'ip' | 'device' | 'email-domain' | … (open set)

interface RiskVerdict {
  score: number;
  tier: 'low' | 'medium' | 'high';
  reasons: { signal: string; weight: number }[];  // explainable — for logs / appeals
  assessmentId: string;                            // correlates the later outcome
}

class RiskEngine {
  // Pure decision: read the signal store, score against the subject's ruleset,
  // return a verdict. No side effects.
  assess(subject: string, ctx: RiskContext): Promise<RiskVerdict>;

  // Record what actually happened, so an identifier becomes "seen" for the
  // NEXT assessment. Separate from assess() because the outcome often depends
  // on side effects only the app can perform.
  record(assessmentId: string, outcome: 'allowed' | 'challenged' | 'blocked'): Promise<void>;
}
```

`assess` never returns an action, only a graded verdict. The reasons array
makes every decision explainable — required for user appeals and for tuning.

---

## 4. Rulesets — meaning as data, not code

A ruleset binds a subject to its signals, weights, windows, and tier
thresholds. It is **data** (see §9 for where it lives) so weights move without a
deploy — the lesson from the trial scorer.

```jsonc
{
  "subject": "trial.start",
  "signals": {
    "cardReuse":       { "weight": 75 },                      // alone → high
    "deviceReuse":     { "weight": 25 },
    "signupVelocity":  { "weight": 30, "window": "1h", "over": 3 },
    "disposableEmail": { "weight": 20 },
    "freshAccount":    { "weight": 10, "under": "10m" },
    "ipTrials":        { "weight": 10, "window": "24h", "over": 2 }
  },
  "tiers": { "medium": 30, "high": 70 }
}
```

The reuse question — *"has this identifier been seen in this subject before?"* —
is one generic query parameterized by `(subject, kind)`, whether the identifier
is a card at a trial or a device at a login.

---

## 5. State — one hashed-identity store + the PII firewall

Generalizes the trial-specific `trial_signals` into one table. The PII firewall
the trial spec insisted on becomes a first-class, reused property.

```sql
CREATE TABLE risk_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject       TEXT NOT NULL,        -- 'trial.start' | 'auth.login' | …
  actor_id      UUID,                 -- when known
  signal_kind   TEXT NOT NULL,        -- 'card' | 'ip' | 'device' | 'email-domain'
  value_hash    TEXT NOT NULL,        -- sha256(pepper ‖ kind ‖ value) — never raw
  outcome       TEXT,                 -- 'allowed' | 'challenged' | 'blocked' | 'pending'
  score         INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL  -- per-subject retention, purged on a timer
);
CREATE INDEX ON risk_events (subject, signal_kind, value_hash) WHERE value_hash IS NOT NULL;
```

**Firewall (built into the brick):** hashes never raw values · short
per-subject retention · legitimate-interest basis (fraud prevention) · a hard
wall keeping `risk_events` out of the pseudonymous analytics/telemetry pipeline.

---

## 6. Signals — three tiers behind one seam

Signals reach the engine through `ISignalProvider`, so a ruleset doesn't care
where evidence comes from:

- **Built-in** — reuse and velocity queries over `risk_events`;
  disposable-domain list; account/identifier age. Zero infra.
- **Composed from other bricks** — `rate-limit` buckets, `auth`
  verification/age, `billing` card fingerprint. Passed in as context; the risk
  brick imports **no** other brick (the `ctx.meta` composition rule).
- **Vendor adapters** — Stripe Radar / MaxMind / Fingerprint.com / Sift behind
  the seam, added only when hand-rolled rules stop keeping pace. Same pattern
  as `IBillingProvider`.

```ts
interface ISignalProvider {
  name: string;
  evaluate(subject: string, ctx: RiskContext): Promise<{ signal: string; value: number | boolean }[]>;
}
```

---

## 7. Where the brick sits

- **Tier:** capability brick. **Stability at launch: `experimental`** (per the
  P4 convention — it will ship with `fonderie.stability: "experimental"`).
- **Dependencies:** peers `core` + `store` (owns `risk_events`); optionally
  `events` if it subscribes to a bus for async signal capture. It does **not**
  depend on `auth` / `billing` / `rate-limit` — those compose in as context.
  This keeps `risk` low in the dependency graph and importable anywhere.
- **Consumes `rate-limit`, never reinvents it** — mechanical token-buckets stay
  in `rate-limit`; `risk` treats a bucket's state as one weighted signal.

---

## 8. What it explicitly does NOT do

- No external calls (Stripe, email, HTTP) — ever.
- No canceling, charging, or mutating subscriptions/sessions/state.
- No enforcement middleware that blocks a request on its own — it returns a
  verdict; the app's guard decides.
- No analytics export — `risk_events` is a closed fraud-prevention store.

The trial gate re-expresses cleanly on this: the app calls `assess('trial.start', …)`,
maps `high → deny`, `medium → challenge`, `low → allow`, records the outcome,
and — if it ever wants post-checkout card revocation — owns that risky logic
itself, as an explicit, separately-designed app concern.

---

## 9. Open questions — need sign-off before building

1. **Ruleset storage.** DB-backed (tunable live via an admin surface, like
   `config`) or a code/config file loaded at boot? DB is more flexible but adds
   a table + admin API; file is simpler and version-controlled. **Recommend:
   file/config at launch, DB later** if live-tuning is wanted.
2. **Is `record()` mandatory?** Some subjects (login) may only ever `assess`.
   Proposal: `record()` optional; a subject's ruleset declares whether reuse is
   tracked.
3. **Scope of the first cut.** Just `trial.start` (extract + prove the seam), or
   `trial.start` + `auth.login` together (prove genericity immediately)?
   **Recommend: `trial.start` first**, `auth.login` as the very next step.
4. **Card-reuse enforcement for trials.** The brick only *detects* reuse. Does
   LeadEasyGen (a) act at the gate synchronously only (sound, but can't catch
   the first cross-account reuse — a fresh signup has no card at gate time), or
   (b) own a post-checkout revocation path (the hard part that failed before)?
   **Recommend: (a) at launch; treat (b) as a separate, later app project.**
5. **Vendor adapters now or later?** **Recommend: seam now, no adapter yet.**

---

## 10. Rollout (once §9 is signed off)

1. Scaffold `@fonderie/risk` (peers core + store; `experimental`), `RiskEngine`,
   `risk_events` migration, the built-in signal providers, the `trial.start`
   ruleset.
2. LeadEasyGen consumes it for `trial.start`; delete the app's `trial_signals`
   table and the (now-closed) webhook-cancel machinery.
3. **Live pass** — real Postgres + Stripe test-mode — the validation still
   outstanding from the trial work.
4. Frontend/admin surface for verdicts + reason inspection (optional).
5. Second subject: `auth.login`.

Built by **extraction from working code**, not speculation — satisfying the
graduation criterion the trial spec set (needed by >1 subject, vendor seam
wanted, real model later).
