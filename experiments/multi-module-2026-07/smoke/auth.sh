#!/bin/bash
# Stage-1 regression flow: signup -> login -> authenticated probe -> logout.
# Fixed assertions; endpoint paths come from the sequence's smoke.env:
#   BASE, SIGNUP_PATH, LOGIN_PATH, LOGOUT_PATH, ME_PATH (any authed GET)
# Optional: AUTH_STYLE=cookie|bearer (default cookie), TOKEN_FIELD (default token)
set -eu
: "${BASE:?}" "${SIGNUP_PATH:?}" "${LOGIN_PATH:?}" "${LOGOUT_PATH:?}" "${ME_PATH:?}"
AUTH_STYLE=${AUTH_STYLE:-cookie}
TOKEN_FIELD=${TOKEN_FIELD:-token}
EMAIL="smoke-$(date +%s)@example.com"
PASS='Str0ng!passw0rd-smoke'
JAR=$(mktemp)
fail() { echo "SMOKE-AUTH FAIL: $1" >&2; exit 1; }

code=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$BASE$SIGNUP_PATH")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "signup returned $code"

login_body=$(mktemp)
code=$(curl -s -o "$login_body" -w '%{http_code}' -c "$JAR" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$BASE$LOGIN_PATH")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "login returned $code"

if [ "$AUTH_STYLE" = bearer ]; then
  TOKEN=$(node -p "((o)=>{try{return o.$TOKEN_FIELD ?? ''}catch{return ''}})(JSON.parse(require('fs').readFileSync('$login_body','utf8')))")
  [ -n "$TOKEN" ] || fail "no $TOKEN_FIELD in login response"
  AUTHH=(-H "Authorization: Bearer $TOKEN")
else
  AUTHH=(-b "$JAR")
fi

code=$(curl -s -o /dev/null -w '%{http_code}' "${AUTHH[@]}" "$BASE$ME_PATH")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "authed probe returned $code"

code=$(curl -s -o /dev/null -w '%{http_code}' "${AUTHH[@]}" -X POST "$BASE$LOGOUT_PATH")
[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || fail "logout returned $code"

code=$(curl -s -o /dev/null -w '%{http_code}' "${AUTHH[@]}" "$BASE$ME_PATH")
[ "$code" -eq 401 ] || [ "$code" -eq 403 ] || fail "probe after logout returned $code (expected 401/403)"

echo "SMOKE-AUTH PASS"
