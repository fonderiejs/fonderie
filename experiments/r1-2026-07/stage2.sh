#!/bin/bash
# Phase 2.6 — Retrieval Intervention (arm B: tool + brain-first stub).
# Pairs against the Phase 2.5 arm-A baseline. Resumable: skips valid runs,
# stops cleanly on a session limit (re-run after reset to continue).
# Priority order: the 4 tasks with an arm-A baseline first (clean Δ pairing),
# then the remaining tasks.
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
# paired tasks first (have arm-A baseline), then the rest
PAIRED="auth-1 auth-2 billing-1 billing-2"
REST="workspaces-1 permissions-1 courier-1 webhooks-1 ratelimit-1 compound-1"

i=0
for TASKID in $PAIRED $REST; do
  line=$(grep "\"id\":\"$TASKID\"" "$EXPT/tasks.jsonl")
  PROMPT=$(node -e 'console.log(JSON.parse(process.argv[1]).prompt)' "$line")
  EXPECT=$(node -e 'console.log(JSON.parse(process.argv[1]).expect.join(","))' "$line")
  ID="b-$TASKID"
  if [ -f "$EXPT/results/$ID.json" ] && \
     node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?1:0)' "$EXPT/results/$ID.json" 2>/dev/null; then
    echo "$ID skip (already done)"; continue
  fi
  "$EXPT/run.sh" b "$TASKID" "$PROMPT" "$EXPECT"
  i=$((i+1))
  if node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?0:1)' "$EXPT/results/$ID.json" 2>/dev/null; then
    echo "SESSION LIMIT at $ID — stopping. Re-run stage2.sh after reset to resume."
    exit 3
  fi
done
echo "stage2 complete: $i new arm-B runs this pass"
