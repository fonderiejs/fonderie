#!/bin/bash
# usage: run.sh <cond a|b> <run-id>
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
COND=$1; ID=$2
DIR=$EXPT/runs/$ID
rm -rf "$DIR"
cp -R "$EXPT/skeleton-$COND" "$DIR"
cd "$DIR"
START=$(date +%s)
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p "$(cat "$EXPT/prompt.txt")" \
  --model claude-fable-5 \
  --output-format json \
  --dangerously-skip-permissions \
  > "$EXPT/results/$ID.json" 2> "$EXPT/results/$ID.err"
CODE=$?
END=$(date +%s)
echo "{\"run\":\"$ID\",\"exit\":$CODE,\"wall_seconds\":$((END-START))}" > "$EXPT/results/$ID.meta.json"
