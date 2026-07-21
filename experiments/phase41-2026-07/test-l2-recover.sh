#!/bin/bash
# Forced-stall fixture test for Layer 2 (DISCOVERY-RELIABILITY.md): proves the
# deterministic detect-and-recover loop in run-sequence.sh recovers a stalled
# session — WITHOUT any model spend. A fake `claude` stalls on the first attempt
# (builds nothing) and completes only when it sees the [HARNESS] corrective on
# the second. Drives the REAL run-sequence.sh via CLAUDE_BIN/SESSIONS_FILE hooks.
#
#   ./test-l2-recover.sh        # exits 0 on pass, non-zero on fail
set -u
EXPT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fail() { echo "FAIL: $1"; exit 1; }

# --- fake claude: stall until told to recover -------------------------------
# Args include `-p "<prompt>"`; the workdir is CWD. Attempt 1 (no [HARNESS]
# marker) → do NOTHING (the stall). Attempt 2 (corrective present) → create the
# scope capability (simulate the model finally installing @fonderie/workspaces).
cat > "$TMP/claude" <<'FAKE'
#!/bin/bash
prompt=""
while [ $# -gt 0 ]; do case "$1" in -p) shift; prompt="$1";; esac; shift; done
if printf '%s' "$prompt" | grep -q '\[HARNESS\]'; then
  mkdir -p "node_modules/@fonderie/workspaces"   # recover: capability now present
  echo '{"is_error":false,"num_turns":9,"result":"installed workspaces and built teams","session_id":""}'
else
  echo '{"is_error":false,"num_turns":6,"result":"This cannot be done with what is installed. Which email provider?","session_id":""}'
fi
FAKE
chmod +x "$TMP/claude"

# --- one-session workload with a scope the fake will stall on ----------------
printf '%s\n' '{"n":1,"prompt":"Add teams with email invites.","scope":"workspaces"}' > "$TMP/sessions.jsonl"

# --- drive the REAL harness with the fake model ------------------------------
CLEAN() { rm -rf "${TMPDIR:-/tmp}/fonderie-p41/scratch-l2fix"; rm -f "$EXPT/results/scratch-l2fix-"*; }
CLEAN
CLAUDE_BIN="$TMP/claude" SESSIONS_FILE="$TMP/sessions.jsonl" SEQ_MAX_SESSIONS=1 \
  "$EXPT/run-sequence.sh" scratch l2fix >"$TMP/out.log" 2>&1 || true

META="$EXPT/results/scratch-l2fix-s1.meta.json"
[ -f "$META" ] || { cat "$TMP/out.log"; fail "no meta written"; }
completed=$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1])).completed))' "$META")
recovered=$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1])).recovered))' "$META")

echo "meta: completed=$completed recovered=$recovered"
grep -q 'corrective re-invoke' "$TMP/out.log" || fail "Layer-2 corrective re-invoke did not fire on the stall"
[ "$recovered" = "true" ] || fail "recovered flag not set (stall not detected)"
[ "$completed" = "true" ] || fail "completed flag not true after recovery"
[ -d "${TMPDIR:-/tmp}/fonderie-p41/scratch-l2fix/node_modules/@fonderie/workspaces" ] || fail "capability not present after recovery"

# --- negative control: a fake that NEVER completes must fail the gate --------
cat > "$TMP/claude" <<'FAKE'
#!/bin/bash
echo '{"is_error":false,"num_turns":6,"result":"declining, cannot do this","session_id":""}'
FAKE
chmod +x "$TMP/claude"
CLEAN
CLAUDE_BIN="$TMP/claude" SESSIONS_FILE="$TMP/sessions.jsonl" SEQ_MAX_SESSIONS=1 \
  "$EXPT/run-sequence.sh" scratch l2fix >"$TMP/out2.log" 2>&1 || true
completed2=$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1])).completed))' "$META")
grep -q 'GATE:' "$TMP/out2.log" || fail "gate did not flag a permanently-stalled session"
[ "$completed2" = "false" ] || fail "permanent stall wrongly marked completed"
echo "negative control: completed=$completed2, gate flagged ✓"
CLEAN

echo "test-l2-recover: PASS — stall detected, corrective recovered it, gate catches permanent stalls"
