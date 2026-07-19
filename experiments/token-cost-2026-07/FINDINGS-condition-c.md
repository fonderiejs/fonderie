# Phase 4 — Condition C findings (classified negative + reframe)

## Result

**The current brain architecture does not outperform fat-skill context loading
for a small scoped build task.** The failure mode: insufficient retrieval
density combined with the model's preference for compiler feedback over
drill-down retrieval.

Task: the naive auth prompt ("Add user accounts — sign up and log in"), same
skeleton/model/prompt as round 0-baseline. n=1 per condition-C variant (single
runs are noisy here — see below).

| condition | cache_read | cost | turns | output | LOC | tsc |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| scratch (median, n=3) | 153K | $0.34 | ~12 | ~5K | 117 | ✓ |
| B — fat skill (median, n=3) | 291K | $0.60 | ~17 | ~3.7K | 50 | ✓ |
| C — topology brain (c1) | 805K | $1.16 | 34 | 14.7K | 86 | ✓ |
| C — enriched brain (ce1) | 416K | $0.80 | 22 | 10.2K | 56 | ✓ |

Both condition-C variants are **more expensive than the fat skill and than
scratch.** The brain did not reduce token cost on this task; it increased it.

## Why (mechanism, established — not benchmark friction)

- **Apples-to-apples confirmed.** The condition-B workdirs survived: B installed
  the same real packages (auth, core, store, rate-limit, adapter-express) and
  produced tsc-passing builds, exactly like C. B did not cheat with throwaway
  code. So this is not environment friction.
- **The overhead is build-fix iteration, not retrieval.** Turn attribution on
  c1's 34 calls: only 5 retrieval (all <1ms), 1 install; the rest was writing +
  typechecking + fixing. The model reconstructed the exact API by iterating
  against `tsc`.
- **Root cause — retrieval density.** The brain serves *topology* (packages,
  requires-edges, routes, recipes, invariants) but not the *exact TypeScript
  signatures* the fat skill kept in-context (auth alone = ~276 lines of exact
  API). B one-shot correct minimal code from signatures it already had; C had a
  correct map but paid to recover the street signs.

## The two behavioral findings (more valuable than the cost number)

1. **"Right data, wrong channel."** The attempted fix served the exact
   signatures on `brain_node` (drill-down). The model called `brain_node`
   **zero** times in the enriched run — even though its description explicitly
   said "call this for every package you wire." It reconstructed against the
   compiler instead. **Tool design cannot assume `good API → agent uses it`.**
   This echoes Phase 2.5: models prefer local feedback (here, `tsc`) over
   multi-hop retrieval. Corollary for future brain design: richness must live in
   the channel the model *reliably* calls (`brain_query`), not behind an
   optional drill-down — but see the benchmark caveat before building that.
2. **Single-run variance is high.** c1 vs ce1 was 34 vs 22 turns for
   effectively the same path (the enriched channel was never used, so ce1 is
   *not* a test of the fix — its lower cost is variance, not the intervention).
   Any future comparison here needs ≥3 runs/variant to see through noise.

## Why we did NOT keep optimizing auth

Moving signatures into `brain_query` would make the query response resemble the
fat skill (query → 4K, query → 4K …). That risks winning the auth benchmark by
recreating the fat skill in disguise — optimizing toward the workload where
retrieval is *structurally disadvantaged*. The auth task is close to the
worst case for retrieval: the relevant slice is small enough that loading
everything up front is competitive.

The `brain_node` enrichment built for this test was **reverted** — untested
(uncalled), and pointing at the wrong channel.

## Reframe — the real question (new uncertainty frontier)

Retrieval only wins when **both** hold:

```
knowledge base size  >>  relevant slice size
        AND
retrieved slice is sufficient to complete the task
```

The auth benchmark satisfies only the first half weakly (one small package of
18). The value question is not "can we make brain cheaper on auth?" It is:

> **Where does the cost curve cross — and does the SaaS workload live beyond
> that point?**

### Phase 4.1 — Retrieval Advantage Benchmark (proposed, not yet run)

Measure cost across a workload gradient before touching architecture again:

| Workload | Expected winner |
| --- | --- |
| small isolated feature (e.g. add OAuth middleware) | fat skill |
| medium multi-package feature | unknown |
| large cross-domain (billing + permissions + webhooks + rate-limit + audit + tenancy) | brain hypothesis |
| repeated sessions (auth Mon, billing Wed, webhooks Fri, migrate storage next month) | brain hypothesis (fat skill pays 50K every session; brain queries the current need) |

Decision rule (pre-registered):
- brain loses **everywhere** → kill the cost thesis; the brain is a knowledge/
  correctness layer, not a cost-reduction strategy.
- brain wins **only in large / repeated** workloads → that is the product
  boundary; ship the brain for that regime, keep in-context for small tasks.

Repeated-sessions is likely the strongest SaaS argument (the 50K fat-skill load
amortizes badly across a month of small edits) and is the cheapest signal to
design for.

## Status

- Phase 2.6's stub-first retrieval-behavior result stands (unrelated to cost).
- Condition C (cost, small task): **classified negative**, documented above.
- Next: **Phase 4.1** benchmark design — measure where the cost curve crosses,
  not more auth runs. No further spend until the benchmark targets the regime
  where retrieval is supposed to win.
