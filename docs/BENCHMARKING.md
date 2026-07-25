# Benchmarking token usage & roundtrip

Fonderie's promise is that an agent building a SaaS backend with the skill
spends **fewer tokens** — and ships something more correct — than one
building from scratch. A promise you don't measure is a promise you'll
quietly break. This is how we measure it, so every change can be checked
against the claim.

## What we measure, and why those three

| Metric | Where it comes from | Why it matters |
| --- | --- | --- |
| **Tokens** | Claude Code JSON output → `.usage` | The headline promise. Input+output tokens for the whole build session. |
| **Cost** | `.total_cost_usd` in the same JSON | The founder-facing translation of tokens. |
| **Roundtrip (wall clock)** | `run.sh` records start/end seconds | Latency of the actual build — tokens can drop while wall time rises (or vice-versa); watch both. |
| **Correctness** | 12-point checklist, scored on the produced `src/` | Fewer tokens is worthless if the output is wrong or insecure. The token win only counts against a correct build. |

Cheaper-but-broken is not a win. Correctness is scored *first*; token counts
are only compared between runs that actually produced a working backend.

## The harness

Lives in `experiments/token-cost-2026-07/`. The design is deliberately
boring so results are reproducible:

| File | What it is |
| --- | --- |
| `run.sh` | Copies a pristine skeleton, runs **one headless** Claude Code session, records the JSON result + wall time |
| `skeleton-a/` | **Condition A** — plain TypeScript/Express app, no auth deps (the "from scratch" baseline) |
| `skeleton-b/` | **Condition B** — same app + `@fonderie/core` + the Fonderie skill (see its `SETUP.md`) |
| `prompt.txt` | The expert task prompt |
| `prompt-naive.txt` | The naive prompt (six words, no requirements) — tests what the model does *unguided* |
| `CHECKLIST.md` | The committed 12-point rubric, each item mapped to an OWASP ASVS control where one applies |
| `results.csv` | Per-run measurements, **including disclosed aborted runs** |
| `SCORES.md` | Per-run checklist breakdown so anyone can re-check the scoring |

The core of `run.sh`:

```sh
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p "$(cat prompt.txt)" \
  --model claude-fable-5 \
  --output-format json \
  --dangerously-skip-permissions \
  > results/$ID.json 2> results/$ID.err
# tokens live in results/$ID.json .usage ; cost in .total_cost_usd
# wall clock written to results/$ID.meta.json
```

Unsetting `CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT` makes the nested session run
clean, not as a child of your current one.

## Running it

```sh
cd experiments/token-cost-2026-07
cd skeleton-a && npm install && cd ..
cd skeleton-b && npm install && cd ..     # then follow skeleton-b/SETUP.md
./run.sh a scratch-1     # one condition-A (scratch) run
./run.sh b fonderie-1    # one condition-B (skill) run
```

Each run writes `results/<id>.json` (full Claude Code output) and
`results/<id>.meta.json` (wall clock). Then score the produced app against
`CHECKLIST.md` and record the row in `results.csv` + the breakdown in
`SCORES.md`.

## Reading results honestly

The rules that keep the number trustworthy — follow them or the benchmark
lies to you:

- **Runs cost real money/usage.** Check the JSON tail for usage-limit
  truncation *before* trusting a run. A truncated run is not a data point.
- **Disclose aborted runs.** `results.csv` includes them on purpose. Hiding
  a bad run to make an average look better is how a benchmark becomes
  marketing.
- **Score correctness before comparing tokens.** Use the committed 12-point
  checklist; put the per-item pass/fail in `SCORES.md`. Credit Fonderie for
  *delegation* only when the module is actually wired (registered + mounted),
  not merely installed.
- **One task ≠ the whole story.** The July harness found the brain did **not**
  beat fat-skill context loading for a *small scoped* build (see
  `FINDINGS-condition-c.md`). That's a real, recorded negative. Keep it
  visible; a benchmark that only ever confirms the pitch isn't measuring
  anything.
- **State the corpus with the number.** "71.5× fewer tokens" means nothing
  without the task and conditions it was measured under. Never quote a bare
  multiplier.

## When to re-run

Re-benchmark — don't assume — whenever you change something that could move
the token or correctness numbers:

- The skill/brain content or retrieval (a fresh brain that doesn't move the
  benchmark isn't earning its place — see [BRAIN.md](BRAIN.md)).
- `@fonderie/auth`'s public surface or defaults (it's the task under test).
- The CLI's `add`/`skill`/`query` behaviour (how the agent learns the SDK).
- Any change that claims a token improvement — prove it with a before/after
  on the same skeleton and prompt.

## The discipline in one line

Ship the change, then run the harness on the same skeleton + prompt, score
correctness first, compare tokens second, and record every run — including
the ones that didn't help.
