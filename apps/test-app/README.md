# Fonderie test-app

A local server that wires up every `@fonderie-js/*` module so you can hit the endpoints with curl or Postman.

## Quick start

```bash
# 1. Copy env file and fill in DATABASE_URL + JWT_SECRET
npm run setup
$EDITOR .env

# 2. Create the database (first time only)
createdb fonderie_dev

# 3. Run migrations
npm run migrate

# 4. Start the server  (builds all SDK packages automatically first)
npm run dev
# → Fonderie listening on http://localhost:4000
```

> **Base URL:** `http://localhost:4000/v1`  All examples below use `BASE=http://localhost:4000/v1`.

```bash
BASE=http://localhost:4000/v1
```

---

## Auth endpoints

### Register
```bash
curl -s -X POST $BASE/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123","firstName":"Alice","lastName":"Smith"}' \
  | jq .
# → { user: {...}, accessToken: "...", refreshToken: "..." }
```

### Login
```bash
curl -s -X POST $BASE/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq .
# → { user: {...}, accessToken: "...", refreshToken: "..." }

# Save the token:
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq -r '.accessToken')
```

### Refresh
```bash
REFRESH=$(curl -s -X POST $BASE/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq -r '.refreshToken')

curl -s -X POST $BASE/auth/refresh \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | jq .
# → { user: {...}, accessToken: "...", refreshToken: "..." }
```

### Logout
```bash
curl -s -X POST $BASE/auth/logout \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | jq .
# → { ok: true }
```

### Forgot password
```bash
curl -s -X POST $BASE/auth/email/forgot \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com"}' \
  | jq .
# → { ok: true }  (always, to prevent email enumeration)
```

### Reset password
```bash
# resetToken comes from the password-reset email
curl -s -X POST $BASE/auth/email/reset \
  -H 'content-type: application/json' \
  -d '{"resetToken":"<token-from-email>","password":"newPassword123"}' \
  | jq .
# → { ok: true }
```

### Send verification code
```bash
# Sends OTP to email or phone depending on how the user registered
curl -s $BASE/auth/send-verification \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { ok: true }
```

### Verify email or phone
```bash
curl -s -X POST $BASE/auth/verify \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"token":"<otp-from-email-or-sms>"}' \
  | jq .
# → { ok: true }
```

---

## User profile

### Get profile
```bash
curl -s $BASE/users \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { id, email, firstName, lastName, phone, avatarUrl, locale, timezone, ... }
```

### Update profile  _(requires verified email)_
```bash
curl -s -X PUT $BASE/users/profile \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"firstName":"Alicia","lastName":"Smith","avatarUrl":"https://i.pravatar.cc/150"}' \
  | jq .
# → updated IUserDTO
```

### Update preferences  _(requires verified email)_
```bash
curl -s -X PUT $BASE/users/preferences \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"locale":"fr-CA","timezone":"America/Montreal"}' \
  | jq .
# → updated IUserDTO
```

### Change email  _(requires verified email — sends verification to new address + change alert to old)_
```bash
curl -s -X PUT $BASE/users/email \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"email":"alice-new@example.com"}' \
  | jq .
# → { ok: true }
```

### Change phone  _(requires verified email — sends OTP to new number + change alert to email)_
```bash
curl -s -X PUT $BASE/users/phone \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"phone":"+15550001234"}' \
  | jq .
# → { ok: true }
```

### Delete account  _(requires verified email)_
```bash
curl -s -X DELETE $BASE/users \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { ok: true }
```

---

## Workspaces

### Create workspace
```bash
WS=$(curl -s -X POST $BASE/workspaces \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"name":"Acme Corp","description":"Our main workspace"}' \
  | jq -r '.workspace.id')

echo "Workspace ID: $WS"
```

### Get workspace
```bash
curl -s $BASE/workspaces/$WS \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { workspace: { id, name, slug, type, plan, ownerId, isArchived, ... } }
```

### Update workspace
```bash
curl -s -X PUT $BASE/workspaces/$WS \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -H "x-workspace-id: $WS" \
  -d '{"name":"Acme Corp (updated)","description":"New description"}' \
  | jq .
```

### List workspaces
```bash
curl -s $BASE/workspaces \
  -H "authorization: Bearer $TOKEN" \
  | jq .
```

### Invite a member
```bash
curl -s -X POST $BASE/workspaces/invitations \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -H "x-workspace-id: $WS" \
  -d '{"email":"bob@example.com","roleId":"<role-uuid>"}' \
  | jq .
```

---

## Billing — plans  _(public)_

Plans are publicly readable so your marketing/pricing pages don't need an auth token.

### List all plans
```bash
curl -s $BASE/plans | jq .
# → {
#     "plans": [ { id, planId, name, tier, seats, trialDays, pricing, features, metadata }, ... ]
#   }
```

### Get a single plan
```bash
PLAN_ID="<uuid-from-list>"

curl -s $BASE/plans/$PLAN_ID | jq .
# → { "plan": { id, planId, name, tier, seats, trialDays, pricing, features, metadata } }
```

### Plan shape
```json
{
  "id":          "uuid",
  "planId":      "PRO",
  "name":        "pro",
  "description": "For growing teams who need more power",
  "tier":        2,
  "seats":       20,
  "trialDays":   0,
  "pricing": {
    "monthly":  7900,
    "yearly":   79000,
    "currency": "USD"
  },
  "features": [
    { "name": "Projects",   "description": "Unlimited projects",    "enabled": true              },
    { "name": "Storage",    "description": "100 GB storage",        "enabled": true, "limit": 100 },
    { "name": "API access", "description": "Up to 100 000 req/day", "enabled": true, "limit": 100000 },
    { "name": "SSO",        "description": "SAML single sign-on",   "enabled": false             }
  ],
  "metadata": {}
}
```

> Amounts are in **cents** (e.g. `7900` = $79.00).  A `0` amount means the tier is free.
> `seats: null` means unlimited seats.  `trialDays: 0` means no trial.

---

## Billing — workspace subscription

### Get subscription
```bash
curl -s $BASE/workspaces/$WS/billing/subscription \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { subscription: { id, workspaceId, plan, interval, status, cancelAtPeriodEnd, ... } }
```

### Create Stripe checkout session
```bash
curl -s -X POST $BASE/workspaces/$WS/billing/checkout \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"priceId":"price_pro_monthly","interval":"month"}' \
  | jq .
# → { "url": "https://checkout.stripe.com/..." }
```

### Open Stripe billing portal
```bash
curl -s -X POST $BASE/workspaces/$WS/billing/portal \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { "url": "https://billing.stripe.com/session/..." }
```

### Record usage
```bash
curl -s -X POST $BASE/workspaces/$WS/billing/usage \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"metric":"api_calls","quantity":1}' \
  | jq .
# → { ok: true }
```

### Get usage for a metric
```bash
curl -s $BASE/workspaces/$WS/billing/usage/api_calls \
  -H "authorization: Bearer $TOKEN" \
  | jq .
```

---

## Other

### Health check
```bash
curl -s $BASE/../health | jq .
# → { ok: true, ts: "...", version: "0.0.1" }
```

### Remote config  _(dev only)_
```bash
curl -s $BASE/config \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { config: { "maintenance.mode": false, ... } }
```

### Permission-gated example route
```bash
# Requires auth + workspace membership + READ permission on 'projects'
curl -s $BASE/workspaces/$WS/projects \
  -H "authorization: Bearer $TOKEN" \
  | jq .
```

---

## Response shapes

All user-returning endpoints (`register`, `login`, `refresh`, `GET /users`) return:

```json
{
  "id":              "uuid",
  "email":           "alice@example.com",
  "firstName":       "Alice",
  "lastName":        "Smith",
  "phone":           "",
  "avatarUrl":       "",
  "locale":          "en-US",
  "timezone":        "UTC",
  "isEmailVerified": false,
  "mfaEnabled":      false,
  "suspended":       false,
  "createdAt":       "2024-01-01T00:00:00.000Z",
  "updatedAt":       "2024-01-01T00:00:00.000Z"
}
```

Workspace endpoints (`GET /workspaces/:id`, `PUT /workspaces/:id`) return:

```json
{
  "workspace": {
    "id":          "uuid",
    "name":        "Acme Corp",
    "slug":        "acme-corp",
    "type":        "ORGANIZATION",
    "description": "",
    "plan":        "free",
    "ownerId":     "uuid",
    "isArchived":  false,
    "archivedAt":  "",
    "createdAt":   "2024-01-01T00:00:00.000Z",
    "updatedAt":   "2024-01-01T00:00:00.000Z"
  }
}
```
