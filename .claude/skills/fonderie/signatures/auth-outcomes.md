<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/auth — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_account_deletion_codes`

```sql
user_id                  UUID PRIMARY KEY REFERENCES fonderie_users(id) ON DELETE CASCADE
code_hash                TEXT NOT NULL
channel                  TEXT NOT NULL CHECK (channel IN ('email', 'sms'))
attempts                 INT NOT NULL DEFAULT 0
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_account_erasures`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id                  UUID NOT NULL UNIQUE
email_hash               TEXT
phone_hash               TEXT
requested_at             TIMESTAMPTZ
reminded_at              TIMESTAMPTZ
erased_at                TIMESTAMPTZ NOT NULL DEFAULT now()
outcomes                 JSONB NOT NULL DEFAULT '[]'::jsonb
initiated_by             TEXT NOT NULL DEFAULT 'schedule'
-- INDEX idx_fonderie_account_erasures_erased_at (erased_at)
```

### `fonderie_consumed_tokens`

```sql
token_hash               TEXT PRIMARY KEY
expires_at               TIMESTAMPTZ NOT NULL
```

### `fonderie_email_verifications`

```sql
token                    TEXT PRIMARY KEY
user_id                  UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
PRIMARY                  KEY (user_id)
```

### `fonderie_login_events`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id                  UUID REFERENCES fonderie_users(id) ON DELETE CASCADE
email_attempted          TEXT
method                   TEXT NOT NULL
outcome                  TEXT NOT NULL
failure_reason           TEXT
ip_address               TEXT
user_agent               TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
location                 JSONB
```

### `fonderie_mfa_backup_codes`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id                  UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE
code_hash                TEXT NOT NULL
used_at                  TIMESTAMPTZ
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_mfa_challenges`

```sql
token                    TEXT PRIMARY KEY
user_id                  UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE
expires_at               TIMESTAMPTZ NOT NULL
used_at                  TIMESTAMPTZ
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- INDEX idx_fonderie_mfa_challenges_expires_at (expires_at)
```

### `fonderie_password_resets`

```sql
user_id                  UUID PRIMARY KEY REFERENCES fonderie_users(id) ON DELETE CASCADE
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
pin                      TEXT NOT NULL UNIQUE
token                    TEXT
-- INDEX idx_fonderie_password_resets_pin (pin)
```

### `fonderie_phone_verifications`

```sql
phone                    TEXT PRIMARY KEY
otp                      TEXT NOT NULL
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
user_id                  UUID REFERENCES fonderie_users(id) ON DELETE CASCADE
```

### `fonderie_sessions`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id                  UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE
token                    TEXT NOT NULL UNIQUE
user_agent               TEXT
ip_address               TEXT
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
sid                      UUID
location                 JSONB
previous_token_hash      TEXT
previous_valid_until     TIMESTAMPTZ
last_used_at             TIMESTAMPTZ
client_kind              TEXT
-- INDEX idx_fonderie_sessions_expires_at (expires_at)
-- INDEX idx_fonderie_sessions_sid (sid)
```

### `fonderie_users`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
email                    TEXT UNIQUE
password_hash            TEXT
first_name               TEXT
last_name                TEXT
phone                    TEXT
profile_image_url        TEXT
locale                   TEXT NOT NULL DEFAULT 'en-US'
timezone                 TEXT NOT NULL DEFAULT 'UTC'
provider                 TEXT
provider_id              TEXT
is_active                BOOLEAN NOT NULL DEFAULT true
last_login               TIMESTAMPTZ
preferences              JSONB NOT NULL DEFAULT '{"notifications":{"email":true
suspended                BOOLEAN NOT NULL DEFAULT false
whitelist                BOOLEAN NOT NULL DEFAULT false
ip_whitelist             JSONB NOT NULL DEFAULT '[]'
mfa_enabled              BOOLEAN NOT NULL DEFAULT false
mfa_secret               TEXT
email_verified_at        TIMESTAMPTZ
deleted_at               TIMESTAMPTZ
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
IF                       NOT EXISTS phone_verified_at TIMESTAMPTZ
CONSTRAINT               fonderie_users_phone_unique UNIQUE (phone)
mfa_secret_pending       TEXT
mfa_secret_pending_expires_at TIMESTAMPTZ
deletion_channel         TEXT
deletion_reminded_at     TIMESTAMPTZ
deletion_hold_at         TIMESTAMPTZ
deletion_hold_reason     TEXT
-- INDEX idx_fonderie_users_email (email)
```

Raw SQL ships in `node_modules/@fonderie/auth/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/_admin/erasures` | `async (ctx) => { const params = new URL(ctx.request.url).searchParams; const rawEmail = params.get('email')?.trim(); const rawPhone = params.get('phone')?.trim(); if (rawEmail || rawPhone) { const email = rawEmail ? normalizeEmailSafe(rawEmail) ?? rawEmail.toLowerCase() : null; const rows = await store.query<IErasureRow>( `SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures WHERE ($1::text IS NOT NULL AND email_hash = $1) OR ($2::text IS NOT NULL AND phone_hash = $2) ORDER BY erased_at DESC, id DESC LIMIT 50`, [erasureHash(config.jwtSecret, email), erasureHash(config.jwtSecret, rawPhone ?? null)], ); return setApiResponse(HTTP.OK, 'ERASURES', 'Erasures', { erasures: rows.map(toErasureDTO), nextCursor: null } satisfies IAdminErasurePageDTO); } const rawLimit = Number(params.get('limit') ?? 50); const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50; const cursorParam = params.get('cursor'); const cursor = cursorParam ? decodeKeysetCursor(cursorParam) : null; if (cursorParam && !cursor) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid cursor'); const rows = await store.query<IErasureRow>( `SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures WHERE $1::timestamptz IS NULL OR (erased_at, id) < ($1::timestamptz, $2::uuid) ORDER BY erased_at DESC, id DESC LIMIT $3`, [cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1], ); const more = rows.length > limit; const page = rows.slice(0, limit); const last = page[page.length - 1]; return setApiResponse(HTTP.OK, 'ERASURES', 'Erasures', { erasures: page.map(toErasureDTO), nextCursor: more && last ? encodeKeysetCursor(last.erasedAtRaw, last.id) : null, } satisfies IAdminErasurePageDTO); }` |
| GET | `/_admin/erasures/export` | `async () => { const CAP = 100_000; const rows = await store.query<IErasureRow>( `SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures ORDER BY erased_at, id LIMIT $1`, [CAP + 1], ); return setApiResponse(HTTP.OK, 'ERASURES_EXPORT', 'Erasure receipts', { generatedAt: new Date().toISOString(), truncated: rows.length > CAP, erasures: rows.slice(0, CAP).map(toErasureDTO), }); }` |
| GET | `/_admin/users` | `async (ctx) => { const params = new URL(ctx.request.url).searchParams; // Accounts are stored under normalizeEmail: a search for the address a // user typed ('Jane+work@x.com') finds the account ('jane@x.com'). const raw = params.get('email')?.trim(); const email = raw ? normalizeEmailSafe(raw) ?? raw.toLowerCase() : undefined; if (email) { const user = await users.findByEmail(email); return user ? setApiResponse(HTTP.OK, 'USER', 'User', await dto(user)) : NOT_FOUND(); } const rawLimit = Number(params.get('limit') ?? 50); const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50; const cursorParam = params.get('cursor'); const cursor = cursorParam ? decodeLoginCursor(cursorParam) : null; if (cursorParam && !cursor) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid cursor'); const deleted = params.get('deleted') === '1' || params.get('deleted') === 'true'; const page = await users.list({ limit, ...(cursor ? { cursor } : {}), ...(deleted ? { deleted } : {}), }); const body = toAdminUserPageDTO(page); if (config) { const facts = await factsOf(page.users); body.users = page.users.map((u) => toAdminUserDTO(u, { facts: facts.get(u.id), config })); } return setApiResponse(HTTP.OK, 'USERS', 'Users', body); }` |
| GET | `/_admin/users/:id` | `async (ctx) => { // Read-only view: a soft-deleted account resolves (deletedAt set), so // an operator arriving from billing sees what happened to it. const user = await users.findByIdIncludingDeleted(idOf(ctx)); return user ? setApiResponse(HTTP.OK, 'USER', 'User', await dto(user)) : NOT_FOUND(); }` |
| DELETE | `/_admin/users/:id/deletion` | `async (ctx) => { const r = await eraseAccountNow(store, config, idOf(ctx), bus); switch (r.status) { case 'erased': { const [receipt] = await store.query<IErasureRow>( `SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures WHERE user_id = $1`, [idOf(ctx)], ); return setApiResponse(HTTP.OK, 'ACCOUNT_ERASED', 'Account erased', receipt ? toErasureDTO(receipt) : null); } case 'not-pending': return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND(); case 'held': return setApiResponse(HTTP.CONFLICT, 'DELETION_HELD', 'This account is under a legal hold: lift it first.'); case 'busy': return setApiResponse(HTTP.CONFLICT, 'ERASURE_IN_PROGRESS', 'This account is being erased right now.'); case 'no-erasers': return setApiResponse( HTTP.CONFLICT, 'ERASERS_NOT_CONFIGURED', 'The app gives auth no erasers (accountDeletion.erasers): erasing now would leave every other brick’s data behind.', ); case 'failed': return setApiResponse( HTTP.BAD_GATEWAY, 'ERASURE_FAILED', `Erasure stopped at ${r.eraser}; the account stays archived. ${r.error}`, { eraser: r.eraser }, ); } }` |
| POST | `/_admin/users/:id/deletion/cancel` | `async (ctx) => { const [row] = await store.query<{ email: string | null; phone: string | null; locale: string | null; channel: string | null }>( `UPDATE fonderie_users u SET deleted_at = NULL, deletion_channel = NULL, deletion_reminded_at = NULL, deletion_hold_at = NULL, deletion_hold_reason = NULL, updated_at = now() FROM (SELECT id, deletion_channel FROM fonderie_users WHERE id = $1 FOR UPDATE) old WHERE u.id = old.id AND u.deleted_at IS NOT NULL RETURNING u.email, u.phone, u.locale, old.deletion_channel AS channel`, [idOf(ctx)], ); if (!row) return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND(); await background(bus?.emit(EVENT_KEYS.userRestored, { userId: idOf(ctx) })); const viaSms = row.channel === 'sms' || (!row.email && !!row.phone); const address = viaSms ? row.phone : row.email; if (address) { await background( bus?.emit(NOTIFICATION_EVENT, { type: MESSAGE_KEYS.accountRestored, ...(row.locale ? { locale: row.locale } : {}), data: {}, recipient: viaSms ? { email: null, phone: address, deviceToken: null } : { email: address, phone: null, deviceToken: null }, } satisfies ICourierMessage), ); } const user = await users.findById(idOf(ctx)); return user ? setApiResponse(HTTP.OK, 'ACCOUNT_RESTORED', 'Deletion cancelled; the account is active again', await dto(user)) : NOT_FOUND(); }` |
| DELETE | `/_admin/users/:id/deletion/hold` | `async (ctx) => { const [row] = await store.query<{ id: string }>( `UPDATE fonderie_users SET deletion_hold_at = NULL, deletion_hold_reason = NULL, updated_at = now() WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`, [idOf(ctx)], ); if (!row) return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND(); const user = await archived(ctx); return user ? setApiResponse(HTTP.OK, 'DELETION_HOLD_LIFTED', 'Hold lifted', await dto(user)) : NOT_FOUND(); }` |
| POST | `/_admin/users/:id/deletion/hold` | `validate(deletionHoldSchema) → async (ctx) => { const { reason } = ctx.meta['body'] as { reason: string }; const [row] = await store.query<{ id: string }>( `UPDATE fonderie_users SET deletion_hold_at = now(), deletion_hold_reason = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`, [idOf(ctx), reason], ); if (!row) return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND(); const user = await archived(ctx); return user ? setApiResponse(HTTP.OK, 'DELETION_HELD', 'Deletion held', await dto(user)) : NOT_FOUND(); }` |
| GET | `/_admin/users/:id/login-history` | `async (ctx) => { if (!(await users.findById(idOf(ctx)))) return NOT_FOUND(); const params = new URL(ctx.request.url).searchParams; const rawLimit = Number(params.get('limit') ?? 50); const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50; const cursorParam = params.get('cursor'); const cursor = cursorParam ? decodeLoginCursor(cursorParam) : null; if (cursorParam && !cursor) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid cursor'); const page = await events.listByUser({ userId: idOf(ctx), limit, ...(cursor ? { cursor } : {}), }); return setApiResponse( HTTP.OK, 'LOGIN_HISTORY', 'Login history', toLoginHistoryPageDTO(page), ); }` |
| DELETE | `/_admin/users/:id/sessions` | `async (ctx) => { if (!(await users.findById(idOf(ctx)))) return NOT_FOUND(); await sessions.deleteByUser(idOf(ctx)); await background(bus?.emit(EVENT_KEYS.sessionRevoked, { userId: idOf(ctx), sids: null, reason: 'admin' } satisfies ISessionRevokedEvent)); return setApiResponse(HTTP.OK, 'SESSIONS_REVOKED', 'All sessions revoked'); }` |
| GET | `/_admin/users/:id/sessions` | `async (ctx) => { if (!(await users.findById(idOf(ctx)))) return NOT_FOUND(); const rows = await sessions.listLiveByUser(idOf(ctx)); return setApiResponse( HTTP.OK, 'SESSIONS', 'Live sessions', rows.map((r) => toSessionDTO(r, null)), ); }` |
| POST | `/_admin/users/:id/suspend` | `setSuspended(true)` |
| POST | `/_admin/users/:id/unsuspend` | `setSuspended(false)` |
| POST | `/auth/account/restore` | `ipLimit('login') → validate(restoreAccountSchema) → auth.restoreAccount` |
| GET | `/auth/apple` | `oauth.appleInit` |
| POST | `/auth/apple/callback` | `ipLimit('login') → oauth.appleCallback` |
| POST | `/auth/apple/native` | `ipLimit('login') → validate(appleNativeSchema) → oauth.appleNative` |
| POST | `/auth/email/forgot` | `ipLimit('forgot') → validate(forgotPasswordSchema) → acctLimit('forgot') → auth.forgotPassword` |
| POST | `/auth/email/reset` | `ipLimit('reset') → validate(resetPasswordSchema) → auth.resetPassword` |
| GET | `/auth/google` | `oauth.googleInit` |
| GET | `/auth/google/callback` | `ipLimit('login') → oauth.googleCallback` |
| POST | `/auth/google/native` | `ipLimit('login') → validate(googleNativeSchema) → oauth.googleNative` |
| POST | `/auth/login` | `ipLimit('login') → validate(loginSchema) → acctLimit('login') → auth.login` |
| GET | `/auth/login-history` | `requireAuth → user.loginHistory` |
| POST | `/auth/logout` | `requireAuth → validate(refreshSchema) → auth.logout` |
| POST | `/auth/mfa/backup-codes` | `requireAuth → requireEmailLogin → requireVerified → validate(mfaTokenSchema) → mfa.regenerateBackupCodes` |
| POST | `/auth/mfa/disable` | `requireAuth → requireEmailLogin → requireVerified → validate(mfaTokenSchema) → mfa.disable` |
| POST | `/auth/mfa/setup` | `requireAuth → requireEmailLogin → requireVerified → mfa.setup` |
| POST | `/auth/mfa/verify` | `ipLimit('mfaVerify') → requireAnyAuth → requireEmailLoginUnlessSigningIn → requireVerified → validate(mfaTokenSchema) → mfa.verify` |
| DELETE | `/auth/oauth/:provider` | `requireAuth → user.unlinkOauth` |
| GET | `/auth/providers` | `async () => setApiResponse(HTTP.OK, 'AUTH_PROVIDERS', 'Sign-in methods available here', { providers: [...config.providers], })` |
| POST | `/auth/refresh` | `validate(refreshSchema) → auth.refresh` |
| POST | `/auth/register` | `ipLimit('register') → validate(registerSchema) → auth.register` |
| GET | `/auth/send-verification` | `requireAnyAuth → auth.sendVerification` |
| GET | `/auth/sessions` | `requireAuth → user.listSessions` |
| DELETE | `/auth/sessions/:id` | `requireAuth → user.terminateSession` |
| DELETE | `/auth/sessions/others` | `requireAuth → user.terminateOtherSessions` |
| POST | `/auth/verify` | `ipLimit('verify') → requireAnyAuth → validate(verifySchema) → auth.verify` |
| DELETE | `/users` | `requireAuth → verifyGate → user.deleteMe` |
| GET | `/users` | `requireAuth → user.me` |
| PUT | `/users/email` | `requireAuth → verifyGate → validate(updateEmailSchema) → user.updateEmail` |
| GET | `/users/export` | `requireAuth → user.exportMe` |
| POST | `/users/me/deletion` | `requireAuth → verifyGate → validate(requestDeletionSchema) → user.requestDeletion` |
| POST | `/users/me/deletion/confirm` | `ipLimit('verify') → requireAuth → verifyGate → validate(confirmDeletionSchema) → user.confirmDeletion` |
| PUT | `/users/password` | `requireAuth → validate(changePasswordSchema) → user.changePassword` |
| PUT | `/users/phone` | `requireAuth → verifyGate → validate(updatePhoneSchema) → user.updatePhone` |
| PUT | `/users/preferences` | `requireAuth → verifyGate → validate(updatePreferencesSchema) → user.updatePreferences` |
| PUT | `/users/profile` | `requireAuth → verifyGate → validate(updateProfileSchema) → user.updateProfile` |
