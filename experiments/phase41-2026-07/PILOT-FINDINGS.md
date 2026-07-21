# Pilot findings — 2026-07-20 (directional, NOT the verdict)

A 2-condition pilot (`pb` + `fat`, sessions 1→2) to (a) validate the harness
end-to-end and (b) get an early read before the ~$50 full batch. Raw results in
`results/` (gitignored); scores in `SCORES.md`. **One sequence each — the
pre-registration is explicit that n=1 is directional, never a verdict.**

## Result (3-condition pilot)

| session | turns | cost | tsc | quality | resident K | cacheRead |
| --- | --- | --- | --- | --- | --- | --- |
| pb s1 (auth)      | 23 | $1.03 | ✓ | 12/12 | 1,547  | 588,836 |
| pb s2 (billing)   | 39 | $1.85 | ✓ | 9/9   | 5,643  | 1,616,429 |
| fat s1 (auth)     | 67 | $2.29 | ✓ | 12/12 | 27,999 | 2,309,909 |
| fat s2 (billing)  | 25 | $0.89 | ✓ | 9/9   | 27,999 | 610,595 |
| scratch s1 (auth) | 20 | $0.42 | ✓ | **10/12** | 0 | 315,684 |
| scratch s2 (bill) | 15 | $0.37 | ✓ | 8/9   | 0 | 172,210 |

### The two attribution methods DISAGREE (the headline finding)

| method | measures | pb/fat | band |
| --- | --- | --- | --- |
| A — static-K | resident artifact (CLAUDE.md vs skill dir) × turns | **0.099** | "fraction" |
| B — empirical | *all* cache_read above the scratch baseline | **0.706** | parity-plus |

They point at different verdicts. `analyze.mjs`'s guardrail fired:
*"methods disagree — instrument resident context directly before claiming."*

**Why (real, not noise):** Method A counts only what pb keeps *resident* — its
compiled CLAUDE.md is tiny vs fat's 28K skill (10%). Method B counts everything
pb pulls into context, including what `brain_query` streams in at runtime (inline
signatures via MCP). pb doesn't carry the knowledge resident, but it still
*fetches* it per session — so total knowledge cache_read is 71% of fat, not 10%.

**The pre-registered primary metric is "cache_read + input attributable to
skill/brain content" — closer to Method B.** So the honest read is
**parity-plus (0.71), not "fraction."** Method A alone would have over-claimed.
Catching that for ~$9 before a $50 batch is the pilot paying for itself.

### Quality finding (supports the fallback claim)

scratch auth is **below floor** (10/12 — missing logout/session-invalidation and
login rate-limit, the exact items Fonderie delegates by default); pb & fat scored
at ceiling in half the LOC (pb 60→125 vs scratch 118→318). Correctness density —
the pre-registered fallback for the ≥⅓ case — is intact and measured.

## Verdict against the promised goal

**Not delivered as headlined.** The locked rule: ≤⅓ → "fraction"; ⅓–1× →
parity-plus, *retire the "fraction" headline*; ≥1× → kill. On the metric closest
to the pre-registration, we are in **parity-plus** — so by our own rule the
"fraction of the token cost" claim is **dropped**, and the durable claim becomes
**correctness density** (audited, more-secure code in half the size).

Still n=1 → directional, not final. But it points away from ⅓, so the batch's
job shifts from "prove fraction" to "confirm parity-plus + quantify the
correctness gap" — the claim we can actually keep.

## What this does and does NOT establish

Establishes: harness works end-to-end; both attribution methods now run; the
direction is parity-plus, not fraction.

Does NOT establish (why it's not a verdict):
- **n = 1 sequence** per condition — no variance estimate.
- **Methods diverge 7×** — attribution not yet robust; resident-vs-fetched
  knowledge must be instrumented before any number is quoted as the answer.
- **Static-inspection scoring** — code read for correct wiring + `tsc`, apps not
  booted against Postgres.

## Bugs the pilot surfaced (all fixed)

- Harness died on forced Node color corrupting the pb `.mcp.json` (fix: PR #21).
- Published packages shipped migration loaders but not the `.sql` (fix: PR #22,
  republished; the fat session had to hand-write schema before the fix).

## Where to allocate resources to actually deliver the promised (≤⅓) goal

The pilot says the *current* pb design lands at parity-plus, not fraction. To
deliver the promised goal we must attack the thing Method B exposed: **pb pays
to fetch knowledge per session even though it keeps little resident.** More
benchmark runs won't change that — they'd just measure the same design more
precisely. The resource allocation is into the **product**, not more sessions,
in priority order:

1. **Scoped resident brain (highest leverage — likely the whole gap).**
   Method A vs B gap = knowledge pulled in at runtime via `brain_query` inline
   signatures. Today discovery streams a whole package's signatures into context
   on each new capability. If the resident CLAUDE.md were **scoped to only the
   packages the task touches** (the R2 concept enum already maps intent→concept
   →package), most of that fetched knowledge would either be resident-and-tiny
   or not pulled at all. This directly shrinks Method B's numerator. **Build as a
   new pre-registered condition `pb-scoped`** — do NOT silently swap it into `pb`
   (that's p-hacking the pre-registration).

2. **Trim the inline-signature payload.** `brain_query` returns full package
   signatures inline (the ce1 "one-shot" lesson). Measure how much of that the
   model actually uses; return the minimal sufficient slice (types + the few
   exports wired) rather than the whole surface. Every token here is Method-B
   overhead paid on every discovery.

3. **Amortization is unmeasured — the pilot only ran 2 of 4 sessions.** The
   "fraction" thesis is explicitly about *repeated* sessions where fat re-pays
   28K every turn while pb's resident cost grows slowly. Sessions 3–4 (teams,
   security) are where fat's fixed cost should compound. **The 4-session batch
   may move the ratio on its own** — cheapest lever, but only worth spending if
   #1/#2 are in place so we're measuring the improved design.

### Recommended sequence (cheapest-signal-first)

- **Do not spend the $50 batch yet.** It would precisely measure a design the
  pilot says misses the goal.
- Build **#1 (`pb-scoped`)** + **#2 (trim payload)** — engineering, ~$0.
- Re-run the **cheap 2-condition pilot** (`pb-scoped` vs `fat`, 1→2, ~$6) and
  check Method B. If pb-scoped/fat drops toward ⅓ → the goal is reachable; run
  the full N=3 batch to confirm. If it stays ~0.7 → the honest claim is
  parity-plus + correctness-density; run the batch to *quantify that*, and drop
  the fraction headline for good.

Full batch (when justified): **N = 3 × {fat, pb(-scoped), scratch} × 4 = 36
sessions** (~$50), `./stage41.sh`, score each with `score.mjs`, then
`analyze.mjs` — verdict only when both methods agree.
