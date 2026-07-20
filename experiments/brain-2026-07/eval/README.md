# R2 concept-selection eval harness

Reproduces the **R2 pilot run** recorded in `BRAIN_PLAN.md` ("R2 update" +
"Pilot run"). It measures the one thing the concept-enum design rests on: can a
model map a naive, arbitrary-language request onto the correct concept ID when
it sees *only* the enum menu?

```
./run-eval.sh        # writes results.txt, prints per-language + overall tallies
```

For each row in `corpus.tsv`, a fresh `claude-haiku-4-5` is given the concept
menu (`node scripts/brain-query.mjs --concepts`) and the phrase, and must return
exactly one concept ID. That mapping — not any string match — is the R2
mechanism; the lookup behind it is deterministic.

## ⚠ This is indicative, NOT the official R2 gate

Two deliberate honesty limits, both of which keep this below the bar the gate
(and the R4 credibility discipline) require:

1. **The corpus is generated + translated, not real.** `corpus.tsv` is the 32
   canonical tasks phrased three ways:
   - `en` — the adversarially **generated** (`gen`) phrasings from
     [`../corpus.md`](../corpus.md); explicitly *not* real user language.
   - `fr`, `ro` — **translations of those** written for this harness, not
     native-user phrasings.

   The official gate needs **real** phrasings (Discord / support tickets / sales
   calls), per `corpus.md` ("at least half `real`"). None of these are real.

2. **The model is below gate spec.** The gate specifies `claude-opus-4-8`; this
   runs `claude-haiku-4-5` on purpose, as a conservative floor.

So treat the numbers as directional evidence that the mechanism works across
languages — not as a passed gate.

## Recorded result (`results.txt`)

96/96 — `en` 32/32, `fr` 32/32, `ro` 32/32 — after one curation fix (sharpened
`courier.messaging` to disambiguate password-reset emails from `auth.*`; see the
BRAIN_PLAN pilot note). Romanian was added with **zero code changes** — there is
no language in the system, only concept IDs the model maps onto.

## Files

| File | What |
| --- | --- |
| `corpus.tsv` | `lang <TAB> phrase <TAB> expected-concept-id`, 96 rows |
| `run-eval.sh` | the harness (repo-relative; 8-way parallel) |
| `results.txt` | the recorded pilot run, one `PASS`/`FAIL` line per phrase |

## When the real corpus lands

Replace/extend `corpus.tsv` with real user phrasings (keeping the same three
columns), rerun on `claude-opus-4-8`, and *that* run — not this one — is the
gate. Until then this proves the harness and the cross-language mechanism only.
