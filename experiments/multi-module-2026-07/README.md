# Multi-module + lifecycle experiment (July 2026)

Harness and raw data for phase two of the token-cost experiment. Protocol,
conditions, stage prompts, scorecard, and the pre-registered certainty gate
are in `DESIGN.md`. Predecessor (single-module auth, rounds 1–3):
`../token-cost-2026-07/`.

## Layout

| Path | What it is |
| --- | --- |
| `DESIGN.md` | Signed-off design incl. certainty gate |
| `prompts/stage{1..4}.txt` | Stage prompts (stage 1 = rounds-1/2 prompt verbatim) |
| `run-stage.sh` | One headless session per stage on the sequence's tree |
| `pg/cluster.sh` | Disposable per-sequence Postgres 17.10 (embedded binaries) |
| `skeleton-a/`, `skeleton-b/` | Conditions (b = a + `@fonderie/core` + post-split skill) |
| `smoke/` | Fixed regression flows; per-sequence endpoint map in `runs/<seq>/smoke.env` |
| `checklist.md` | The 20-point scorecard |
| `results.csv` | Per-stage measurements, aborted stages disclosed |

## Run a sequence

```sh
./run-stage.sh a a1 1   # creates runs/a1 from skeleton-a, runs stage 1
./run-stage.sh a a1 2   # continues on the same tree
./run-stage.sh a a1 3
./run-stage.sh a a1 4
```

Each stage writes `results/<seq>-s<n>.json` (Claude Code's JSON output) and
`.meta.json` (wall clock), snapshots the tree as a git commit inside
`runs/<seq>`, and persists the sequence's database in `runs/<seq>-pgdata`.
Check the JSON tail for usage-limit truncation before trusting a stage; a
truncated stage is discarded, disclosed in `results.csv`, and rerun from the
pre-stage snapshot (`git reset --hard HEAD` in the run dir).

Environment for the published numbers: Claude Code v2.1.197,
`claude-fable-5`, macOS 12 (x86_64), Node 24, PostgreSQL 17.10.
Sequences alternate conditions (a1, b1, a2, b2, a3, b3), one session at a time.
