# Postman ↔ SDK Parity Analysis

**Collection:** `CrewFinding_API.postman_collection.json`  
**Base URL variable:** `{{base_url}}` → `https://crewfinding-api-prod.fly.dev/v1`  
**SDK packages audited:** `@fonderie-js/auth` · `@fonderie-js/workspaces`  
**Date:** 2026-05-08  
**Result:** ✅ All 11 SDK-relevant endpoints are 1:1

---

## Summary table

| # | Method | Path | Postman request | SDK handler | SDK response | Status |
|---|--------|------|----------------|-------------|--------------|--------|
| 1 | POST | `/auth/register` | `email, password, firstName?, lastName?` | `registerHandler` | `{ user, accessToken, refreshToken }` 201 | ✅ |
| 2 | POST | `/auth/login` | `email, password` | `loginHandler` | `{ user, accessToken, refreshToken }` 200 | ✅ |
| 3 | POST | `/auth/logout` | `{ refreshToken }` + Bearer header | `logoutHandler` | `{ ok: true }` 200 | ✅ |
| 4 | POST | `/auth/forgot-password` | `{ email }` | `forgotPasswordHandler` | `{ ok: true }` 200 | ✅ |
| 5 | POST | `/auth/reset-password` | `{ resetToken, password }` | `resetPasswordHandler` | `{ ok: true }` 200 | ✅ |
| 6 | POST | `/auth/refresh` | `{ refreshToken }` | `refreshHandler` | `{ user, accessToken, refreshToken }` 200 | ✅ |
| 7 | POST | `/auth/verify-email` | `{ token }` | `verifyEmailHandler` | `{ ok: true }` 200 | ✅ |
| 8 | GET | `/users/me` | Bearer header | `meHandler` | `IUserDTO` (flat) 200 | ✅ |
| 9 | PATCH | `/users/me` | `{ firstName?, lastName?, phoneNumber?, avatarUrl? }` | `updateMeHandler` | `IUserDTO` (flat) 200 | ✅ |
| 10 | GET | `/workspaces/:id` | Bearer header | `getWorkspaceHandler` | `{ workspace: IWorkspaceDTO }` 200 | ✅ |
| 11 | PUT | `/workspaces/:id` | `{ name?, description? }` + `X-WORKSPACE-ID` | `updateWorkspaceHandler` | `{ workspace: IWorkspaceDTO }` 200 | ✅ |
| — | GET | `/directions` | origin, destination query params | — | — | ⚪ Out of scope (external service) |
| — | GET | `/directions/matrix` | origin, destination query params | — | — | ⚪ Out of scope (external service) |

---

## Endpoint-by-endpoint detail

### 1 · POST `/auth/register`

**Postman request body**
```json
{
  "email":     "newuser@example.com",
  "password":  "password123",
  "firstName": "John",
  "lastName":  "Doe"
}
```

**SDK handler** — `packages/auth/src/handlers/register.ts` · `registerHandler`

Accepted fields:
| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `email` | ✅ | string | lowercased + trimmed before insert |
| `password` | ✅ | string | min 8 chars, bcrypt-hashed |
| `firstName` | optional | string | stored in `first_name` column |
| `lastName` | optional | string | stored in `last_name` column |

**SDK success response — 201**
```json
{
  "user":         { ...IUserDTO },
  "accessToken":  "<jwt>",
  "refreshToken": "<jwt>"
}
```
Sets `Set-Cookie: access_token=<jwt>; HttpOnly` and `refresh_token=<jwt>; HttpOnly`.

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 422 | `email` or `password` missing |
| 422 | `password` shorter than 8 characters |
| 409 | email already registered |
| 500 | DB insert failed |

---

### 2 · POST `/auth/login`

**Postman request body**
```json
{
  "email":    "user@example.com",
  "password": "password123"
}
```

**SDK handler** — `packages/auth/src/handlers/login.ts` · `loginHandler`

**SDK success response — 200**
```json
{
  "user":         { ...IUserDTO },
  "accessToken":  "<jwt>",
  "refreshToken": "<jwt>"
}
```
Sets `Set-Cookie: access_token` and `refresh_token`.

**SDK MFA response — 200**
```json
{ "mfaRequired": true }
```
Returned when the account has MFA enabled. Client should redirect to MFA verification.

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 422 | `email` or `password` missing |
| 401 | user not found or wrong password |
| 403 | account suspended |

---

### 3 · POST `/auth/logout`

**Postman request headers**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Postman request body**
```json
{ "refreshToken": "{{refresh_token}}" }
```

**SDK handler** — `packages/auth/src/handlers/logout.ts` · `logoutHandler`

Token resolution (supports both mobile and web):
1. `body.refreshToken` (React Native / mobile)
2. `refresh_token` HttpOnly cookie (web)

**SDK success response — 200**
```json
{ "ok": true }
```
Clears both cookies with `Max-Age=0`.  
Always returns 200 — token deletion errors are swallowed to prevent leaking session state.

---

### 4 · POST `/auth/forgot-password`

**Postman request body**
```json
{ "email": "user@example.com" }
```

**SDK handler** — `packages/auth/src/handlers/forgot-password.ts` · `forgotPasswordHandler`

**SDK success response — 200**
```json
{ "ok": true }
```
Always 200 regardless of whether the email exists (prevents email enumeration).  
When the user exists, a reset token is stored and a `password-reset` courier message is emitted.

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 422 | `email` field missing |

---

### 5 · POST `/auth/reset-password`

**Postman request body**
```json
{
  "resetToken": "reset-token-from-email",
  "password":   "newPassword123"
}
```

**SDK handler** — `packages/auth/src/handlers/reset-password.ts` · `resetPasswordHandler`

Accepted token field: `resetToken` (primary), with `token` accepted as fallback for backward compatibility.

**SDK success response — 200**
```json
{ "ok": true }
```

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 422 | `resetToken` or `password` missing |
| 422 | `password` shorter than 8 characters |
| 400 | token not found or expired |

---

### 6 · POST `/auth/refresh`

**Postman request body**
```json
{ "refreshToken": "{{refresh_token}}" }
```

**SDK handler** — `packages/auth/src/handlers/refresh.ts` · `refreshHandler`

Token resolution (supports both mobile and web):
1. `body.refreshToken` (React Native / mobile)
2. `refresh_token` HttpOnly cookie (web)

Session rotation is applied on every refresh — the old session is revoked and a new pair is issued. This prevents token reuse attacks.

**SDK success response — 200**
```json
{
  "user":         { ...IUserDTO },
  "accessToken":  "<jwt>",
  "refreshToken": "<jwt>"
}
```
Sets new cookies.

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 401 | no token in body or cookie |
| 401 | invalid or malformed JWT |
| 401 | session not found or already revoked |
| 401 | user suspended or deleted |

---

### 7 · POST `/auth/verify-email`

**Postman request body**
```json
{ "token": "{{verification_token}}" }
```

Postman variable: `{{verification_token}}` — populated from the link sent in the registration email.

**SDK handler** — `packages/auth/src/handlers/verify-email.ts` · `verifyEmailHandler`

**SDK success response — 200**
```json
{ "ok": true }
```

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 422 | `token` field missing |
| 400 | token not found |
| 400 | token expired |

---

### 8 · GET `/users/me`

**Postman request headers**
```
Authorization: Bearer {{access_token}}
```

**SDK handler** — `packages/auth/src/handlers/me.ts` · `meHandler`

Requires `requireAuth()` middleware upstream (populates `ctx.user` from JWT).

**SDK success response — 200 (flat, no envelope)**
```json
{
  "id":              "uuid",
  "email":           "user@example.com",
  "firstName":       "Jane",
  "lastName":        "Doe",
  "phone":           "+1234567890",
  "avatarUrl":       "https://cdn.example.com/avatar.jpg",
  "locale":          "en-US",
  "timezone":        "UTC",
  "isEmailVerified": true,
  "mfaEnabled":      false,
  "suspended":       false,
  "createdAt":       "2024-01-01T00:00:00.000Z",
  "updatedAt":       "2024-01-01T00:00:00.000Z"
}
```

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 401 | no authenticated user on context |
| 404 | user deleted after token issue |

---

### 9 · PATCH `/users/me`

**Postman request headers**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Postman request body**
```json
{
  "firstName":   "Jane",
  "lastName":    "Smith",
  "phoneNumber": "+9876543210",
  "avatarUrl":   "https://example.com/avatar.jpg"
}
```

**SDK handler** — `packages/auth/src/handlers/me.ts` · `updateMeHandler`

Field map (Postman body key → DB column):
| Postman key | DB column |
|-------------|-----------|
| `firstName` | `first_name` |
| `lastName` | `last_name` |
| `phoneNumber` | `phone` |
| `avatarUrl` | `profile_image_url` |
| `locale` | `locale` |
| `timezone` | `timezone` |

All fields are optional — only provided fields are updated. At least one must be present.

**SDK success response — 200 (flat, no envelope)**

Same `IUserDTO` shape as `GET /users/me`. The `avatarUrl` response field reflects the updated `profile_image_url` value — input and output use the same field name (`avatarUrl`).

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 401 | not authenticated |
| 422 | no updatable fields in body |
| 404 | user not found |

---

### 10 · GET `/workspaces/:id`

**Postman request headers**
```
Authorization: Bearer {{access_token}}
```

**Postman URL:** `{{base_url}}/workspaces/{{workspace_id}}`

**SDK route** — `packages/workspaces/src/routes.ts`
```
GET /workspaces/:id   →   workspaceContextMiddleware + getWorkspaceHandler
```

Workspace is resolved from the `:id` path parameter by `workspaceContextMiddleware`. The middleware also validates that `ctx.user` is an active member of the workspace.

**SDK success response — 200**
```json
{
  "workspace": {
    "id":          "uuid",
    "name":        "Acme Corp",
    "slug":        "acme-corp",
    "type":        "ORGANIZATION",
    "description": "...",
    "plan":        "free",
    "ownerId":     "uuid",
    "isArchived":  false,
    "archivedAt":  "",
    "createdAt":   "2024-01-01T00:00:00.000Z",
    "updatedAt":   "2024-01-01T00:00:00.000Z"
  }
}
```

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 404 | workspace not found |
| 403 | authenticated user is not a workspace member |

---

### 11 · PUT `/workspaces/:id`

**Postman request headers**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
X-WORKSPACE-ID: {{workspace_id}}
```

**Postman URL:** `{{base_url}}/workspaces/{{workspace_id}}`

**Postman request body**
```json
{
  "name":        "Updated Organization Name",
  "description": "Updated description"
}
```

**SDK route** — `packages/workspaces/src/routes.ts`
```
PUT /workspaces/:id   →   workspaceContextMiddleware + updateWorkspaceHandler
```

The `X-WORKSPACE-ID` header is redundant here — the workspace is resolved from the `:id` path param. The header is accepted but not required. (`workspaceContextMiddleware` checks path params first, then falls back to `x-workspace-id` header.)

Accepted fields:
| Field | Type | Notes |
|-------|------|-------|
| `name` | string | trimmed |
| `description` | string \| null | pass `null` to clear |

**SDK success response — 200**
```json
{
  "workspace": { ...IWorkspaceDTO }
}
```
Same `IWorkspaceDTO` shape as `GET /workspaces/:id`.

**SDK error responses**
| Status | Condition |
|--------|-----------|
| 404 | workspace not found on context |
| 404 | workspace deleted between context resolution and update |
| 403 | user is not a workspace member (raised by middleware) |

---

## Shared response shapes

### `IUserDTO`

Returned by: register (201), login (200), refresh (200), GET /users/me (200), PATCH /users/me (200).

```typescript
interface IUserDTO {
  id:              string   // UUID
  email:           string
  firstName:       string   // "" when null in DB
  lastName:        string   // "" when null in DB
  phone:           string   // "" when null in DB
  avatarUrl:       string   // "" when null in DB (maps from profile_image_url)
  locale:          string   // default "en-US"
  timezone:        string   // default "UTC"
  isEmailVerified: boolean  // true when email_verified_at IS NOT NULL
  mfaEnabled:      boolean
  suspended:       boolean
  createdAt:       string   // ISO 8601
  updatedAt:       string   // ISO 8601
}
```

### `IWorkspaceDTO`

Returned by: GET /workspaces/:id (200), PUT /workspaces/:id (200).

```typescript
interface IWorkspaceDTO {
  id:          string   // UUID
  name:        string
  slug:        string
  type:        string   // "ORGANIZATION" | "PERSONAL" | "TEAM" | "COMMUNITY" | "VENDOR"
  description: string   // "" when null in DB
  plan:        string   // "free" by default
  ownerId:     string   // UUID
  isArchived:  boolean  // derived from archivedAt !== null
  archivedAt:  string   // "" when not archived
  createdAt:   string   // ISO 8601
  updatedAt:   string   // ISO 8601
}
```

### Authentication cookies

All endpoints that issue tokens set two HttpOnly cookies in addition to the JSON body:

```
Set-Cookie: access_token=<jwt>; HttpOnly; SameSite=Strict; Path=/
Set-Cookie: refresh_token=<jwt>; HttpOnly; SameSite=Strict; Path=/auth/refresh
```

This dual-channel strategy makes the SDK work for both:
- **React Native (mobile)** — reads `accessToken` / `refreshToken` from JSON body, sends `refreshToken` in next request body
- **Web** — reads from HttpOnly cookies, which are sent automatically by the browser

### Error shape

All error responses use a flat JSON object:

```json
{ "error": "<human-readable message>" }
```

`setErrorResponse` (used by `meHandler` / `updateMeHandler`) adds a `code` field:

```json
{ "code": "UNAUTHORIZED", "message": "Unauthorized" }
```

---

## Directions endpoints (out of scope)

The Postman collection includes two directions endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /directions?origin=...&destination=...` | Route and turn-by-turn directions |
| `GET /directions/matrix?origin=...&destination=...` | Distance and duration matrix |

These are **not part of the Fonderie SDK**. They are served by a separate Google Maps proxy service. The SDK does not implement and is not expected to implement these routes.

---

## Postman variables

| Variable | Set by | Used in |
|----------|--------|---------|
| `base_url` | Collection default | All requests |
| `access_token` | Login / Register / Refresh response | Authorization header |
| `refresh_token` | Login / Register / Refresh response | Logout body, Refresh body |
| `workspace_id` | Manual / workspace creation | Workspace endpoints |
| `verification_token` | Registration email link | Verify Email body |

---

*All SDK handlers verified against collection version `v2.1.0`. No discrepancies found.*
