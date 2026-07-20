#!/bin/bash
# Phase 4.1 batch driver: 3 conditions × 3 sequences × 4 sessions = 36 cold
# sessions, interleaved by condition (spreads temporal drift). Resumable: each
# sequence skips its completed sessions; a session limit aborts cleanly (exit 3)
# — re-run after re-login to continue exactly where it stopped.
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
for R in 1 2 3; do
  for C in fat pb scratch; do
    "$EXPT/run-sequence.sh" "$C" "$R"
    code=$?
    if [ "$code" = 3 ]; then
      echo "stage41: stopped on session limit (resume by re-running stage41.sh)"
      exit 3
    fi
  done
done
echo "stage41 complete: all 9 sequences done"
