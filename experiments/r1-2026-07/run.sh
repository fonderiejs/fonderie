#!/bin/bash
# R1 measurement runner (BRAIN_PLAN.md Phase 2.5). One instrumented, cold
# headless Claude Code session with the brain MCP server registered.
#
#   run.sh <arm a|b|c> <task-id> "<prompt>" <expect-csv> [model]
#
# Arms:
#   a  tool-only   — brain MCP registered, no stub, no hook (VOLUNTARY use = core R1)
#   b  tool+stub   — + CLAUDE.md brain-first instruction (measures the stub's lift)
#   c  hook        — + PreToolUse hook redirecting @fonderie reads (deterministic)
#
# Writes results/<arm>-<task>[-<model>].json (session), .brain.log, .hook.log.
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$EXPT/../.." && pwd)"
ARM=$1; TASK=$2; PROMPT=$3; EXPECT=$4; MODEL=${5:-claude-opus-4-8}
ID="${ARM}-${TASK}"
# isolate OUTSIDE the repo so condition can't inherit the repo skill / workspace deps
WORK="${TMPDIR:-/tmp}/fonderie-r1/$ID"
rm -rf "$WORK"; mkdir -p "$WORK/src"
# minimal Fonderie app skeleton (core installed, NO fat skill — we test the brain)
cp -R "$ROOT/experiments/token-cost-2026-07/skeleton-b/." "$WORK/" 2>/dev/null || true
rm -rf "$WORK/.claude" "$WORK/graphify-out" "$WORK/node_modules/.cache"

BRAINLOG="$EXPT/results/$ID.brain.log"; : > "$BRAINLOG"
HOOKLOG="$EXPT/results/$ID.hook.log";  : > "$HOOKLOG"

# MCP registration (all arms). --project drives R3 version-check against this app.
cat > "$WORK/.mcp.json" <<JSON
{ "mcpServers": { "fonderie-brain": {
  "command": "node",
  "args": ["$ROOT/scripts/brain-serve.mjs", "--project", "$WORK"],
  "env": { "FONDERIE_BRAIN_LOG": "$BRAINLOG" } } } }
JSON

# arm b: brain-first stub
if [ "$ARM" = "b" ]; then
  cat > "$WORK/CLAUDE.md" <<'MD'
This project uses the Fonderie SDK (@fonderie/*). Before writing or editing any
code that touches auth, billing, orgs/teams, permissions, email, webhooks, rate
limiting, or config, you MUST call the brain_query MCP tool with your task first.
Do not read @fonderie source or docs; do not answer from memory.
MD
fi

# arm c: deterministic hook
if [ "$ARM" = "c" ]; then
  mkdir -p "$WORK/.claude"
  cat > "$WORK/.claude/settings.json" <<JSON
{ "hooks": { "PreToolUse": [ { "matcher": "Read|Grep|Glob", "hooks": [
  { "type": "command", "command": "FONDERIE_HOOK_LOG=$HOOKLOG node $ROOT/scripts/brain-hook.mjs" } ] } ] } }
JSON
fi

cd "$WORK"
START=$(date +%s)
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p "$PROMPT" \
  --model "$MODEL" \
  --output-format json \
  --mcp-config "$WORK/.mcp.json" \
  --dangerously-skip-permissions \
  > "$EXPT/results/$ID.json" 2> "$EXPT/results/$ID.err"
CODE=$?
END=$(date +%s)
echo "{\"run\":\"$ID\",\"arm\":\"$ARM\",\"task\":\"$TASK\",\"model\":\"$MODEL\",\"expect\":\"$EXPECT\",\"exit\":$CODE,\"wall_s\":$((END-START))}" \
  > "$EXPT/results/$ID.meta.json"

# capture the full on-disk transcript (the summary JSON has no tool history).
# claude stores it at ~/.claude/projects/<escaped-cwd>/<session_id>.jsonl
SID=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).session_id||"")}catch{}' "$EXPT/results/$ID.json")
if [ -n "$SID" ]; then
  TR=$(find "$HOME/.claude/projects" -name "$SID.jsonl" 2>/dev/null | head -1)
  [ -n "$TR" ] && cp "$TR" "$EXPT/results/$ID.transcript.jsonl"
fi
echo "$ID done (exit $CODE, $((END-START))s, transcript: ${TR:+yes})"
