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
# → Fonderie listening on http://localhost:3000
```

---

## Auth endpoints

### Register
```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123","firstName":"Alice","lastName":"Smith"}' \
  | jq .
# → { user: {...}, accessToken: "...", refreshToken: "..." }
```

### Login
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq .
# → { user: {...}, accessToken: "...", refreshToken: "..." }

# Save the token:
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq -r '.accessToken')
```

### Refresh
```bash
REFRESH=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq -r '.refreshToken')

curl -s -X POST http://localhost:3000/auth/refresh \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | jq .
# → { user: {...}, accessToken: "...", refreshToken: "..." }
```

### Logout
```bash
curl -s -X POST http://localhost:3000/auth/logout \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | jq .
# → { ok: true }
```

### Forgot password
```bash
curl -s -X POST http://localhost:3000/auth/forgot-password \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com"}' \
  | jq .
# → { ok: true }  (always, to prevent email enumeration)
```

### Reset password
```bash
# resetToken comes from the password-reset email
curl -s -X POST http://localhost:3000/auth/reset-password \
  -H 'content-type: application/json' \
  -d '{"resetToken":"<token-from-email>","password":"newPassword123"}' \
  | jq .
# → { ok: true }
```

### Verify email
```bash
# token comes from the email-verification email
curl -s -X POST http://localhost:3000/auth/verify-email \
  -H 'content-type: application/json' \
  -d '{"token":"<token-from-email>"}' \
  | jq .
# → { ok: true }
```

---

## User profile

### Get profile
```bash
curl -s http://localhost:3000/users/me \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { id, email, firstName, lastName, phone, avatarUrl, locale, ... }
```

### Update profile
```bash
curl -s -X PATCH http://localhost:3000/users/me \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"firstName":"Alicia","phoneNumber":"+15550001234","avatarUrl":"https://i.pravatar.cc/150"}' \
  | jq .
# → updated IUserDTO
```

---

## Workspaces

### Create workspace
```bash
WS=$(curl -s -X POST http://localhost:3000/workspaces \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"name":"Acme Corp","description":"Our main workspace"}' \
  | jq -r '.workspace.id')

echo "Workspace ID: $WS"
```

### Get workspace
```bash
curl -s http://localhost:3000/workspaces/$WS \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { workspace: { id, name, slug, type, plan, ownerId, isArchived, ... } }
```

### Update workspace
```bash
curl -s -X PUT http://localhost:3000/workspaces/$WS \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -H "x-workspace-id: $WS" \
  -d '{"name":"Acme Corp (updated)","description":"New description"}' \
  | jq .
```

### List workspaces
```bash
curl -s http://localhost:3000/workspaces \
  -H "authorization: Bearer $TOKEN" \
  | jq .
```

### Invite a member
```bash
curl -s -X POST http://localhost:3000/workspaces/invitations \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -H "x-workspace-id: $WS" \
  -d '{"email":"bob@example.com","roleId":"<role-uuid>"}' \
  | jq .
```

---

## Billing

### List plans
```bash
curl -s http://localhost:3000/billing/plans | jq .
```

### Get workspace subscription
```bash
curl -s http://localhost:3000/workspaces/$WS/billing/subscription \
  -H "authorization: Bearer $TOKEN" \
  | jq .
```

---

## Other

### Health check
```bash
curl -s http://localhost:3000/health | jq .
# → { ok: true, ts: "...", version: "0.0.1" }
```

### Remote config (dev only)
```bash
curl -s http://localhost:3000/config \
  -H "authorization: Bearer $TOKEN" \
  | jq .
# → { config: { "maintenance.mode": false, ... } }
```

### Permission-gated example route
```bash
# Requires auth + workspace membership + READ permission on 'projects'
curl -s http://localhost:3000/workspaces/$WS/projects \
  -H "authorization: Bearer $TOKEN" \
  | jq .
```

---

## Response shapes

All user-returning endpoints (`register`, `login`, `refresh`, `GET /users/me`, `PATCH /users/me`) return:

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
