#!/bin/bash
# Phase 4 condition C (BRAIN_PLAN.md): skeleton-b + brain (MCP + stub),
# FAT SKILL REMOVED. Same naive prompt + model as round 0-baseline, so it's a
# direct head-to-head vs condition B (fonderie-with-skill) and scratch.
# The one isolated variable: brain instead of the fat skill.
# usage: run-condition-c.sh <run-id>
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$EXPT/../.." && pwd)"
ID=$1
# isolate OUTSIDE the repo (same discipline as run-baseline.sh)
ISOROOT="${TMPDIR:-/tmp}/fonderie-condc-runs"
mkdir -p "$ISOROOT"
DIR=$ISOROOT/$ID
rm -rf "$DIR"
cp -R "$EXPT/skeleton-b" "$DIR"
# CONDITION C: no fat skill. Remove any skill/config the skeleton carries.
rm -rf "$DIR/.claude" "$DIR/graphify-out" "$DIR/node_modules/.cache"

BRAINLOG="$EXPT/results/$ID.brain.log"; : > "$BRAINLOG"

# brain MCP (replaces the fat skill). --project drives R3 version-check.
cat > "$DIR/.mcp.json" <<JSON
{ "mcpServers": { "fonderie-brain": {
  "command": "node",
  "args": ["$ROOT/scripts/brain-serve.mjs", "--project", "$DIR"],
  "env": { "FONDERIE_BRAIN_LOG": "$BRAINLOG" } } } }
JSON

# brain-first stub (the Phase 2.6 intervention — the ~4-line prior)
cat > "$DIR/CLAUDE.md" <<'MD'
This project uses the Fonderie SDK (@fonderie/*). Before writing or editing any
code that touches auth, billing, orgs/teams, permissions, email, webhooks, rate
limiting, or config, you MUST call the brain_query MCP tool with your task first.
Do not read @fonderie source or docs; do not answer from memory.
MD

cd "$DIR"
START=$(date +%s)
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p "$(cat "$EXPT/prompt-naive.txt")" \
  --model claude-opus-4-8 \
  --output-format json \
  --mcp-config "$DIR/.mcp.json" \
  --dangerously-skip-permissions \
  </dev/null \
  > "$EXPT/results/$ID.json" 2> "$EXPT/results/$ID.err"
CODE=$?
END=$(date +%s)
echo "{\"run\":\"$ID\",\"cond\":\"c\",\"exit\":$CODE,\"wall_seconds\":$((END-START))}" > "$EXPT/results/$ID.meta.json"
# capture the on-disk transcript (for the brain-before-edit check)
SID=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).session_id||"")}catch{}' "$EXPT/results/$ID.json")
if [ -n "$SID" ]; then
  TR=$(find "$HOME/.claude/projects" -name "$SID.jsonl" 2>/dev/null | head -1)
  [ -n "$TR" ] && cp "$TR" "$EXPT/results/$ID.transcript.jsonl"
fi
echo "$ID done (exit $CODE, $((END-START))s, transcript: ${TR:+yes})"
