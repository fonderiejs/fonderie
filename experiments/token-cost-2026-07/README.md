# Token-cost experiment (July 2026)

Raw data and harness for the blog post
[“We measured our own product against Claude Code building auth from scratch”](https://fonderiejs.com/blog/token-cost-experiment).

## Contents

| File | What it is |
| --- | --- |
| `prompt.txt` | The expert task prompt (rounds 1–2) |
| `prompt-naive.txt` | The naive prompt (round 3): six words, no requirements |
| `run.sh` | The runner: copies a pristine skeleton, executes one headless Claude Code session, records the JSON result |
| `skeleton-a/` | Condition A — plain TypeScript/Express app, no auth deps |
| `skeleton-b/` | Condition B — same app + `@fonderie/core` + the Fonderie skill (see its `SETUP.md`) |
| `results.csv` | Per-run measurements, including disclosed aborted runs |

## Reproduce

```sh
cd skeleton-a && npm install && cd ..
cd skeleton-b && npm install && cd ..   # then follow skeleton-b/SETUP.md
./run.sh a my-a1    # one condition-A run
./run.sh b my-b1    # one condition-B run
```

Each run writes `results/<id>.json` (Claude Code's full JSON output — token
usage in `.usage`, cost in `.total_cost_usd`) and `results/<id>.meta.json`
(wall clock). Score the produced app against the 12-point checklist in the
post's methodology section. Runs cost real money/usage; check the JSON tail
for usage-limit truncation before trusting a run.

Environment used for the published numbers: Claude Code v2.1.197,
`claude-fable-5`, macOS, Node 24. One run at a time, alternating conditions.
