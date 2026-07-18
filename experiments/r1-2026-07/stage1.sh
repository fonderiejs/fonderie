#!/bin/bash
# Stage 1 batch (BRAIN_PLAN.md Phase 2.5): 30 cold sessions.
# All 10 tasks × arms a & c (20), + a 2nd rep on 5 core tasks × 2 arms (10).
# Alternating arms, one model, sequential. Aborts (session limits) are logged
# and left for disclosure — never silently retried.
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
CORE="auth-1 billing-1 workspaces-1 permissions-1 compound-1"

# build the run list: base (all tasks, rep1) then core (rep2)
runlist() {
  while IFS= read -r line; do
    id=$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$line")
    echo "$id 1"
  done < "$EXPT/tasks.jsonl"
  for id in $CORE; do echo "$id 2"; done
}

i=0
# feed the run list on FD 3 so a stdin-reading child (claude -p) can't drain it
while read -r TASKID REP <&3; do
  # look up prompt + expect from tasks.jsonl
  line=$(grep "\"id\":\"$TASKID\"" "$EXPT/tasks.jsonl")
  PROMPT=$(node -e 'console.log(JSON.parse(process.argv[1]).prompt)' "$line")
  EXPECT=$(node -e 'console.log(JSON.parse(process.argv[1]).expect.join(","))' "$line")
  RUNID="$TASKID"; [ "$REP" = 2 ] && RUNID="$TASKID-r2"
  for ARM in a c; do
    ID="$ARM-$RUNID"
    # resume: skip a run that already produced a valid (non-session-limited) result
    if [ -f "$EXPT/results/$ID.json" ] && \
       node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?1:0)' "$EXPT/results/$ID.json" 2>/dev/null; then
      echo "$ID skip (already done)"; continue
    fi
    "$EXPT/run.sh" "$ARM" "$RUNID" "$PROMPT" "$EXPECT"
    i=$((i+1))
    # stop-on-limit: bail the whole batch cleanly so we keep partial progress
    if node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?0:1)' "$EXPT/results/$ID.json" 2>/dev/null; then
      echo "SESSION LIMIT at $ID — stopping. Re-run stage1.sh after reset to resume."
      exit 3
    fi
  done
done 3< <(runlist)
echo "stage1 complete: $i new runs this pass"
