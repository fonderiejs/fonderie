#!/bin/bash
# usage: run-stage.sh <cond a|b> <seq-id> <stage 1..4>
# Stage 1 creates runs/<seq-id> from skeleton-<cond>; later stages reuse the
# tree the previous stage left. One fresh headless session per stage.
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
COND=$1; SEQ=$2; STAGE=$3
RUN=$EXPT/runs/$SEQ
PGDATA=$EXPT/runs/$SEQ-pgdata
PORT=55432
ID=$SEQ-s$STAGE

if [ "$STAGE" = "1" ]; then
  rm -rf "$RUN" "$PGDATA"
  cp -R "$EXPT/skeleton-$COND" "$RUN"
  git -C "$RUN" init -q
  git -C "$RUN" add -A
  git -C "$RUN" -c user.email=expt@local -c user.name=expt commit -qm baseline
fi

"$EXPT/pg/cluster.sh" start "$PGDATA" $PORT > /dev/null

cd "$RUN"
START=$(date +%s)
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p "$(cat "$EXPT/prompts/stage$STAGE.txt")" \
  --model claude-fable-5 \
  --output-format json \
  --dangerously-skip-permissions \
  > "$EXPT/results/$ID.json" 2> "$EXPT/results/$ID.err"
CODE=$?
END=$(date +%s)

"$EXPT/pg/cluster.sh" stop "$PGDATA"

git -C "$RUN" add -A
git -C "$RUN" -c user.email=expt@local -c user.name=expt commit -qm "stage $STAGE" --allow-empty
echo "{\"run\":\"$ID\",\"cond\":\"$COND\",\"stage\":$STAGE,\"exit\":$CODE,\"wall_seconds\":$((END-START))}" > "$EXPT/results/$ID.meta.json"
echo "$ID done: exit=$CODE wall=$((END-START))s"
