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
# Some environments force Node color output (FORCE_COLOR), which makes
# console.log(number) emit ANSI codes — corrupting $N → $ID → the .mcp.json path.
# Disable it here; the numeric extraction below also writes a raw string to be safe.
export NO_COLOR=1 FORCE_COLOR=0 NODE_DISABLE_COLORS=1
EXPT="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$EXPT/../.." && pwd)"
TC="$ROOT/experiments/token-cost-2026-07"
COND=$1; SEQ=$2
MAXS=${SEQ_MAX_SESSIONS:-4}
# Testability hooks (production defaults unchanged): CLAUDE_BIN lets a test
# inject a fake model; SESSIONS_FILE lets it supply its own workload. Used by
# test-l2-recover.sh to prove the Layer-2 detect/recover loop deterministically.
CLAUDE_BIN=${CLAUDE_BIN:-claude}
ISOROOT="${TMPDIR:-/tmp}/fonderie-p41"
WORK="$ISOROOT/$COND-$SEQ"
mkdir -p "$EXPT/results" "$ISOROOT"

# --- database (harness infrastructure, provided EQUALLY to every condition) ---
# One isolated database per (cond, seq) — the app grows across a sequence's 4
# sessions in one DB, but sequences/conditions must not share state (a user
# created in fat-1 must not collide with pb-1). Reset when the workdir is first
# created; persists across the sequence and resumes. Override the server or the
# container name via BENCH_PG_BASE / BENCH_PG_CONTAINER.
PG_BASE="${BENCH_PG_BASE:-postgresql://postgres:postgres@localhost:5432}"
PG_CONTAINER="${BENCH_PG_CONTAINER:-postgres}"
DB="bench_${COND}_${SEQ}"; DB="${DB//-/_}"
DBURL="$PG_BASE/$DB"
pg_admin() {  # psql against the server's admin db — local psql if present, else the container
  if command -v psql >/dev/null 2>&1; then psql "$PG_BASE/postgres" -v ON_ERROR_STOP=1 "$@"
  else docker exec -i "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 "$@"; fi
}

is_limited() {
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?0:1)' "$1" 2>/dev/null
}
is_valid() {
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(d.is_error&&/limit/i.test(d.result||"")?1:0)' "$1" 2>/dev/null
}

# fresh workdir only on first touch — the sequence's app grows in place
if [ ! -d "$WORK" ]; then
  case "$COND" in
    scratch)      cp -R "$TC/skeleton-a" "$WORK" ;;
    fat|pb|pb-scoped|pb-lazy)  cp -R "$TC/skeleton-b" "$WORK" ;;
    *) echo "unknown cond $COND"; exit 2 ;;
  esac
  rm -rf "$WORK/.claude" "$WORK/graphify-out" "$WORK/.mcp.json" "$WORK/CLAUDE.md"
  if [ "$COND" = fat ]; then
    mkdir -p "$WORK/.claude/skills"
    cp -R "$ROOT/.claude/skills/fonderie" "$WORK/.claude/skills/"
    # pure fat skill — strip brain artifacts from the copy
    rm -f "$WORK/.claude/skills/fonderie/brain.json" "$WORK/.claude/skills/fonderie/brain-knowledge.json"
  fi
  # fresh sequence → fresh, isolated database + provided .env (equal infra so no
  # session burns turns provisioning its own DB, as fat-1 did)
  pg_admin -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB" >/dev/null 2>&1 \
    || echo "⚠ could not reset DB '$DB' (need local psql, or a running container named '$PG_CONTAINER'). Sessions may fight infra."
  printf 'DATABASE_URL=%s\n' "$DBURL" > "$WORK/.env"
fi

while read -r line <&3; do
  N=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).n))' "$line")
  [ "$N" -gt "$MAXS" ] && break
  PROMPT=$(node -e 'console.log(JSON.parse(process.argv[1]).prompt)' "$line")
  SCOPE=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).scope||"")' "$line")
  ID="$COND-$SEQ-s$N"
  if [ -f "$EXPT/results/$ID.json" ] && is_valid "$EXPT/results/$ID.json"; then
    echo "$ID skip (already done)"; continue
  fi

  MCPARGS=()
  if [ "$COND" = pb ] || [ "$COND" = pb-scoped ]; then
    # freshness by construction: recompile the project brain from what THIS
    # workdir has installed right now (grows as sessions install packages).
    # pb-scoped additionally passes --scope <this session's packages + core,store>
    # so out-of-scope installed packages become one-line pointers, not full
    # surfaces — the Method-B overhead lever (BRAIN_PLAN Phase 4.1).
    SCOPEARG=()
    if [ "$COND" = pb-scoped ] && [ -n "$SCOPE" ]; then SCOPEARG=(--scope "$SCOPE,core,store"); fi
    node "$ROOT/scripts/generate-project-brain.mjs" --project "$WORK" --out "$WORK/CLAUDE.md" --quiet ${SCOPEARG[@]+"${SCOPEARG[@]}"} 2>/dev/null
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
  elif [ "$COND" = pb-lazy ]; then
    # Three-layer lazy pattern (PLAN-SKILLS-CLI.md): emit a small router SKILL.md
    # + per-package bodies into .claude/skills/; NO eager CLAUDE.md, NO MCP. The
    # agent reads a body only when the task touches it, or runs the CLI to
    # discover. Resident K = the router only (bodies load on demand).
    rm -f "$WORK/CLAUDE.md"
    mkdir -p "$WORK/.claude/skills"
    node "$ROOT/scripts/generate-skill.mjs" --project "$WORK" --out "$WORK/.claude/skills" 2>/dev/null
    cp "$WORK/.claude/skills/SKILL.md" "$EXPT/results/$ID.skill.md" 2>/dev/null
  fi

  # Layer 2/4 (DISCOVERY-RELIABILITY.md): deterministic completion detect-and-
  # recover. The stall signature is deterministic — the task's `scope` capability
  # did not land (its @fonderie package not installed AND no hand-rolled code for
  # it). We do not trust the model's prose; we inspect the tree. If incomplete
  # after the first attempt, re-invoke ONCE with a corrective directive (gate
  # discipline: one iteration). `completed` is recorded as a hard gate flag so a
  # stalled session can never pass silently.
  # capability keyword per scope package (delegation OR hand-rolled both count)
  kw_for() { case "$1" in
    workspaces) echo 'workspace';; courier) echo 'mail|email|invit';;
    rate-limit) echo 'rate.?limit|ratelimit';; audit) echo 'audit';;
    billing) echo 'subscription|stripe|checkout';; auth) echo 'login|auth|session';;
    permissions) echo 'role|permission';; *) echo "$1";; esac; }
  is_complete() {  # every scope pkg present as install OR as code
    [ -z "$SCOPE" ] && return 0
    local IFS=,; for p in $SCOPE; do
      [ -d "$WORK/node_modules/@fonderie/$p" ] && continue
      cat "$WORK"/src/*.ts 2>/dev/null | grep -qiE "$(kw_for "$p")" && continue
      return 1
    done; return 0
  }
  CORRECTIVE=$'\n\n[HARNESS] Complete the task fully and autonomously in this run. If it needs an @fonderie package you have not installed, install it (npm i), run its migrations, wire it per the brain recipe, and build the endpoints. Do NOT ask questions, request permission, or report it as not-doable — adding the brick IS the task. Pick sensible defaults for any provider/config choice behind fail-fast env vars.'

  cd "$WORK"
  START=$(date +%s)
  COMPLETED=false; RECOVERED=false
  for attempt in 1 2; do
    P="$PROMPT"; [ "$attempt" = 2 ] && P="$PROMPT$CORRECTIVE"
    env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT DATABASE_URL="$DBURL" "$CLAUDE_BIN" -p "$P" \
      --model claude-opus-4-8 \
      --output-format json \
      --dangerously-skip-permissions \
      ${MCPARGS[@]+"${MCPARGS[@]}"} \
      </dev/null \
      > "$EXPT/results/$ID.json" 2> "$EXPT/results/$ID.err"
    CODE=$?
    # A session-limit stub is inconclusive — bail out of the retry loop; the
    # post-loop is_limited guard removes the partial result and stops for resume
    # (no completed/gate verdict is written for a limit-truncated session).
    if is_limited "$EXPT/results/$ID.json"; then break; fi
    if is_complete; then COMPLETED=true; break; fi
    [ "$attempt" = 1 ] && { RECOVERED=true; echo "  ⚠ $ID incomplete (scope '$SCOPE' not delivered) — Layer-2 corrective re-invoke"; }
  done
  END=$(date +%s)

  # If the session ended on a session-limit stub, the run is INCONCLUSIVE — the
  # limit may have interrupted work that was actually completing (verified live:
  # pb-r3-s2 had installed billing before the limit hit on the corrective retry).
  # Do NOT write a completed/gate verdict (either direction is a false record);
  # remove partial result files and stop cleanly so resume re-runs it honestly.
  if is_limited "$EXPT/results/$ID.json"; then
    rm -f "$EXPT/results/$ID".json "$EXPT/results/$ID".meta.json "$EXPT/results/$ID".err
    echo "SESSION LIMIT at $ID (inconclusive — no verdict recorded) — stopping. Re-run to resume."
    exit 3
  fi

  loc=$(find "$WORK/src" -name '*.ts' 2>/dev/null | xargs cat 2>/dev/null | grep -vc '^[[:space:]]*$')
  (cd "$WORK" && npx tsc --noEmit >/dev/null 2>&1 </dev/null) && TSC=yes || TSC=no

  # Resident Fonderie-knowledge size K (tokens ≈ chars/4) — the artifact charged
  # as cache_read every turn. pb: the compiled CLAUDE.md; fat: the loaded skill
  # dir minus brain artifacts; scratch: 0. This is analyze.mjs's static-K input.
  case "$COND" in
    pb|pb-scoped)  KCH=$(wc -c < "$WORK/CLAUDE.md" 2>/dev/null || echo 0) ;;
    # pb-lazy resident = the ROUTER only; per-package bodies load on demand (their
    # cost shows up as fetched, like a CLI read — the whole point of lazy).
    pb-lazy)  KCH=$(wc -c < "$WORK/.claude/skills/SKILL.md" 2>/dev/null || echo 0) ;;
    fat)  KCH=$(find "$WORK/.claude/skills/fonderie" -type f ! -name 'brain.json' ! -name 'brain-knowledge.json' -exec cat {} + 2>/dev/null | wc -c) ;;
    *)    KCH=0 ;;
  esac
  KTOK=$(( ${KCH:-0} / 4 ))
  echo "{\"run\":\"$ID\",\"cond\":\"$COND\",\"seq\":\"$SEQ\",\"session\":$N,\"exit\":$CODE,\"wall_s\":$((END-START)),\"loc\":$loc,\"tsc\":\"$TSC\",\"k_tokens\":$KTOK,\"scope\":\"$SCOPE\",\"completed\":$COMPLETED,\"recovered\":$RECOVERED}" \
    > "$EXPT/results/$ID.meta.json"
  [ "$COMPLETED" = false ] && echo "  ✗ GATE: $ID did not deliver scope '$SCOPE' even after corrective re-invoke (Layer-4 flag)"

  SID=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).session_id||"")}catch{}' "$EXPT/results/$ID.json")
  TR=""
  if [ -n "$SID" ]; then
    TR=$(find "$HOME/.claude/projects" -name "$SID.jsonl" 2>/dev/null | head -1)
    [ -n "$TR" ] && cp "$TR" "$EXPT/results/$ID.transcript.jsonl"
  fi

  echo "$ID done (exit $CODE, $((END-START))s, loc:$loc tsc:$TSC, transcript:${TR:+yes})"
done 3< "${SESSIONS_FILE:-$EXPT/sessions.jsonl}"
echo "sequence $COND-$SEQ complete"
