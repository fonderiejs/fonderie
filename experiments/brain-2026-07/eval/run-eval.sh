#!/bin/bash
# R2 concept-selection eval (BRAIN_PLAN.md "R2 update" + "Pilot run").
#
# For each phrase in corpus.tsv, a FRESH model instance sees ONLY the concept
# menu (exactly what the brain_query MCP tool schema exposes) and must pick one
# concept ID. This measures the intent->concept mapping that IS the R2
# mechanism — no BM25, no signatures, no other context in the prompt.
#
# STATUS: indicative, NOT the official R2 gate. The corpus is generated +
# translated (see README.md), not real user phrasings, and the model here
# (claude-haiku-4-5) is deliberately below the gate spec (claude-opus-4-8).
# The official gate needs a real-phrasing corpus; this harness is what will run
# against it when it exists.
#
#   ./run-eval.sh              # runs corpus.tsv, writes results.txt, prints tallies
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../../.." && pwd)"          # fonderie-js repo root
MENU="$(node "$REPO/scripts/brain-query.mjs" --concepts)"

run_one() {
  local lang="$1" phrase="$2" expected="$3"
  local pick
  pick=$(claude -p --model claude-haiku-4-5-20251001 "You are a coding assistant with one tool, brain_query, whose 'concept' parameter is an enum. Concepts:
$MENU

A user asked (in their own words): \"$phrase\"

Reply with EXACTLY one concept ID from the list above — nothing else." 2>/dev/null | tr -d '[:space:]')
  if [ "$pick" = "$expected" ]; then
    echo "PASS	$lang	$phrase	$expected"
  else
    echo "FAIL	$lang	$phrase	expected=$expected got=$pick"
  fi
}
export -f run_one
export MENU

# NUL-delimit fields so phrases with spaces survive xargs; run 8 in parallel.
while IFS=$'\t' read -r lang phrase expected; do
  printf '%s\0%s\0%s\0' "$lang" "$phrase" "$expected"
done < "$DIR/corpus.tsv" | xargs -0 -n3 -P 8 bash -c 'run_one "$1" "$2" "$3"' _ > "$DIR/results.txt"

sort "$DIR/results.txt" -t$'\t' -k2,2 -k1,1 | column -t -s$'\t'
echo
overall_pass=0; overall_total=0
for L in $(awk -F'\t' '{print $2}' "$DIR/results.txt" | sort -u); do
  total=$(grep -c "	$L	" "$DIR/results.txt")
  pass=$(grep -c "^PASS	$L	" "$DIR/results.txt")
  echo "$L: $pass/$total"
  overall_pass=$((overall_pass + pass)); overall_total=$((overall_total + total))
done
echo "overall: $overall_pass/$overall_total"
