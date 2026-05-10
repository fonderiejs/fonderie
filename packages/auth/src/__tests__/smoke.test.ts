import { test } from 'node:test';
import assert   from 'node:assert/strict';

import type { IStoreAdapter }         from '@fonderie-js/store';
import type { IAuthConfig }           from '../config';
import type { IUser }                 from '../types';
import { issueTokenPair, verifyToken } from '../services/jwt';
import { generateTotpSecret }         from '../services/mfa';
import { hashPassword, verifyPassword } from '../services/password';
import { authController } from '../controllers/auth.controller';
import { userController } from '../controllers/user.controller';

const config: IAuthConfig = {
	jwtSecret:       'test-secret-min-32-chars-long-here',
	sessionDuration: '7d',
	providers:       ['email'],
}

// ── password ────────────────────────────────────────────────────

test('password: hash and verify round-trip', async () => {
	const hash = await hashPassword('correct-horse');
	assert.ok(await verifyPassword('correct-horse', hash));
	assert.ok(!await verifyPassword('wrong-horse', hash));
});

test('password: different passwords produce different hashes', async () => {
	const a = await hashPassword('password1');
	const b = await hashPassword('password1');
	assert.notEqual(a, b);
});

// ── jwt ─────────────────────────────────────────────────────────

test('jwt: access token round-trip', () => {
	const { accessToken } = issueTokenPair('user-123', config, { loginMethod: 'email' });
	const payload         = verifyToken(accessToken, config);
	assert.ok(payload);
	assert.equal(payload?.sub,  'user-123');
	assert.equal(payload?.type, 'access');
});

test('jwt: refresh token round-trip', () => {
	const { refreshToken } = issueTokenPair('user-456', config, { loginMethod: 'email' });
	const payload          = verifyToken(refreshToken, config);
	assert.ok(payload);
	assert.equal(payload?.sub,  'user-456');
	assert.equal(payload?.type, 'refresh');
});

test('jwt: tampered token is rejected', () => {
	const { accessToken } = issueTokenPair('user-789', config, { loginMethod: 'email' });
	const tampered        = accessToken.slice(0, -4) + 'xxxx';
	const payload         = verifyToken(tampered, config);
	assert.equal(payload, null);
});

test('jwt: token signed with wrong secret is rejected', () => {
	const other   = issueTokenPair('user-000', { ...config, jwtSecret: 'other-secret-min-32-chars-long!!' }, { loginMethod: 'email' });
	const payload = verifyToken(other.accessToken, config);
	assert.equal(payload, null);
});

// ── mfa ─────────────────────────────────────────────────────────

test('mfa: generated secret is a non-empty string', () => {
	const secret = generateTotpSecret();
	assert.ok(typeof secret === 'string' && secret.length > 0);
});

// ── AuthModule shape ─────────────────────────────────────────────

test('AuthModule: satisfies IFonderieModule interface', async () => {
	const { AuthModule } = await import('../module');

	const stub: IStoreAdapter = {
		query:       async () => [],
		transaction: async (fn) => fn(stub),
	};

	const module = new AuthModule(stub, config);

	assert.equal(module.name, '@fonderie-js/auth');
	assert.ok(typeof module.install === 'function');
});

// ── Fixtures and helpers ─────────────────────────────────────────

const HASHED_PW = await hashPassword('password123');

const BASE_USER: IUser = {
	id:              'user-1',
	email:           'jane@example.com',
	firstName:       'Jane',
	lastName:        'Doe',
	phone:           '+1234567890',
	profileImageUrl: 'https://cdn.example.com/avatar.jpg',
	locale:          'en-US',
	timezone:        'UTC',
	isActive:        true,
	lastLogin:       null,
	skills:          [],
	preferences:     {
		locale:        'en-US',
		timezone:      'UTC',
		notifications: { email: true, inApp: true, sms: false, push: false },
		emailDigest:   'immediate',
		dateFormat:    'MM/DD/YYYY',
		timeFormat:    'hh:mm A',
	},
	suspended:       false,
	whitelist:       false,
	ipWhitelist:     [],
	deletedAt:       null,
	createdAt:       new Date('2024-01-01T00:00:00Z'),
	updatedAt:       new Date('2024-01-01T00:00:00Z'),
	mfaEnabled:      false,
	passwordHash:    null,
	emailVerifiedAt: new Date('2024-01-02T00:00:00Z'),
	phoneVerifiedAt: null,
};

const { refreshToken: VALID_RT } = issueTokenPair('user-1', config, { loginMethod: 'email' });

const PHONE_USER: IUser = {
	...BASE_USER,
	id:              'user-2',
	email:           null,
	passwordHash:    null,
	phone:           '+15141234567',
	emailVerifiedAt: null,
	phoneVerifiedAt: null,
}

type AuthStoreOpts = {
	userByEmail?:   IUser | null
	userByPhone?:   IUser | null
	userById?:      IUser | null
	insertedId?:    string
	sessionExists?: boolean
	resetRow?:      { user_id: string; expires_at: Date } | null
	verifyRow?:     { expires_at: Date } | null
	updateRow?:     { id: string } | null
}

function makeStore(opts: AuthStoreOpts = {}): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_users') && sql.includes('WHERE email = $1'))
				return (opts.userByEmail != null ? [opts.userByEmail] : []) as unknown as T[]

			if (sql.includes('fonderie_users') && sql.includes('WHERE phone = $1'))
				return (opts.userByPhone != null ? [opts.userByPhone] : []) as unknown as T[]

			if (sql.includes('fonderie_users') && sql.includes('WHERE id = $1') && sql.includes('deleted_at IS NULL'))
				return (opts.userById != null ? [opts.userById] : []) as unknown as T[]

			if (sql.includes('INSERT INTO fonderie_users'))
				return (opts.insertedId ? [{ id: opts.insertedId }] : []) as unknown as T[]

			if (sql.includes('fonderie_sessions') && sql.includes('SELECT id'))
				return (opts.sessionExists ? [{ id: 'sess-1' }] : []) as unknown as T[]

			if (sql.includes('fonderie_password_resets') && sql.includes('SELECT user_id'))
				return (opts.resetRow != null ? [opts.resetRow] : []) as unknown as T[]

			if (sql.includes('fonderie_email_verifications') && sql.includes('WHERE user_id'))
				return (opts.verifyRow != null ? [opts.verifyRow] : []) as unknown as T[]

			if (sql.includes('UPDATE fonderie_users') && sql.includes('RETURNING id'))
				return (opts.updateRow != null ? [opts.updateRow] : []) as unknown as T[]

			return [] as unknown as T[]
		},
		transaction: async (fn) => fn(stub),
	}
	return stub
}

function makeCtx(opts: {
	user?:      { id: string; email: string | null; loginMethod?: 'email' | 'phone'; phoneVerified?: boolean; [key: string]: unknown } | null
	body?:      Record<string, unknown>
	workspace?: { id: string } | null
	cookie?:    string
} = {}): any {
	return {
		user:      'user'      in opts ? opts.user      : null,
		workspace: 'workspace' in opts ? opts.workspace : null,
		tenant:    null,
		meta:      { body: opts.body ?? {} },
		request:   new Request('http://localhost/', {
			headers: opts.cookie ? { cookie: opts.cookie } : {},
		}),
	}
}

function makeAuth(storeOpts: AuthStoreOpts = {}) {
	return authController(makeStore(storeOpts), config)
}

function makeUser(storeOpts: AuthStoreOpts = {}) {
	return userController(makeStore(storeOpts))
}

// ── toUserDTO ─────────────────────────────────────────────────────

test('toUserDTO: maps all fields correctly', async () => {
	const { toUserDTO } = await import('../dtos/user');
	const dto = toUserDTO(BASE_USER);

	assert.equal(dto.profileImageUrl,  'https://cdn.example.com/avatar.jpg');
	assert.equal(dto.phone,           '+1234567890');
	assert.equal(dto.isEmailVerified, true);
	assert.equal(dto.firstName,       'Jane');
	assert.equal(dto.lastName,        'Doe');
	assert.equal(dto.mfaEnabled,      false);
	assert.equal(dto.isActive,        true);
	assert.equal(dto.lastLogin,       '');
	assert.deepEqual(dto.skills,      []);
	assert.equal(dto.suspended,       false);
	assert.equal(dto.whitelist,       false);
	assert.deepEqual(dto.ipWhitelist, []);
	assert.equal(dto.preferences.locale,                   'en-US');
	assert.equal(dto.preferences.timezone,                 'UTC');
	assert.equal(dto.preferences.emailDigest,              'immediate');
	assert.equal(dto.preferences.notifications.email,      true);
	assert.equal(dto.preferences.notifications.sms,        false);
});

test('toUserDTO: skills and ipWhitelist are passed through', async () => {
	const { toUserDTO } = await import('../dtos/user');
	const user = {
		...BASE_USER,
		skills:      [{ id: 'skill-1', name: 'plumbing', proficiency: 5, verified: true }],
		ipWhitelist: ['192.168.1.1'],
		lastLogin:   new Date('2024-06-01T12:00:00Z'),
	};
	const dto = toUserDTO(user);
	assert.equal(dto.skills.length,   1);
	assert.equal(dto.skills[0]!.name, 'plumbing');
	assert.equal(dto.ipWhitelist[0],  '192.168.1.1');
	assert.ok(dto.lastLogin.startsWith('2024-06-01'));
});

test('toUserDTO: falls back to defaults when preferences is null', async () => {
	const { toUserDTO } = await import('../dtos/user');
	const dto = toUserDTO({ ...BASE_USER, preferences: null as any });
	assert.equal(dto.preferences.emailDigest,         'immediate');
	assert.equal(dto.preferences.notifications.email, true);
});

// ── requireAuth middleware ────────────────────────────────────────

test('requireAuth: returns 401 when ctx.user is null', async () => {
	const { requireAuth } = await import('../middlewares/require-auth');
	const ctx      = makeCtx({ user: null });
	const response = await requireAuth(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 401);
});

test('requireAuth: calls next when ctx.user is set', async () => {
	const { requireAuth } = await import('../middlewares/require-auth');
	const ctx      = makeCtx({ user: { id: 'user-1', email: 'a@b.com' } });
	let   called   = false;
	await requireAuth(ctx, async () => { called = true; return Response.json({}); });
	assert.ok(called);
});

// ── requireVerified middleware ────────────────────────────────────

test('requireVerified: passes email user with verified email', async () => {
	const { requireVerified } = await import('@fonderie-js/core/middlewares');
	const ctx    = makeCtx({ user: { ...BASE_USER, loginMethod: 'email', phoneVerified: false } });
	let   called = false;
	await requireVerified(ctx, async () => { called = true; return Response.json({}); });
	assert.ok(called);
});

test('requireVerified: 403 EMAIL_NOT_VERIFIED when email user has unverified email', async () => {
	const { requireVerified } = await import('@fonderie-js/core/middlewares');
	const ctx      = makeCtx({ user: { ...BASE_USER, emailVerifiedAt: null, loginMethod: 'email', phoneVerified: false } });
	const response = await requireVerified(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = await response.json() as any;
	assert.equal(body.reason, 'EMAIL_NOT_VERIFIED');
});

test('requireVerified: passes phone user with phoneVerified: true in JWT', async () => {
	const { requireVerified } = await import('@fonderie-js/core/middlewares');
	const ctx    = makeCtx({ user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: true } });
	let   called = false;
	await requireVerified(ctx, async () => { called = true; return Response.json({}); });
	assert.ok(called);
});

test('requireVerified: 403 PHONE_NOT_VERIFIED when phone user has phoneVerified: false', async () => {
	const { requireVerified } = await import('@fonderie-js/core/middlewares');
	const ctx      = makeCtx({ user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: false } });
	const response = await requireVerified(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = await response.json() as any;
	assert.equal(body.reason, 'PHONE_NOT_VERIFIED');
});

test('requireVerified: uses phone gate for email+phone user who logged in via phone', async () => {
	const { requireVerified } = await import('@fonderie-js/core/middlewares');
	// email is set and verified — but loginMethod is phone so phone gate applies
	const ctx      = makeCtx({ user: { ...BASE_USER, loginMethod: 'phone', phoneVerified: false } });
	const response = await requireVerified(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = await response.json() as any;
	assert.equal(body.reason, 'PHONE_NOT_VERIFIED');
});

// ── requireEmailLogin middleware ──────────────────────────────────

test('requireEmailLogin: passes for email session', async () => {
	const { requireEmailLogin } = await import('../middlewares/require-email-login');
	const ctx    = makeCtx({ user: { ...BASE_USER, loginMethod: 'email', phoneVerified: false } });
	let   called = false;
	await requireEmailLogin(ctx, async () => { called = true; return Response.json({}); });
	assert.ok(called);
});

test('requireEmailLogin: 403 EMAIL_LOGIN_REQUIRED for phone session', async () => {
	const { requireEmailLogin } = await import('../middlewares/require-email-login');
	const ctx      = makeCtx({ user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: true } });
	const response = await requireEmailLogin(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = await response.json() as any;
	assert.equal(body.reason, 'EMAIL_LOGIN_REQUIRED');
});

// ── AuthController.register ───────────────────────────────────────

test('register: 422 when email or password missing', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.register(makeCtx({ body: { email: 'a@b.com' } }));
	assert.equal(response.status, 422);
});

test('register: 422 when password is too short', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.register(makeCtx({ body: { email: 'a@b.com', password: 'short' } }));
	assert.equal(response.status, 422);
});

test('register: 409 when email already registered', async () => {
	const ctrl     = makeAuth({ userByEmail: BASE_USER });
	const response = await ctrl.register(makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }));
	assert.equal(response.status, 409);
});

test('register: 201 with user DTO, access and refresh tokens', async () => {
	const ctrl     = makeAuth({ insertedId: 'user-1', userById: BASE_USER });
	const response = await ctrl.register(makeCtx({
		body: { email: 'jane@example.com', password: 'password123', firstName: 'Jane', lastName: 'Doe' },
	}));
	assert.equal(response.status, 201);
	const body = await response.json() as any;
	assert.equal(body.reason,                'USER_EMAIL_REGISTERED');
	assert.ok(body.result?.user);
	assert.equal(body.result.user.email,     'jane@example.com');
	assert.equal(body.result.user.firstName, 'Jane');
	assert.ok(typeof body.result.tokens.access  === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.ok(response.headers.get('set-cookie')?.includes('access_token='));
});

// ── AuthController.register (phone) ──────────────────────────────

test('register: 409 when phone already registered', async () => {
	const ctrl     = makeAuth({ userByPhone: PHONE_USER });
	const response = await ctrl.register(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 409);
});

test('register: 202 with tokens and isPhoneVerified: false on phone registration', async () => {
	const ctrl     = makeAuth({ insertedId: 'user-2', userById: PHONE_USER });
	const response = await ctrl.register(makeCtx({
		body: { phone: '+15141234567', firstName: 'Jane', lastName: 'Doe' },
	}));
	assert.equal(response.status, 202);
	const body = await response.json() as any;
	assert.equal(body.reason,                    'USER_PHONE_REGISTERED');
	assert.ok(typeof body.result.tokens.access  === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.equal(body.result.user.isPhoneVerified, false);
	assert.ok(response.headers.get('set-cookie')?.includes('access_token='));
});

// ── AuthController.login ──────────────────────────────────────────

test('login: 422 when body is invalid', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.login(makeCtx({ body: { email: 'a@b.com' } }));
	assert.equal(response.status, 422);
});

test('login: 401 when user not found', async () => {
	const ctrl     = makeAuth({ userByEmail: null });
	const response = await ctrl.login(makeCtx({ body: { email: 'no@one.com', password: 'password123' } }));
	assert.equal(response.status, 401);
});

test('login: 401 when password is wrong', async () => {
	const ctrl     = makeAuth({ userByEmail: { ...BASE_USER, passwordHash: HASHED_PW } });
	const response = await ctrl.login(makeCtx({ body: { email: 'jane@example.com', password: 'wrongpass' } }));
	assert.equal(response.status, 401);
});

test('login: 403 when account is suspended', async () => {
	const ctrl     = makeAuth({ userByEmail: { ...BASE_USER, passwordHash: HASHED_PW, suspended: true } });
	const response = await ctrl.login(makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }));
	assert.equal(response.status, 403);
});

test('login: 200 with user DTO and tokens', async () => {
	const ctrl     = makeAuth({ userByEmail: { ...BASE_USER, passwordHash: HASHED_PW } });
	const response = await ctrl.login(makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason,                       'USER_EMAIL_LOGIN');
	assert.equal(body.result.user.email,            'jane@example.com');
	assert.equal(body.result.user.profileImageUrl,  'https://cdn.example.com/avatar.jpg');
	assert.ok(typeof body.result.tokens.access  === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
});

// ── AuthController.login (phone) ─────────────────────────────────

test('login: 401 when phone not found', async () => {
	const ctrl     = makeAuth({ userByPhone: null });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 401);
});

test('login: 403 when phone account is suspended', async () => {
	const ctrl     = makeAuth({ userByPhone: { ...PHONE_USER, suspended: true } });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 403);
});

test('login: 202 with tokens and isPhoneVerified: false on phone login', async () => {
	const ctrl     = makeAuth({ userByPhone: PHONE_USER });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 202);
	const body = await response.json() as any;
	assert.equal(body.reason,                    'USER_PHONE_OTP_SENT');
	assert.ok(typeof body.result.tokens.access  === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.equal(body.result.user.isPhoneVerified, false);
});

test('login: 202 with tokens even when phone account has MFA enabled (OTP is sufficient factor)', async () => {
	const ctrl     = makeAuth({ userByPhone: { ...PHONE_USER, mfaEnabled: true } });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 202);
	const body = await response.json() as any;
	assert.equal(body.reason, 'USER_PHONE_OTP_SENT');
});

test('login: email branch takes priority when both email+password and phone are present', async () => {
	const ctrl     = makeAuth({ userByEmail: { ...BASE_USER, passwordHash: HASHED_PW } });
	const response = await ctrl.login(makeCtx({
		body: { email: 'jane@example.com', password: 'password123', phone: '+15141234567' },
	}));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason, 'USER_EMAIL_LOGIN');
});

// ── AuthController.logout ─────────────────────────────────────────

test('logout: 200 with USER_LOGOUT reason', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.logout(makeCtx());
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason, 'USER_LOGOUT');
});

test('logout: clears access_token and refresh_token cookies', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.logout(makeCtx({ body: { refreshToken: VALID_RT } }));
	const cookie   = response.headers.get('set-cookie') ?? '';
	assert.ok(cookie.includes('access_token=;'));
	assert.ok(cookie.includes('Max-Age=0'));
});

// ── AuthController.refresh ────────────────────────────────────────

test('refresh: 401 when no refresh token provided', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.refresh(makeCtx());
	assert.equal(response.status, 401);
});

test('refresh: 401 when session does not exist', async () => {
	const ctrl     = makeAuth({ sessionExists: false });
	const response = await ctrl.refresh(makeCtx({ body: { refreshToken: VALID_RT } }));
	assert.equal(response.status, 401);
});

test('refresh: 200 with new tokens when session is valid', async () => {
	const ctrl     = makeAuth({ sessionExists: true, userById: BASE_USER });
	const response = await ctrl.refresh(makeCtx({ body: { refreshToken: VALID_RT } }));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason,                          'TOKENS_REFRESHED');
	assert.ok(typeof body.result.tokens.access  === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
});

// ── AuthController.forgotPassword ────────────────────────────────

test('forgotPassword: 422 when email missing', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.forgotPassword(makeCtx({ body: {} }));
	assert.equal(response.status, 422);
});

test('forgotPassword: 200 with PASSWORD_RESET_EMAIL_SENT even when email not found', async () => {
	const ctrl     = makeAuth({ userByEmail: null });
	const response = await ctrl.forgotPassword(makeCtx({ body: { email: 'ghost@example.com' } }));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason, 'PASSWORD_RESET_EMAIL_SENT');
});

// ── AuthController.resetPassword ─────────────────────────────────

test('resetPassword: 422 when resetToken or password missing', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.resetPassword(makeCtx({ body: { resetToken: 'tok' } }));
	assert.equal(response.status, 422);
});

test('resetPassword: 400 when token is invalid or expired', async () => {
	const ctrl     = makeAuth({ resetRow: null });
	const response = await ctrl.resetPassword(makeCtx({ body: { resetToken: 'bad-token', password: 'newpass123' } }));
	assert.equal(response.status, 400);
});

test('resetPassword: 200 with PASSWORD_RESET_SUCCESSFUL on valid token', async () => {
	const ctrl     = makeAuth({ resetRow: { user_id: 'user-1', expires_at: new Date(Date.now() + 60_000) } });
	const response = await ctrl.resetPassword(makeCtx({ body: { resetToken: 'valid-tok', password: 'newpass123' } }));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason, 'PASSWORD_RESET_SUCCESSFUL');
});

// ── AuthController.verifyEmail ────────────────────────────────────

test('verifyEmail: 422 when pin missing', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.verifyEmail(makeCtx({ body: {} }));
	assert.equal(response.status, 422);
});

test('verifyEmail: 400 when pin not found', async () => {
	const ctrl     = makeAuth({ verifyRow: null });
	const response = await ctrl.verifyEmail(makeCtx({ user: { ...BASE_USER }, body: { pin: '000000' } }));
	assert.equal(response.status, 400);
});

test('verifyEmail: 200 with verified and email on valid pin', async () => {
	const ctrl     = makeAuth({
		verifyRow: { expires_at: new Date(Date.now() + 60_000) },
	});
	const response = await ctrl.verifyEmail(makeCtx({ user: { ...BASE_USER }, body: { pin: '123456' } }));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason,          'EMAIL_VERIFIED');
	assert.equal(body.result.verified, true);
	assert.equal(body.result.email,    'jane@example.com');
});

// ── AuthController.sendVerificationEmail ─────────────────────────

test('resendVerification: 400 when email already verified', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.sendVerificationEmail(makeCtx({ user: { ...BASE_USER } }));
	assert.equal(response.status, 400);
	const body = await response.json() as any;
	assert.equal(body.reason, 'EMAIL_ALREADY_VERIFIED');
});

test('resendVerification: 200 with token, expiresAt and email', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.sendVerificationEmail(makeCtx({
		user: { ...BASE_USER, emailVerifiedAt: null },
	}));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason,            'VERIFICATION_EMAIL_SENT');
	assert.equal(body.result.stat,       'success');
	assert.ok(typeof body.result.data.token     === 'string');
	assert.ok(typeof body.result.data.expiresAt === 'string');
	assert.equal(body.result.data.email, 'jane@example.com');
});

test('sendVerificationEmail: 400 NO_EMAIL_ON_ACCOUNT for phone-only user', async () => {
	const ctrl     = makeAuth();
	const response = await ctrl.sendVerificationEmail(makeCtx({
		user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: true },
	}));
	assert.equal(response.status, 400);
	const body = await response.json() as any;
	assert.equal(body.reason, 'NO_EMAIL_ON_ACCOUNT');
});

// ── UserController.me ─────────────────────────────────────────────

test('me: 200 with user DTO including profileImageUrl', async () => {
	const ctrl     = makeUser({ userById: BASE_USER });
	const response = await ctrl.me(makeCtx({ user: { id: 'user-1', email: 'jane@example.com' } }));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason,                       'USER_FETCHED');
	assert.equal(body.result.user.email,           'jane@example.com');
	assert.equal(body.result.user.profileImageUrl, 'https://cdn.example.com/avatar.jpg');
	assert.equal(body.result.user.phone,           '+1234567890');
});

// ── UserController.updateMe ───────────────────────────────────────

test('updateMe: 422 when no updatable fields provided', async () => {
	const ctrl     = makeUser();
	const response = await ctrl.updateMe(makeCtx({
		user: { id: 'user-1', email: 'jane@example.com' },
		body: { unknownField: 'value' },
	}));
	assert.equal(response.status, 422);
});

test('updateMe: 200 with updated DTO after phoneNumber and avatarUrl', async () => {
	const updated  = { ...BASE_USER, phone: '+9999999999', profileImageUrl: 'https://cdn.example.com/new.jpg' };
	const ctrl     = makeUser({ updateRow: { id: 'user-1' }, userById: updated });
	const response = await ctrl.updateMe(makeCtx({
		user: { id: 'user-1', email: 'jane@example.com' },
		body: { phoneNumber: '+9999999999', avatarUrl: 'https://cdn.example.com/new.jpg' },
	}));
	assert.equal(response.status, 200);
	const body = await response.json() as any;
	assert.equal(body.reason,                       'ACCOUNT_UPDATED');
	assert.equal(body.result.user.phone,           '+9999999999');
	assert.equal(body.result.user.profileImageUrl, 'https://cdn.example.com/new.jpg');
});
