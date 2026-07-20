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

**119/120** on the current corpus. By provenance:

| Provenance | Result | What it is |
| --- | --- | --- |
| `gen` | 32/32 | generated English canonical phrasings |
| `translated` | 64/64 | FR + RO translations of those |
| `forum` | **23/24** | **real** Stack Overflow titles (first real-data signal) |

The `forum` rows are the payoff of the harvesters below: real developer phrasings,
not ours. 23/24 with a below-spec model clears the ≥90% bar. The one miss —
"Laravel Spark -- configure both flat rate **+** per seat pricing?" → picked
`billing.subscriptions`, expected `billing.per-seat` — is a **compound** request
naming two concepts at once; the pick is defensible, a fuzzy-boundary case, not a
mechanism failure. (Earlier the `gen`/`translated` set needed one curation fix —
sharpened `courier.messaging` vs `auth.*`; see the BRAIN_PLAN pilot note.)

Still **not the official gate**: `forum` is search-register, not a live client's
words, and the model is below spec. But it's the first evidence the enum holds on
phrasings we did not write.

## Files

| File | What |
| --- | --- |
| `corpus.tsv` | `lang <TAB> phrase <TAB> expected-concept <TAB> source`, 120 rows (32 `gen`, 64 `translated`, 24 `forum`) |
| `run-eval.sh` | the harness (repo-relative; 8-way parallel; ignores the `source` column) |
| `results.txt` | the recorded run, one `PASS`/`FAIL` line per phrase |

## Harvesting real phrasings (`extract-phrasings.mjs`)

The most authentic pre-launch source of *real* phrasings is your own Claude
Code transcripts: the developer asking an assistant to wire a capability, in
their own words. `extract-phrasings.mjs` scans `~/.claude/projects/**/*.jsonl`,
keeps only human-typed prompts, **excludes experiment-run transcripts** (those
hold generated prompts — harvesting them would recontaminate the corpus),
prefilters by the curated capability terms, and writes `candidates.tsv`.

```
node extract-phrasings.mjs > candidates.tsv   # then REVIEW, don't trust
```

It **proposes**; you dispose. Nothing becomes a `real` row until you read the
candidate, pick one concept, and move it into `corpus.tsv` by hand. That review
step is the R4 firewall against laundering generated text into "real".

**Current yield: ~0 usable real phrasings (finding, 2026-07-19).** A first pass
over the existing transcripts surfaced almost no genuine "add a capability"
requests — because these sessions were spent *building Fonderie* (the brain,
landing, planning, releases), not building a SaaS *with* it. The candidates were
noise (Claude-account logins matching the `login` alias; meta-questions about
the brain's own rate limit). The real corpus therefore still awaits:

- **archetype build sessions** — transcripts of building the crewfinding app
  (and later archetypes) *on* Fonderie, where "add billing / teams / roles"
  requests actually occur;
- **post-launch support / Discord / sales-call** language once clients are live.

`candidates.tsv` is gitignored — it's a per-machine scratch output, not corpus.

### Public sources while pre-launch (`fetch-reddit.mjs`)

Until real build/support data exists, the best public source is **Reddit** —
r/SaaS, r/webdev, r/nextjs, … where devs ask to wire these capabilities in
their own words. Post *titles* are naive phrasings ("How do I add auth to my
SaaS?").

Unauthenticated Reddit `.json` is now blocked from non-browser IPs, so use the
**OAuth API** (free):

1. Register a **script** app at <https://www.reddit.com/prefs/apps>.
2. Export creds locally (never commit): `REDDIT_CLIENT_ID`,
   `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`.
3. `node fetch-reddit.mjs > candidates-reddit.tsv` — OAuths, searches the seed
   subreddits/queries, extracts titles, suggests a concept. Same firewall:
   candidates only, you promote to `real` by hand.

**Provenance ladder** (record the flag in `corpus.tsv`, tightest last):
`gen` (generated) → `forum`/`search` (real but forum/search register, e.g.
Reddit) → `support` (a real client's own words). Reddit is `forum`: a real step
up from `gen`, still below live-client language. `candidates-reddit.tsv` is
gitignored.

### Stack Overflow (`fetch-stackexchange.mjs`) — recommended over Reddit

Stack Exchange content is **CC BY-SA** with an official **keyless** API — real,
reusable, no ToS gray area (Reddit closed off new API keys and blocks
unauthenticated access). Question titles are naive phrasings.

```
node fetch-stackexchange.mjs > candidates-se.tsv   # then REVIEW
```

Uses full-text `q` + relevance (the API silently ignores `intitle`), ~15
capability queries, keyless quota (~300/day). Same firewall; flag kept rows
`forum`.

**Yield outcome (2026-07-20):** the run returned 351 titles; SO's register skews
**developer-implementation-specific** ("add auth to `mongod.conf` / k8s / Solr",
not "add auth to my SaaS"). After review, **24 of 351 (~7%)** were founder-register
enough to keep — now the `forum` rows in `corpus.tsv`, scoring 23/24 above. Good
coverage on auth / workspaces / permissions / rate-limit / audit; **no clean real
phrasing survived for `billing.plan-gate` or `webhooks.in-out`** (all were
error-debugging titles), so those still await the `support` tier. Real and
licensed, but complements rather than replaces live-client language.
`candidates-se.tsv` gitignored.

## When the real corpus lands

Replace/extend `corpus.tsv` with real user phrasings (keeping the same three
columns), rerun on `claude-opus-4-8`, and *that* run — not this one — is the
gate. Until then this proves the harness and the cross-language mechanism only.
