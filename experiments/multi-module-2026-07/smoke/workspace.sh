#!/bin/bash
# Stage-2 regression flow: user A creates a workspace, invites user B,
# B accepts, members list contains both.
# smoke.env: BASE, SIGNUP_PATH, LOGIN_PATH, WS_CREATE_PATH, WS_INVITE_PATH,
#   WS_ACCEPT_PATH, WS_MEMBERS_PATH  (templated with {wsId} and {token}),
#   plus AUTH_STYLE/TOKEN_FIELD as in auth.sh.
# Invitation token retrieval: INVITE_TOKEN_MODE=response|db|log (default response —
# token expected in the invite response JSON field INVITE_TOKEN_FIELD, default
# 'token'; 'db' reads it from Postgres via INVITE_TOKEN_SQL; 'log' greps the
# app log APP_LOG with INVITE_TOKEN_REGEX, last match wins).
set -eu
: "${BASE:?}" "${SIGNUP_PATH:?}" "${LOGIN_PATH:?}" "${WS_CREATE_PATH:?}" \
  "${WS_INVITE_PATH:?}" "${WS_ACCEPT_PATH:?}" "${WS_MEMBERS_PATH:?}"
AUTH_STYLE=${AUTH_STYLE:-cookie}
TOKEN_FIELD=${TOKEN_FIELD:-token}
INVITE_TOKEN_MODE=${INVITE_TOKEN_MODE:-response}
INVITE_TOKEN_FIELD=${INVITE_TOKEN_FIELD:-token}
fail() { echo "SMOKE-WS FAIL: $1" >&2; exit 1; }
jsonp() { node -p "((o)=>{try{return o$2 ?? ''}catch{return ''}})(JSON.parse(require('fs').readFileSync('$1','utf8')))"; }

mkuser() { # $1 email -> prints auth header args via global AUTHH
  local jar body code
  jar=$(mktemp); body=$(mktemp)
  curl -s -o /dev/null -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Str0ng!passw0rd-smoke\"}" "$BASE$SIGNUP_PATH"
  code=$(curl -s -o "$body" -w '%{http_code}' -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Str0ng!passw0rd-smoke\"}" "$BASE$LOGIN_PATH")
  [ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "login($1) returned $code"
  if [ "$AUTH_STYLE" = bearer ]; then
    local tok; tok=$(jsonp "$body" ".$TOKEN_FIELD")
    [ -n "$tok" ] || fail "no token for $1"
    AUTHH=(-H "Authorization: Bearer $tok")
  else
    AUTHH=(-b "$jar")
  fi
}

TS=$(date +%s)
A="smokeA-$TS@example.com"; B="smokeB-$TS@example.com"

mkuser "$A"; AH_A=("${AUTHH[@]}")
body=$(mktemp)
code=$(curl -s -o "$body" -w '%{http_code}' "${AH_A[@]}" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Co $TS\"}" "$BASE$WS_CREATE_PATH")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "workspace create returned $code"
WSID=$(jsonp "$body" ".${WS_ID_FIELD:-id}" ); [ -n "$WSID" ] || WSID=$(jsonp "$body" ".workspace.id")
[ -n "$WSID" ] || fail "no workspace id in create response"

# Optional workspace-context header (e.g. WS_CTX_HEADER=x-workspace-id) for
# apps that scope requests by header instead of path.
WSH=()
[ -n "${WS_CTX_HEADER:-}" ] && WSH=(-H "$WS_CTX_HEADER: $WSID")

inv=$(mktemp)
ib=${WS_INVITE_BODY:-"{\"email\":\"{email}\"}"}; ib=${ib//\{email\}/$B}
code=$(curl -s -o "$inv" -w '%{http_code}' "${AH_A[@]}" ${WSH[@]+"${WSH[@]}"} -H 'Content-Type: application/json' \
  -d "$ib" "$BASE${WS_INVITE_PATH//\{wsId\}/$WSID}")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "invite returned $code"

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
code=$(curl -s -o /dev/null -w '%{http_code}' "${AH_B[@]}" "${ACCEPT_ARGS[@]}" \
  "$BASE${WS_ACCEPT_PATH//\{token\}/$ITOK}")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "accept returned $code"

mem=$(mktemp)
code=$(curl -s -o "$mem" -w '%{http_code}' "${AH_A[@]}" ${WSH[@]+"${WSH[@]}"} "$BASE${WS_MEMBERS_PATH//\{wsId\}/$WSID}")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "members list returned $code"
# Membership assertion: B's email, or (for APIs whose members payload carries
# user ids instead of emails) B's user id as reported by B's own ME_PATH.
if ! grep -qi "$B" "$mem"; then
  bid=""
  if [ -n "${ME_PATH:-}" ] && [ -n "${ME_ID_FIELD:-}" ]; then
    me=$(mktemp)
    curl -s -o "$me" "${AH_B[@]}" "$BASE$ME_PATH"
    bid=$(jsonp "$me" ".$ME_ID_FIELD")
  fi
  [ -n "$bid" ] && grep -qi "$bid" "$mem" || fail "member B missing from members list"
fi

echo "SMOKE-WS PASS"
