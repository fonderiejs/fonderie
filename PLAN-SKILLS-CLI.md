# Plan: the three-layer pattern (CLI + lazy skills + LLM) for Fonderie

_2026-07-22. A robust plan to lower token usage by adopting the CLI+skills
pattern the industry converged on (Cloudflare Wrangler, Vercel, Anthropic
skills, Playwright's MCP-vs-CLI split, skills.sh). Written to reconcile with our
own N=3 measurement, so we pull the lever that actually moves our number._

## What we already proved, and the layer we mismeasured

- **CLI vs MCP transport is a wash for us.** N=3 verdict
  (`experiments/phase41-2026-07/DISCOVERY-CLI-VS-MCP.md`): pb-cli/fat = 0.29 ≈
  pb/fat = 0.28. The MCP schema tax we removed was only 752 tok — a rounding
  error. Do not re-litigate transport.
- **The real cost is the RESIDENT project brain: 6–13K tok/turn**, compiled
  eagerly and re-read every turn. That is our 0.28, and it is what the article's
  lazy-loading pattern attacks. We optimized transport; we should optimize
  *when knowledge loads*.

The article's headline savings (GitHub MCP 55K at idle; Anthropic 150K→2K, 98.7%)
come from **lazy loading + code execution**, not from the shell per se. Two
mechanisms, and we under-use both:
1. **Lazy skill layering** — a tiny router (~30 tok/entry) that pulls a
   per-capability body in only when the task touches it. Load scales with what
   the agent does, not what it might do.
2. **CLI responses go into a pipe, not context** — the agent greps/filters/peeks,
   reads only what matters, instead of a tool return flooding the window.

## Map: the 3-layer pyramid onto assets we already have

| Layer | Article | What we already have | The gap to close |
| --- | --- | --- | --- |
| **CLI** (deterministic) | a binary the shell invokes, 0 schema | `brain-query.mjs` (concept→package+recipe+signatures), proven to trigger 12/12 | package it as `fonderie` bin; add pipe-friendly output (`--json`) so the agent filters before reading |
| **Skills** (lazy guidance) | base `SKILL.md` router (56 lines) → pull `atl-jira/SKILL.md` (368) on demand | **we ship the OPPOSITE**: the fat skill loads all 17 packages' signatures eagerly; the project brain compiles everything installed | **the lever** — restructure into a router + per-package bodies that load lazily |
| **LLM** (reasoning) | reasoning only | — | keep knowledge OUT of resident context; let the model pull it |

## The lever: turn the eager project brain into a lazy skill router

Today `generate-project-brain.mjs` emits one `CLAUDE.md` with the full
signatures of every installed package — resident every turn. Replace with the
article's layering:

- **`SKILL.md` router (~a few hundred tokens, always resident):** the 17 concept
  IDs + one-line descriptions (we already have this — the R2 concept enum is
  literally a routing table) + "for concept X, read `skills/fonderie/<pkg>.md`
  or run `fonderie brain query <concept>`."
- **Per-package bodies (loaded lazily, only when touched):** our existing
  per-package signature + outcomes fragments become `skills/fonderie/auth.md`,
  `billing.md`, … The agent reads `billing.md` only in the billing session — not
  auth's or teams'. This is `pb-scoped` (banked) taken to its logical end:
  scoping at *read time* by the agent, not compile time by us.
- **Security invariants stay in the router** (they are small and always apply).

Net: a session that touches 1–2 packages carries a router + 1–2 bodies, not all
17. Expected resident footprint drops from 6–13K toward ~1–3K for typical
sessions — the win the transport experiment could not deliver.

## Cross-vendor portability (a second, free win)

Adopt the open skill shape (name / description / body) so the same files work in
Claude Code, Codex CLI, Copilot CLI, Cursor, Gemini — the article's "the agent
does not care where it runs." List on skills.sh. One artifact, every harness, no
MCP server to keep alive. This is also our R1/Phase-3 install-matrix goal.

## The two-axis honesty (do not repeat the wrong-layer mistake)

The article is explicit and so are our own numbers: **tokens saved can cost wall
clock.** CLI steps (round trip per call); MCP streams. Our N=3 saw pb-cli make
more calls (45 vs 29). Playwright's own rule: **CLI for coding agents; MCP for
exploratory / self-healing / long-running loops.** So:
- Measure BOTH axes — resident tokens AND wall-clock — every arm.
- Keep MCP `brain-serve` as the supported option for the stateful/long-running
  case; ship lazy-skills+CLI as the default for the build-a-SaaS case (coding
  agent, deterministic).

## Pre-registered experiment (locked before data)

Condition **`pb-lazy`**: router `SKILL.md` + lazy per-package bodies + CLI
discovery; NO eager project brain, NO MCP. Same 4-session growing-app workload,
`claude-opus-4-8`, same completion gate and 39-point rubric.

- **Metrics:** resident tokens/turn (`instrument.mjs`), wall-clock/session,
  completion, quality.
- **Decision (locked):**
  - `pb-lazy` resident **< 0.28 × fat** at equal completion + quality, and
    wall-clock within ~1.5× of pb → **ship lazy-skills+CLI as default.**
  - resident saving but quality/completion drops (the agent doesn't pull the
    body it needs) → the eager brain was buying sufficiency; keep pb, refine the
    router.
  - resident saving but wall-clock blows up (too many lazy reads) → document as
    the low-token option, keep pb default for latency-sensitive users.
- **Cheap pilot first** (`pb-lazy` vs `pb`, sessions 1→3, ~$6); full N=3 only if
  the pilot clears the gate. Same discipline as Phase 4.1: n=1 is directional,
  never a verdict.

## Sequence

1. Extend `instrument.mjs` to also report **wall-clock/session** (the second
   axis) — it currently reports tokens only. [$0]
2. Build the router + lazy-body generator (`generate-skill.mjs`): emit
   `SKILL.md` (router) + `skills/fonderie/<pkg>.md` from the existing fragments.
   Wire a `pb-lazy` harness condition. [$0]
3. Run the pilot; decide per the locked rule.
4. If it wins: package the `fonderie` CLI bin + ship the skill in the open
   cross-vendor format (Phase 3 install matrix), MCP kept as the stateful option.

## What does NOT change

The micro-backend architecture — the deterministic, audited bricks that make an
LLM's non-deterministic output consistent — is the product and is untouched.
This plan only changes *how the brain's knowledge reaches the agent*: lazily,
through skills + a CLI, instead of eagerly resident. Same knowledge, loaded when
needed.

## Pilot result — 2026-07-22 (pb-lazy 1→3): promising, but the metric needs work

**Measured & real:** resident router **~1,410 tok — 5× under pb's eager 6–13K**.
Completion 3/3, no stall, tsc clean (the router routed correctly — the model
`cat`'d the right bodies, installed workspaces+courier, built teams). Wall-clock
**211s/sess ≈ pb's 219s** — the CLI/lazy latency fear did NOT materialize.

**Bug found + fixed while auditing:** the model fetched bodies via
`cat skills/fonderie/<pkg>.md` (a shell read), which `instrument.mjs` did not
count — fetched (and the ratio) was understated. Matcher now counts cat/head/tail
of skill files; s3 fetched went 0 → 5,167.

**The honest catch — do NOT ship 0.054.** Our per-turn metric amortizes fetched
as `total/turns`, treating a body read as a one-turn cost. But a `cat`'d body
stays in context (cache-read) every subsequent turn. So the true cost is between
amortized (best case, pb-lazy/fat = 0.054) and resident-after-read (worst case,
body read at turn 1 → s2 ≈ 7,429 tok/turn ≈ pb's 0.28), set by *when* the body is
read — n=1 cannot settle it.

**What is genuinely true:** pb-lazy loads only the **1–2 packages the task
touches** (router + those bodies) vs pb's **all installed, eager**. A real
reduction, narrower than 5×. The metric that settles it is the **actual
cache_read attributable to Fonderie content per turn**, not the
resident+fetched/turns proxy — fine for eager conditions, but the lazy pattern
stresses its amortization assumption.

**Next (before any N=3 spend):** add a resident-after-read model to
`instrument.mjs` (a body counts toward every turn from its read onward), so
pb-lazy is scored on the same basis as pb's eager resident — THEN verdict. Same
discipline as the Method-A/B divergence: fix the measurement before trusting the
number.

## Corrected verdict — resident-after-read metric (2026-07-22)

Built the fair metric (`instrument.mjs`): a fetched body/result stays
cache-resident every turn from its read onward (like the eager brain), and a
fetch is only counted if it's NOT already in the resident K (fixed a fat
double-count — its skill dir is already K). Fair picture:

| condition | resident-after-read (fair) | amortized (floor) |
| --- | --- | --- |
| fat (eager skill)   | 1.000 (27,999 tok/turn) | 1.000 |
| pb (eager + MCP)    | **0.395** (parity-plus) | 0.277 |
| pb-cli (eager + CLI)| 0.317 (fraction)        | 0.292 |
| **pb-lazy (router)**| **0.117 (FRACTION)**    | 0.053 |

**pb-lazy wins decisively — on BOTH metrics.** 0.117 fair, 0.053 floor: ~3.4×
under pb, and the advantage SURVIVES the strict metric (it wasn't an
amortization artifact). Why it holds: pb-lazy loads only the 1–2 bodies the task
touches; pb keeps ALL installed packages resident plus its fetches. At equal
completion (3/3, no stall), equal quality (tsc clean), and equal wall-clock
(211s ≈ pb 219s), pb-lazy **clears the pre-registered gate** (< 0.28 × fat).

**Honest side-finding (flagged for follow-up):** the resident-after-read metric
also moves *pb* from 0.28 (amortized, as published) to **0.40 (parity-plus)** —
because its brain_query fetches stay resident too, which the amortized proxy
divided away. The fraction claim for pb is metric-dependent; pb-lazy is a
fraction on both. BATCH-RESULTS should carry this caveat.

**Decision:** pilot CLEARS the gate → the full N=3 pb-lazy run is the verdict.
n=1 is directional; the signal is strong and consistent across both metrics.

## VERDICT — N=3 (2026-07-22): lazy-skills WINS. Ship as default.

Full pb-lazy × 3 sequences × 4 sessions. **12/12 completed, zero stalls, zero
gate failures**; all 3 teams sessions installed workspaces+courier and built
invites. The pilot held at scale:

| condition | knowledge overhead vs fat (fair) | amortized floor | wall-clock |
| --- | --- | --- | --- |
| fat (eager skill)    | 1.000 | 1.000 | 207s |
| pb (eager + MCP)     | 0.395 (parity-plus) | 0.277 | 219s |
| pb-cli               | 0.317 | 0.292 | — |
| **pb-lazy (router)** | **0.136 (FRACTION)** | 0.053 | 283s |

**pb-lazy/fat = 0.136** — held from the pilot's 0.117, ~2.9× under pb, the
cheapest condition measured, on the fair resident-after-read metric.

**Pre-registered gate — all four met:** resident 0.136 < 0.28×fat ✓; completion
12/12 = pb ✓; quality tsc-clean ✓; wall-clock 283s = 1.29× pb, < 1.5× ✓.
**→ Ship lazy-skills (router + on-demand bodies) as the default.**

**Two-axis honesty:** the token win costs latency — pb-lazy is the slowest
(283s vs 207–219s), because lazy reads are round trips. Within bounds, real. For
coding agents building a SaaS this is the right trade; MCP stays the option for
latency-sensitive / long-running loops (Playwright's rule).

## Next (packaging)

1. Wire `generate-skill.mjs` into `fonderie init` / postinstall as the default
   (replacing the eager project brain); keep `brain-serve` MCP as the stateful
   option.
2. Package the `fonderie brain query` CLI as a bin; ship the skill in the
   cross-vendor format (Phase 3 install matrix).
3. Reconcile BATCH-RESULTS: publish the fair resident-after-read numbers
   alongside the amortized (pb is parity-plus, not fraction, under the fair
   metric; pb-lazy is a fraction on both).
