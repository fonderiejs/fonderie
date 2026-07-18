#!/bin/bash
# Phase 0 baseline refresh (BRAIN_PLAN.md): naive prompt, standardized model.
# usage: run-baseline.sh <cond a|b> <run-id>
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
COND=$1; ID=$2
# Workdir must live OUTSIDE the fonderie-js repo: runs inside it inherit the
# repo-root Fonderie skill and resolve @fonderie/* from the workspace
# node_modules, contaminating condition A (observed 2026-07-17, runs bl-*).
ISOROOT="${TMPDIR:-/tmp}/fonderie-baseline-runs"
mkdir -p "$ISOROOT"
DIR=$ISOROOT/$ID
rm -rf "$DIR"
cp -R "$EXPT/skeleton-$COND" "$DIR"
cd "$DIR"
START=$(date +%s)
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p "$(cat "$EXPT/prompt-naive.txt")" \
  --model claude-opus-4-8 \
  --output-format json \
  --dangerously-skip-permissions \
  > "$EXPT/results/$ID.json" 2> "$EXPT/results/$ID.err"
CODE=$?
END=$(date +%s)
echo "{\"run\":\"$ID\",\"exit\":$CODE,\"wall_seconds\":$((END-START))}" > "$EXPT/results/$ID.meta.json"
