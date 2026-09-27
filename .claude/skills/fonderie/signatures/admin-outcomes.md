<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/admin — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_admin_invites`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
kind                     TEXT NOT NULL
token_hash               TEXT NOT NULL UNIQUE
email                    TEXT NOT NULL
scopes                   TEXT[] NOT NULL DEFAULT '{}'
operator_id              UUID REFERENCES fonderie_admin_operators(id) ON DELETE CASCADE
created_by               TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at               TIMESTAMPTZ NOT NULL
used_at                  TIMESTAMPTZ
```

### `fonderie_admin_log`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
at                       TIMESTAMPTZ NOT NULL DEFAULT now()
actor                    TEXT NOT NULL
method                   TEXT NOT NULL
path                     TEXT NOT NULL
route                    TEXT NOT NULL
module                   TEXT NOT NULL
status                   INTEGER NOT NULL
duration_ms              INTEGER NOT NULL
request_id               TEXT
client_ip                TEXT
```

### `fonderie_admin_operators`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
email                    TEXT NOT NULL UNIQUE
name                     TEXT
password_hash            TEXT NOT NULL
scopes                   TEXT[] NOT NULL
totp_secret              TEXT
totp_confirmed_at        TIMESTAMPTZ
totp_last_step           BIGINT
backup_codes             TEXT[] NOT NULL DEFAULT '{}'
failed_attempts          INTEGER NOT NULL DEFAULT 0
locked_until             TIMESTAMPTZ
created_by               TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
last_login_at            TIMESTAMPTZ
disabled_at              TIMESTAMPTZ
```

### `fonderie_admin_sessions`

```sql
id_hash                  TEXT PRIMARY KEY
operator_id              UUID NOT NULL REFERENCES fonderie_admin_operators(id) ON DELETE CASCADE
stage                    TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
last_seen_at             TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at               TIMESTAMPTZ NOT NULL
step_up_at               TIMESTAMPTZ
client_ip                TEXT
user_agent               TEXT
-- INDEX fonderie_admin_sessions_operator (operator_id)
```

### `fonderie_admin_tokens`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                     TEXT NOT NULL
token_hash               TEXT NOT NULL UNIQUE
scopes                   TEXT[] NOT NULL
created_by               TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at               TIMESTAMPTZ
revoked_at               TIMESTAMPTZ
last_used_at             TIMESTAMPTZ
```

Raw SQL ships in `node_modules/@fonderie/admin/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/_admin` | `async () => setApiResponse( HTTP.OK, 'ADMIN_ATTENTION', 'What needs attention', attention(app, await doctor()), )` |
| GET | `/_admin/access/operators` | `[async () => setApiResponse(HTTP.OK, 'OPERATORS', 'Operators', await listOperators(store))] → 'read'` |
| PUT | `/_admin/access/operators/:id` | `[ validate(updateOperatorSchema), async (ctx) => { const b = body(ctx); const op = await findOperator(store, { id: idOf(ctx) }); if (!op) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such operator'); const scopes = b['scopes'] === undefined ? op.scopes : validScopes(b['scopes']); if (!scopes) return setApiResponse( HTTP.UNPROCESSABLE, 'INVALID', `scopes must be a non-empty list of ${SCOPES.join(', ')}`, ); if ( ctx.meta['adminOperator'] === op.email && !scopes.includes('secrets') && op.scopes.includes('secrets') ) { return setApiResponse( HTTP.CONFLICT, 'SELF_DEMOTION', 'You cannot remove your own highest scope. Ask another operator.', ); } const disabled = b['disabled']; if (disabled === true && ctx.meta['adminOperator'] === op.email) { return setApiResponse( HTTP.CONFLICT, 'SELF_DISABLE', 'You cannot disable yourself. Ask another operator.', ); } const [row] = await store.query<IOperatorRow>( `UPDATE fonderie_admin_operators SET scopes = $2, name = coalesce($3, name), disabled_at = CASE WHEN $4::boolean IS NULL THEN disabled_at WHEN $4 THEN coalesce(disabled_at, now()) ELSE NULL END WHERE id = $1 RETURNING id, email, name, password_hash AS "passwordHash", scopes, totp_secret AS "totpSecret", totp_confirmed_at AS "totpConfirmedAt", totp_last_step AS "totpLastStep", backup_codes AS "backupCodes", failed_attempts AS "failedAttempts", locked_until AS "lockedUntil", created_by AS "createdBy", created_at AS "createdAt", last_login_at AS "lastLoginAt", disabled_at AS "disabledAt"`, [ op.id, scopes, typeof b['name'] === 'string' ? b['name'] : null, typeof disabled === 'boolean' ? disabled : null, ], ); if (!row) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such operator'); // Any change of rights ends their sessions: new rights apply at next sign-in. await deleteOperatorSessions(store, op.id); return setApiResponse( HTTP.OK, 'OPERATOR_UPDATED', 'Operator updated', publicOperator(row), ); }, ] → 'root'` |
| POST | `/_admin/access/operators/:id/recovery` | `[ async (ctx) => { const op = await findOperator(store, { id: idOf(ctx) }); if (!op) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such operator'); await deleteOperatorSessions(store, op.id); const l = await createLink(store, { kind: 'recovery', email: op.email, operatorId: op.id, createdBy: actorOf(ctx), hours: RECOVERY_HOURS, }); return setApiResponse(HTTP.CREATED, 'RECOVERY_CREATED', 'Recovery link — shown once', { id: l.id, email: op.email, expiresAt: l.expiresAt, token: l.token, url: link(ctx, l.token), }); }, ] → 'root'` |
| POST | `/_admin/access/operators/invites` | `[ validate(inviteSchema), async (ctx) => { const b = body(ctx); const email = normalizeEmail(str(b['email'])); if (!EMAIL_RE.test(email)) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'Enter a valid email address.'); const scopes = validScopes(b['scopes']); if (!scopes) return setApiResponse( HTTP.UNPROCESSABLE, 'INVALID', `scopes must be a non-empty list of ${SCOPES.join(', ')}`, ); if (await findOperator(store, { email })) return setApiResponse( HTTP.CONFLICT, 'ALREADY_OPERATOR', 'That email is already an operator.', ); const hours = Number.isInteger(b['expiresInHours']) ? Math.min(Math.max(b['expiresInHours'] as number, 1), 336) : INVITE_HOURS; const l = await createLink(store, { kind: 'invite', email, scopes, createdBy: actorOf(ctx), hours, }); return setApiResponse(HTTP.CREATED, 'INVITE_CREATED', 'Invite link — shown once', { id: l.id, email, scopes, expiresAt: l.expiresAt, token: l.token, url: link(ctx, l.token), }); }, ] → 'root'` |
| DELETE | `/_admin/access/operators/links/:id` | `[ async (ctx) => { const rows = await store.query( `UPDATE fonderie_admin_invites SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id`, [idOf(ctx)], ); return rows.length ? setApiResponse(HTTP.OK, 'LINK_REVOKED', 'Link revoked') : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such live link'); }, ] → 'root'` |
| GET | `/_admin/access/tokens` | `async () => setApiResponse( HTTP.OK, 'ADMIN_TOKENS', 'Admin tokens', tokensReport(app, this.name, store ? await listTokens(store) : null), )` |
| POST | `/_admin/access/tokens` | `[ validate(issueTokenSchema), async (ctx) => { const body = ctx.meta['body'] as { name: string; scopes: AdminScope[]; expiresInDays?: number; }; const createdBy = ctx.request.headers.get('x-actor') || 'admin-token'; const { token: plaintext, record } = await issueToken(store, { ...body, createdBy, }); // The plaintext is returned once and never stored. return setApiResponse(HTTP.CREATED, 'TOKEN_ISSUED', 'Token issued — shown once', { token: plaintext, ...record, }); }, ]` |
| DELETE | `/_admin/access/tokens/:id` | `[ async (ctx) => { const ok = await revokeToken(store, ctx.meta.params?.['id'] ?? ''); return ok ? setApiResponse(HTTP.OK, 'TOKEN_REVOKED', 'Token revoked') : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such live token'); }, ]` |
| GET | `/_admin/activity/admin-log` | `async (ctx) => { const q = new URL(ctx.request.url).searchParams; const limit = Number(q.get('limit')) || undefined; const before = q.get('before') ?? undefined; const page = await readAdminLog(store, { ...(limit ? { limit } : {}), ...(before ? { before } : {}), }); return setApiResponse(HTTP.OK, 'ADMIN_LOG', 'Admin activity', page); }` |
| GET | `/_admin/doctor` | `async () => setApiResponse(HTTP.OK, 'ADMIN_DOCTOR', 'Reconciliation checks', await doctor())` |
| GET | `/_admin/environment` | `async () => setApiResponse( HTTP.OK, 'ADMIN_ENVIRONMENT', 'Declared vs held', environmentReport(app, this.options.env ?? []), )` |
| GET | `/_admin/manifest` | `async () => setApiResponse( HTTP.OK, 'ADMIN_MANIFEST', 'Deployment manifest', buildManifest(app, { version: this.version, log: Boolean(store), host: this.hosts }), )` |
| GET | `/_admin/migrations` | `[ async () => setApiResponse( HTTP.OK, 'MIGRATIONS', 'Pending migrations by module', await migrationsReport(store, migrationSets), ), ]` |
| POST | `/_admin/migrations/:module/apply` | `[ validate(applyMigrationsSchema), async (ctx) => { const { expect } = ctx.meta['body'] as { expect: string[] }; const name = ctx.meta.params?.['module'] ?? ''; const out = await applyModuleMigrations(store, migrationSets, name, expect); if (out.ok) { return setApiResponse( HTTP.OK, out.reason, out.reason === 'MIGRATIONS_APPLIED' ? `Applied. ${out.module.pending.length} still pending in ${name}.` : `${name} is already up to date`, out.module, ); } switch (out.reason) { case 'NOT_FOUND': return setApiResponse( HTTP.NOT_FOUND, 'NOT_FOUND', `No migration set named "${name}"`, ); case 'MIGRATIONS_OUT_OF_ORDER': return setApiResponse( HTTP.CONFLICT, out.reason, `Apply "${out.blockedBy}" first — it runs before "${name}" and is behind.`, { blockedBy: out.blockedBy }, ); case 'MIGRATIONS_CHANGED': return setApiResponse( HTTP.CONFLICT, out.reason, 'What is pending changed since you looked. Refresh and read it again.', { expected: out.expected, actual: out.actual }, ); default: return setApiResponse( HTTP.UNPROCESSABLE, out.reason, 'A pending migration deletes data. No down-migration brings it back — ' + 'apply it through CI or `npm run migrate`, not from here.', { files: out.files }, ); } }, ]` |
| GET | `/_admin/routes` | `async () => setApiResponse(HTTP.OK, 'ADMIN_ROUTES', 'Exposed routes', routesReport(app, this.name))` |
| DELETE | `/_admin/session` | `[ check, async (ctx) => { const cookie = readCookie(ctx); if (cookie) await deleteSession(store, cookie); return clearCookie(setApiResponse(HTTP.OK, 'SIGNED_OUT', 'Signed out'), ctx); }, ]` |
| GET | `/_admin/session` | `[ check, async (ctx) => { const found = await readSession(store, readCookie(ctx)); const claimable = (await operatorCount(store)) === 0; return setApiResponse(HTTP.OK, 'ADMIN_SESSION', 'Session', { state: found ? stateOf(found.session.stage) : 'signed-out', operator: found ? publicOperator(found.op) : null, claimable, stepUpFresh: found ? stepUpFresh(found.session) : false, }); }, ]` |
| POST | `/_admin/session/claim` | `[ check, validate(claimSchema), async (ctx) => { if (!constantTimeEqual(bearer(ctx), deps.rootToken)) { return setApiResponse( HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Claiming needs the root admin token.', ); } const b = body(ctx); const email = normalizeEmail(str(b['email'])); if (!EMAIL_RE.test(email)) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'Enter a valid email address.'); const problem = passwordProblem(b['password']); if (problem) return setApiResponse(HTTP.UNPROCESSABLE, 'WEAK_PASSWORD', problem); const op = await claimFirstOperator(store, { email, name: str(b['name']) || undefined, password: str(b['password']), }); if (!op) return setApiResponse( HTTP.CONFLICT, 'ALREADY_CLAIMED', 'This console already has operators. Ask one for an invite.', ); return startSession(deps, ctx, op, 'enroll'); }, ]` |
| GET | `/_admin/session/enrollment` | `[ check, async (ctx) => { const s = await sessionAt(deps, ctx, 'enroll'); if (!s) return WRONG_STAGE(); const secret = await enrollmentSecret(store, box, s.op); const issuer = `Admin · ${new URL(ctx.request.url).hostname}`; const res = setApiResponse(HTTP.OK, 'ENROLLMENT', 'Scan this with an authenticator app', { secret, uri: totpUri(issuer, s.op.email, secret), account: s.op.email, issuer, }); res.headers.set('cache-control', 'no-store'); return res; }, ]` |
| POST | `/_admin/session/enrollment` | `[ check, validate(enrollmentSchema), async (ctx) => { const s = await sessionAt(deps, ctx, 'enroll'); if (!s) return WRONG_STAGE(); const codes = await confirmEnrollment(store, box, s.op, str(body(ctx)['code'])); if (!codes) { const fresh = await findOperator(store, { id: s.op.id }); return fresh && lockMinutes(fresh) ? LOCKED(fresh) : BAD_CODE(); } // A new session id at the privilege change: a pending id that leaked // never becomes a signed-in one. await deleteSession(store, s.cookie); const op = (await findOperator(store, { id: s.op.id })) ?? s.op; return startSession(deps, ctx, op, 'active', { backupCodes: codes }); }, ]` |
| POST | `/_admin/session/link` | `[ check, validate(redeemLinkSchema), async (ctx) => { const b = body(ctx); const problem = passwordProblem(b['password']); if (problem) return setApiResponse(HTTP.UNPROCESSABLE, 'WEAK_PASSWORD', problem); const r = await redeemLink(store, str(b['token']), { password: str(b['password']), name: str(b['name']) || undefined, }); if ('error' in r) { return r.error === 'ALREADY_OPERATOR' ? setApiResponse( HTTP.CONFLICT, 'ALREADY_OPERATOR', 'That email is already an operator. Sign in instead.', ) : setApiResponse( HTTP.NOT_FOUND, 'INVALID_LINK', 'This link has expired or was already used. Ask for a new one.', ); } return startSession(deps, ctx, r.op, 'enroll'); }, ]` |
| POST | `/_admin/session/link/inspect` | `[ check, validate(inspectLinkSchema), async (ctx) => { const link = await findLink(store, str(body(ctx)['token'])); return link ? setApiResponse(HTTP.OK, 'LINK', 'Link', { kind: link.kind, email: link.email }) : setApiResponse( HTTP.NOT_FOUND, 'INVALID_LINK', 'This link has expired or was already used. Ask for a new one.', ); }, ]` |
| POST | `/_admin/session/login` | `[ check, validate(loginSchema), async (ctx) => { const b = body(ctx); const result = await checkPassword(store, str(b['email']), str(b['password'])); if (result.op && 'locked' in result && result.locked) return LOCKED(result.op); if (!result.ok || !result.op) return BAD_CREDENTIALS(); return startSession( deps, ctx, result.op, result.op.totpConfirmedAt ? 'password' : 'enroll', ); }, ]` |
| POST | `/_admin/session/step-up` | `[ check, validate(factorSchema), async (ctx) => { const s = await sessionAt(deps, ctx, 'active'); if (!s) return WRONG_STAGE(); const b = body(ctx); const r = await checkSecondFactor(store, box, s.op, { code: b['code'], backupCode: b['backupCode'], }); if (!r.ok) return BAD_CODE(); await markStepUp(store, s.session.idHash); return setApiResponse(HTTP.OK, 'STEPPED_UP', 'Confirmed for five minutes', { stepUpFresh: true, ...(r.via === 'backup' ? { backupCodesLeft: r.backupLeft } : {}), }); }, ]` |
| POST | `/_admin/session/verify` | `[ check, validate(factorSchema), async (ctx) => { const s = await sessionAt(deps, ctx, 'password'); if (!s) return WRONG_STAGE(); const b = body(ctx); const r = await checkSecondFactor(store, box, s.op, { code: b['code'], backupCode: b['backupCode'], }); if (!r.ok) { const fresh = await findOperator(store, { id: s.op.id }); return fresh && lockMinutes(fresh) ? LOCKED(fresh) : BAD_CODE(); } await deleteSession(store, s.cookie); await store.query( `UPDATE fonderie_admin_operators SET last_login_at = now() WHERE id = $1`, [s.op.id], ); return startSession( deps, ctx, s.op, 'active', r.via === 'backup' ? { backupCodesLeft: r.backupLeft } : {}, ); }, ]` |
