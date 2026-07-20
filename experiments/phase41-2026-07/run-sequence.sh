#!/bin/bash
# Phase 4.1 sequence runner (pre-registered in BRAIN_PLAN.md § Phase 4.1).
# Runs 4 sequential cold sessions on ONE growing app — the amortization regime.
#
#   run-sequence.sh <cond fat|pb|scratch> <seq-id>
#
# Conditions:
#   fat     skeleton-b + fat skill dir (condition-B replica; brain artifacts
#           stripped from the copy so it's pure skill)
#   pb      skeleton-b + compiled PROJECT BRAIN as CLAUDE.md (regenerated
#           before every session from the workdir's installed packages) + MCP
#           brain server for discovery of not-yet-installed capabilities
#   scratch skeleton-a, no Fonderie knowledge (quality-floor control)
#
# Resumable at session granularity: completed sessions are skipped; a session
# limit stops the WHOLE run cleanly (exit 3) — re-run to resume. The workdir
# persists across sessions and re-runs (the app must grow).
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$EXPT/../.." && pwd)"
TC="$ROOT/experiments/token-cost-2026-07"
COND=$1; SEQ=$2
MAXS=${SEQ_MAX_SESSIONS:-4}
ISOROOT="${TMPDIR:-/tmp}/fonderie-p41"
WORK="$ISOROOT/$COND-$SEQ"
mkdir -p "$EXPT/results" "$ISOROOT"

is_limited() {
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?0:1)' "$1" 2>/dev/null
}
is_valid() {
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?1:0)' "$1" 2>/dev/null
}

# fresh workdir only on first touch — the sequence's app grows in place
if [ ! -d "$WORK" ]; then
  case "$COND" in
    scratch) cp -R "$TC/skeleton-a" "$WORK" ;;
    fat|pb)  cp -R "$TC/skeleton-b" "$WORK" ;;
    *) echo "unknown cond $COND"; exit 2 ;;
  esac
  rm -rf "$WORK/.claude" "$WORK/graphify-out" "$WORK/.mcp.json" "$WORK/CLAUDE.md"
  if [ "$COND" = fat ]; then
    mkdir -p "$WORK/.claude/skills"
    cp -R "$ROOT/.claude/skills/fonderie" "$WORK/.claude/skills/"
    # pure fat skill — strip brain artifacts from the copy
    rm -f "$WORK/.claude/skills/fonderie/brain.json" "$WORK/.claude/skills/fonderie/brain-knowledge.json"
  fi
fi

while read -r line <&3; do
  N=$(node -e 'console.log(JSON.parse(process.argv[1]).n)' "$line")
  [ "$N" -gt "$MAXS" ] && break
  PROMPT=$(node -e 'console.log(JSON.parse(process.argv[1]).prompt)' "$line")
  ID="$COND-$SEQ-s$N"
  if [ -f "$EXPT/results/$ID.json" ] && is_valid "$EXPT/results/$ID.json"; then
    echo "$ID skip (already done)"; continue
  fi

  MCPARGS=()
  if [ "$COND" = pb ]; then
    # freshness by construction: recompile the project brain from what THIS
    # workdir has installed right now (grows as sessions install packages)
    node "$ROOT/scripts/generate-project-brain.mjs" --project "$WORK" --out "$WORK/CLAUDE.md" 2>/dev/null
    # archive the exact resident brain used this session — attribution (analyze.mjs)
    # needs the per-session artifact; it is regenerated (grows) every session.
    cp "$WORK/CLAUDE.md" "$EXPT/results/$ID.claude.md" 2>/dev/null
    BRAINLOG="$EXPT/results/$ID.brain.log"; : > "$BRAINLOG"
    cat > "$WORK/.mcp.json" <<JSON
{ "mcpServers": { "fonderie-brain": {
  "command": "node",
  "args": ["$ROOT/scripts/brain-serve.mjs", "--project", "$WORK"],
  "env": { "FONDERIE_BRAIN_LOG": "$BRAINLOG" } } } }
JSON
    MCPARGS=(--mcp-config "$WORK/.mcp.json")
  fi

  cd "$WORK"
  START=$(date +%s)
  env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT claude -p "$PROMPT" \
    --model claude-opus-4-8 \
    --output-format json \
    --dangerously-skip-permissions \
    ${MCPARGS[@]+"${MCPARGS[@]}"} \
    </dev/null \
    > "$EXPT/results/$ID.json" 2> "$EXPT/results/$ID.err"
  CODE=$?
  END=$(date +%s)

  loc=$(find "$WORK/src" -name '*.ts' 2>/dev/null | xargs cat 2>/dev/null | grep -vc '^[[:space:]]*$')
  (cd "$WORK" && npx tsc --noEmit >/dev/null 2>&1 </dev/null) && TSC=yes || TSC=no

  # Resident Fonderie-knowledge size K (tokens ≈ chars/4) — the artifact charged
  # as cache_read every turn. pb: the compiled CLAUDE.md; fat: the loaded skill
  # dir minus brain artifacts; scratch: 0. This is analyze.mjs's static-K input.
  case "$COND" in
    pb)   KCH=$(wc -c < "$WORK/CLAUDE.md" 2>/dev/null || echo 0) ;;
    fat)  KCH=$(find "$WORK/.claude/skills/fonderie" -type f ! -name 'brain.json' ! -name 'brain-knowledge.json' -exec cat {} + 2>/dev/null | wc -c) ;;
    *)    KCH=0 ;;
  esac
  KTOK=$(( ${KCH:-0} / 4 ))
  echo "{\"run\":\"$ID\",\"cond\":\"$COND\",\"seq\":\"$SEQ\",\"session\":$N,\"exit\":$CODE,\"wall_s\":$((END-START)),\"loc\":$loc,\"tsc\":\"$TSC\",\"k_tokens\":$KTOK}" \
    > "$EXPT/results/$ID.meta.json"

  SID=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).session_id||"")}catch{}' "$EXPT/results/$ID.json")
  TR=""
  if [ -n "$SID" ]; then
    TR=$(find "$HOME/.claude/projects" -name "$SID.jsonl" 2>/dev/null | head -1)
    [ -n "$TR" ] && cp "$TR" "$EXPT/results/$ID.transcript.jsonl"
  fi

  if is_limited "$EXPT/results/$ID.json"; then
    echo "SESSION LIMIT at $ID — stopping. Re-run to resume."
    exit 3
  fi
  echo "$ID done (exit $CODE, $((END-START))s, loc:$loc tsc:$TSC, transcript:${TR:+yes})"
done 3< "$EXPT/sessions.jsonl"
echo "sequence $COND-$SEQ complete"
