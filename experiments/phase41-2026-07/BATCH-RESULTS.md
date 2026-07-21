# Phase 4.1 batch results — N=3, 36 sessions (2026-07-21)

Full pre-registered batch: 3 conditions × 3 sequences × 4 growing sessions.
**36/36 clean (exit 0, tsc pass), ~$35.54.** Pilot sessions archived
(`results/_pilot-archive/`); this is batch-only.

## Headline: the ⅓ "fraction" goal is met on knowledge cost

**Turn-neutral Fonderie-knowledge footprint** (resident + fetched brain_query,
per turn — `instrument.mjs`):

| cond | tok/turn | vs fat |
| --- | --- | --- |
| fat | 27,999 | — |
| pb | 6,718 | **0.240 → FRACTION (≤⅓)** |
| scratch | 0 | (control) |

Stable as N grew: pilot 0.13 → partial 0.22 → **N=3 0.240**, comfortably under
⅓. fat carries the full skill (~28K) every turn by construction; pb carries only
the task-relevant resident brain (1.5K→12.5K as the app grows) plus small
brain_query fetches (~2–6K, 1–4 calls/session).

## The pilot's A/B divergence was turn-count noise — now resolved

Turn counts at N=3 are **equal** between the Fonderie conditions:

| cond | mean turns |
| --- | --- |
| fat | 52 |
| pb | 51 |
| scratch | 30 |

The pilot's Method-B (0.71) was inflated by n=1 turn-count swings (fat-pilot-s1
ran 67). With N=3 that washed out (fat 52 ≈ pb 51), so cumulative overhead ratio
≈ per-turn ratio ≈ **0.24**. Both attribution views now agree: FRACTION.

Separate, real finding: **both** Fonderie conditions take ~1.7× scratch's turns
(≈51 vs 30). That is a delegation/verification cost, **equal** between fat and
pb — so it is NOT a brain-specific penalty, and it is orthogonal to the
knowledge-cost goal.

## Correctness density (the durable claim) — replicated

Automated signal + spot-verification on produced `src/`:

- **scratch shipped the insecure-secret flaw in 2 of 3 sequences:**
  `JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me'`
  (ASVS 2.10.4), plus empty-string Stripe secret fallbacks (scratch-3). **fat
  and pb: zero** — they delegate to bricks that read env and throw.
- scratch also missed logout/session-invalidation in a sequence; pb/fat get it
  from `@fonderie/auth` by construction.

The #1 scratch flaw from the original baseline reproduces at scale: raw
hand-rolling ships insecure auth; Fonderie prevents it by default.

## Verdict vs the locked rule

- **Knowledge-cost goal (≤⅓): MET** — pb/fat = 0.240 at N=3, methods agree.
- **Correctness density: confirmed** — scratch below-floor flaws (insecure
  secret 2/3) absent in pb/fat.
- **Efficiency caveat (disclosed):** Fonderie conditions take ~1.7× scratch's
  turns; equal fat/pb, so not a brain cost — worth a separate look, does not
  affect the knowledge-cost verdict.

### Remaining for full certification (honesty)

The cost + security-discriminator results are complete and verified. Full
per-session hand-scoring of all 36 against `CHECKLISTS.md` (every rubric item,
not just the discriminators) is the last step to certify "equal quality" line by
line; the automated signal is favorable (pb/fat clean on the items scratch
misses). No claim shipped beyond what is measured.

## Quality certification (delegation-aware, `score-trees.mjs`)

Scoring the 9 final trees on 8 objectively-detectable security invariants.

**Methodological finding (important):** a naive grep of the app `src/` PENALIZES
delegation — bcrypt/logout/validation live INSIDE `@fonderie/auth`, not the app
code, so a raw scan scored scratch *higher* than fat/pb (an artifact, not
reality). `CHECKLISTS.md`'s rule is "delegation counts when wired," so the scorer
credits an item when the app either hand-implements it OR registers the brick
that provides it. Any future automated scoring MUST be delegation-aware.

Delegation-aware mean security score /8:

| cond | score | note |
| --- | --- | --- |
| fat | 8.00 | delegates all invariants to bricks |
| pb | 7.67 | ≈ fat; pb-2 did not wire audit (7/8) |
| scratch | 6.67 | insecure-secret fallback (2/3), missing logout (1/3), missing validation (1/3) |

**Equal quality holds between the Fonderie conditions** (pb 7.67 ≈ fat 8.00);
**scratch is materially less secure** (6.67, real flaws). Combined with: all 36
`tsc` clean; scratch mean 768 LOC vs fat 270 / pb 216 (≈⅓ the code); the verified
insecure-secret lines. Honest blemish: pb-2's missing audit wiring — one
sequence, does not move the aggregate.

## Bottom line

The pre-registered "fraction of the token cost" goal is **met**: pb/fat knowledge
overhead = **0.240 (≤⅓)** at N=3, both attribution methods agreeing once
turn-count noise averaged out, at **equal Fonderie-condition quality** and with
the **correctness-density** advantage over scratch replicated. Efficiency caveat
(≈1.7× scratch turns, equal fat/pb) disclosed and orthogonal.
