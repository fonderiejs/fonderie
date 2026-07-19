#!/bin/bash
# Behavioral observability panel — human-initiated (Phase-beyond-3).
# Runs the tracked panel (arm-A baseline + arm-B stub across the task set),
# scores it, and appends one ledger row. Paid model runs: initiate on a
# cadence (SDK release / major-dependency change / quarterly), NOT per commit.
# See OBSERVABILITY.md.
#
#   observe.sh run [model]   # run the panel fresh (PAID), score, record
#   observe.sh record        # just re-record from existing results/ (no runs)
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
MODE=${1:-record}
MODEL=${2:-claude-opus-4-8}

if [ "$MODE" = "run" ]; then
  echo "Behavioral panel — PAID runs on $MODEL. Ctrl-C within 5s to abort."
  sleep 5
  # freshness is a precondition: a version-skewed brain confounds the signal
  node -e '
    const b=require("'"$EXPT"'/../../.claude/skills/fonderie/brain.json");
    const p="'"$EXPT"'/../token-cost-2026-07/skeleton-b/node_modules/@fonderie/core/package.json";
    const fs=require("fs");
    const v=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)).version:null;
    if(v!==b.sdkVersions.core){console.error(`ABORT: skeleton core ${v} != brain ${b.sdkVersions.core}. Match before running (freshness gates the signal).`);process.exit(1)}
  ' || exit 1
  OBSERVE_MODEL="$MODEL" "$EXPT/stage1.sh" || true   # arm a (+c) baseline, resumable
  OBSERVE_MODEL="$MODEL" "$EXPT/stage2.sh" || true   # arm b intervention, resumable
  # score everything
  for j in "$EXPT"/results/[ab]-*.json; do
    case "$j" in *meta*|*metrics*) continue;; esac
    id=$(basename "$j" .json)
    node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?1:0)' "$j" 2>/dev/null || continue
    task=$(echo "$id" | sed -E 's/^[ab]-//; s/-r2$//')
    expect=$(grep "\"id\":\"$task\"" "$EXPT/tasks.jsonl" | node -e 'try{console.log(JSON.parse(require("fs").readFileSync(0)).expect.join(","))}catch{console.log("")}')
    node "$EXPT/score.mjs" "$EXPT/results/$id.transcript.jsonl" "$EXPT/results/$id.brain.log" "$EXPT/results/$id.hook.log" "$expect" > "$EXPT/results/$id.metrics.json" 2>/dev/null
  done
fi

OBSERVE_MODEL="$MODEL" node "$EXPT/observe.mjs" record
echo ""
echo "=== drift view ==="
node "$EXPT/drift.mjs"
