#!/bin/bash
EXPT="$(cd "$(dirname "$0")" && pwd)"
cd "$EXPT"
for j in results/[ac]-*.json; do
  case "$j" in *meta*|*metrics*) continue;; esac
  id=$(basename "$j" .json)
  # skip session-limited runs
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?1:0)' "$j" 2>/dev/null || { echo "skip(limited): $id"; continue; }
  task=$(echo "$id" | sed -E 's/^[ac]-//; s/-r2$//')
  expect=$(grep "\"id\":\"$task\"" tasks.jsonl | node -e 'try{console.log(JSON.parse(require("fs").readFileSync(0)).expect.join(","))}catch{console.log("")}')
  node score.mjs "results/$id.transcript.jsonl" "results/$id.brain.log" "results/$id.hook.log" "$expect" > "results/$id.metrics.json" 2>/dev/null && echo "scored: $id"
done
