#!/bin/bash
# Stage-3 regression flow: GUEST member cannot mutate; ADMIN can; denial is 403.
# Reuses workspace.sh env vars plus:
#   RBAC_MUTATION_PATH (templated {wsId}) — a workspace mutation endpoint
#   RBAC_MUTATION_BODY — JSON body for it
# Precondition: run right after workspace.sh concepts — this script builds its
# own users/workspace so it stands alone.
set -eu
: "${BASE:?}" "${SIGNUP_PATH:?}" "${LOGIN_PATH:?}" "${WS_CREATE_PATH:?}" \
  "${WS_INVITE_PATH:?}" "${WS_ACCEPT_PATH:?}" "${RBAC_MUTATION_PATH:?}" "${RBAC_MUTATION_BODY:?}"
AUTH_STYLE=${AUTH_STYLE:-cookie}
TOKEN_FIELD=${TOKEN_FIELD:-token}
INVITE_TOKEN_MODE=${INVITE_TOKEN_MODE:-response}
INVITE_TOKEN_FIELD=${INVITE_TOKEN_FIELD:-token}
fail() { echo "SMOKE-RBAC FAIL: $1" >&2; exit 1; }
jsonp() { node -p "((o)=>{try{return o$2 ?? ''}catch{return ''}})(JSON.parse(require('fs').readFileSync('$1','utf8')))"; }
mkuser() {
  local jar body code
  jar=$(mktemp); body=$(mktemp)
  curl -s -o /dev/null -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Str0ng!passw0rd-smoke\"}" "$BASE$SIGNUP_PATH"
  code=$(curl -s -o "$body" -w '%{http_code}' -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Str0ng!passw0rd-smoke\"}" "$BASE$LOGIN_PATH")
  [ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "login($1) returned $code"
  if [ "$AUTH_STYLE" = bearer ]; then
    local tok; tok=$(jsonp "$body" ".$TOKEN_FIELD"); [ -n "$tok" ] || fail "no token for $1"
    AUTHH=(-H "Authorization: Bearer $tok")
  else
    AUTHH=(-b "$jar")
  fi
}

TS=$(date +%s)
mkuser "rbacA-$TS@example.com"; AH_A=("${AUTHH[@]}")
body=$(mktemp)
curl -s -o "$body" "${AH_A[@]}" -H 'Content-Type: application/json' -d "{\"name\":\"RBAC Co $TS\"}" "$BASE$WS_CREATE_PATH" >/dev/null
WSID=$(jsonp "$body" ".${WS_ID_FIELD:-id}"); [ -n "$WSID" ] || WSID=$(jsonp "$body" ".workspace.id")
[ -n "$WSID" ] || fail "no workspace id"

# Optional workspace-context header, as in workspace.sh
WSH=()
[ -n "${WS_CTX_HEADER:-}" ] && WSH=(-H "$WS_CTX_HEADER: $WSID")

B="rbacB-$TS@example.com"
inv=$(mktemp)
ib=${WS_INVITE_BODY:-"{\"email\":\"{email}\"}"}; ib=${ib//\{email\}/$B}
curl -s -o "$inv" "${AH_A[@]}" ${WSH[@]+"${WSH[@]}"} -H 'Content-Type: application/json' -d "$ib" \
  "$BASE${WS_INVITE_PATH//\{wsId\}/$WSID}" >/dev/null
if [ "$INVITE_TOKEN_MODE" = db ]; then
  : "${INVITE_TOKEN_SQL:?}"
  ITOK=$(node -e "
    const {Client}=require('${PG_MODULE:-/Users/choleski/Desktop/crewfinding/fonderie-js/node_modules/pg}');
    const c=new Client({connectionString:process.env.DATABASE_URL});
    c.connect().then(()=>c.query(process.env.INVITE_TOKEN_SQL,['$B'])).then(r=>{console.log((r.rows[0]?.token??'')+'\t'+(r.rows[0]?.pin??''));return c.end()});")
  IPIN=${ITOK#*$'\t'}; ITOK=${ITOK%%$'\t'*}
elif [ "$INVITE_TOKEN_MODE" = log ]; then
  : "${APP_LOG:?}" "${INVITE_TOKEN_REGEX:?}"
  sleep 1
  ITOK=$(grep -oE "$INVITE_TOKEN_REGEX" "$APP_LOG" | tail -1 | sed -E "s/${INVITE_TOKEN_STRIP:-.*=}//")
else
  ITOK=$(jsonp "$inv" ".$INVITE_TOKEN_FIELD"); [ -n "$ITOK" ] || ITOK=$(jsonp "$inv" ".invitation.$INVITE_TOKEN_FIELD")
fi
[ -n "$ITOK" ] || fail "no invitation token"
mkuser "$B"; AH_B=("${AUTHH[@]}")
ACCEPT_ARGS=(-X POST -H 'Content-Type: application/json')
if [ -n "${WS_ACCEPT_BODY:-}" ]; then
  ab=${WS_ACCEPT_BODY//\{token\}/$ITOK}; ab=${ab//\{pin\}/${IPIN:-}}
  ACCEPT_ARGS+=(-d "$ab")
fi
curl -s -o /dev/null "${AH_B[@]}" "${ACCEPT_ARGS[@]}" \
  "$BASE${WS_ACCEPT_PATH//\{token\}/$ITOK}"

# GUEST (invited member) attempts a mutation -> must be denied
code=$(curl -s -o /dev/null -w '%{http_code}' "${AH_B[@]}" ${WSH[@]+"${WSH[@]}"} -X POST -H 'Content-Type: application/json' \
  -d "$RBAC_MUTATION_BODY" "$BASE${RBAC_MUTATION_PATH//\{wsId\}/$WSID}")
[ "$code" -eq 401 ] || [ "$code" -eq 403 ] || fail "guest mutation returned $code (expected 401/403)"

# ADMIN (creator) same mutation -> must succeed
code=$(curl -s -o /dev/null -w '%{http_code}' "${AH_A[@]}" ${WSH[@]+"${WSH[@]}"} -X POST -H 'Content-Type: application/json' \
  -d "$RBAC_MUTATION_BODY" "$BASE${RBAC_MUTATION_PATH//\{wsId\}/$WSID}")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "admin mutation returned $code"

echo "SMOKE-RBAC PASS"
