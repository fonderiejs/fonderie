<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/auth — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_email_verifications`

```sql
token                    TEXT PRIMARY KEY
user_id                  UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE
expires_at               TIMESTAMPTZ NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
PRIMARY                  KEY (user_id)
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
-- INDEX idx_fonderie_sessions_expires_at (expires_at)
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
-- INDEX idx_fonderie_users_email (email)
```

Raw SQL ships in `node_modules/@fonderie/auth/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| POST | `/auth/email/forgot` | `ipLimit('forgot') → validate(forgotPasswordSchema) → acctLimit('forgot') → auth.forgotPassword` |
| POST | `/auth/email/reset` | `validate(resetPasswordSchema) → auth.resetPassword` |
| GET | `/auth/google` | `oauth.googleInit` |
| GET | `/auth/google/callback` | `oauth.googleCallback` |
| POST | `/auth/login` | `ipLimit('login') → validate(loginSchema) → acctLimit('login') → auth.login` |
| POST | `/auth/logout` | `requireAuth → validate(refreshSchema) → auth.logout` |
| POST | `/auth/mfa/backup-codes` | `requireAuth → requireEmailLogin → requireVerified → validate(mfaTokenSchema) → mfa.regenerateBackupCodes` |
| POST | `/auth/mfa/disable` | `requireAuth → requireEmailLogin → requireVerified → validate(mfaTokenSchema) → mfa.disable` |
| POST | `/auth/mfa/setup` | `requireAuth → requireEmailLogin → requireVerified → mfa.setup` |
| POST | `/auth/mfa/verify` | `ipLimit('mfaVerify') → requireAnyAuth → requireEmailLogin → requireVerified → validate(mfaTokenSchema) → mfa.verify` |
| POST | `/auth/refresh` | `validate(refreshSchema) → auth.refresh` |
| POST | `/auth/register` | `ipLimit('register') → validate(registerSchema) → auth.register` |
| GET | `/auth/send-verification` | `requireAuth → auth.sendVerification` |
| POST | `/auth/verify` | `requireAuth → validate(verifySchema) → auth.verify` |
| DELETE | `/users` | `requireAuth → verifyGate → user.deleteMe` |
| GET | `/users` | `requireAuth → user.me` |
| PUT | `/users/email` | `requireAuth → verifyGate → validate(updateEmailSchema) → user.updateEmail` |
| PUT | `/users/password` | `requireAuth → validate(changePasswordSchema) → user.changePassword` |
| PUT | `/users/phone` | `requireAuth → verifyGate → validate(updatePhoneSchema) → user.updatePhone` |
| PUT | `/users/preferences` | `requireAuth → verifyGate → validate(updatePreferencesSchema) → user.updatePreferences` |
| PUT | `/users/profile` | `requireAuth → verifyGate → validate(updateProfileSchema) → user.updateProfile` |
