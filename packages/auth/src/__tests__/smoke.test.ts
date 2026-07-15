import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';
import type { IAuthConfig } from '../config';
import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import type { IUser } from '../types';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import { issueTokenPair, issueMfaPendingToken, verifyToken } from '../services/jwt';
import { generateTotpSecret, generateTotpCode, generateBackupCodes } from '../services/mfa';
import { hashPassword, verifyPassword } from '../services/password';
import { authController } from '../controllers/auth.controller';
import { mfaController } from '../controllers/mfa.controller';
import { oauthController } from '../controllers/oauth.controller';
import { userController } from '../controllers/user.controller';

const config: IAuthConfig = {
	jwtSecret: 'test-secret-min-32-chars-long-here',
	sessionDuration: '7d',
	providers: ['email'],
};

// ── password ────────────────────────────────────────────────────

test('password: hash and verify round-trip', async () => {
	const hash = await hashPassword('correct-horse');
	assert.ok(await verifyPassword('correct-horse', hash));
	assert.ok(!(await verifyPassword('wrong-horse', hash)));
});

test('password: different passwords produce different hashes', async () => {
	const a = await hashPassword('password1');
	const b = await hashPassword('password1');
	assert.notEqual(a, b);
});

// ── jwt ─────────────────────────────────────────────────────────

test('jwt: access token round-trip', () => {
	const { accessToken } = issueTokenPair('user-123', config, { loginMethod: 'email' });
	const payload = verifyToken(accessToken, config);
	assert.ok(payload);
	assert.equal(payload?.sub, 'user-123');
	assert.equal(payload?.type, 'access');
});

test('jwt: refresh token round-trip', () => {
	const { refreshToken } = issueTokenPair('user-456', config, { loginMethod: 'email' });
	const payload = verifyToken(refreshToken, config);
	assert.ok(payload);
	assert.equal(payload?.sub, 'user-456');
	assert.equal(payload?.type, 'refresh');
});

test('jwt: tampered token is rejected', () => {
	const { accessToken } = issueTokenPair('user-789', config, { loginMethod: 'email' });
	const tampered = accessToken.slice(0, -4) + 'xxxx';
	const payload = verifyToken(tampered, config);
	assert.equal(payload, null);
});

test('jwt: token signed with wrong secret is rejected', () => {
	const other = issueTokenPair(
		'user-000',
		{ ...config, jwtSecret: 'other-secret-min-32-chars-long!!' },
		{ loginMethod: 'email' },
	);
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
		query: async () => [],
		transaction: async (fn) => fn(stub),
	};

	const module = new AuthModule(stub, config);

	assert.equal(module.name, '@fonderie/auth');
	assert.ok(typeof module.install === 'function');
});

// ── Fixtures and helpers ─────────────────────────────────────────

const HASHED_PW = await hashPassword('password123');

const BASE_USER: IUser = {
	id: 'user-1',
	email: 'jane@example.com',
	firstName: 'Jane',
	lastName: 'Doe',
	phone: '+1234567890',
	profileImageUrl: 'https://cdn.example.com/avatar.jpg',
	locale: 'en-US',
	timezone: 'UTC',
	isActive: true,
	lastLogin: null,
	preferences: {
		locale: 'en-US',
		timezone: 'UTC',
		notifications: { email: true, inApp: true, sms: false, push: false },
		emailDigest: 'immediate',
		dateFormat: 'MM/DD/YYYY',
		timeFormat: 'hh:mm A',
	},
	suspended: false,
	whitelist: false,
	ipWhitelist: [],
	deletedAt: null,
	createdAt: new Date('2024-01-01T00:00:00Z'),
	updatedAt: new Date('2024-01-01T00:00:00Z'),
	mfaEnabled: false,
	passwordHash: null,
	emailVerifiedAt: new Date('2024-01-02T00:00:00Z'),
};

const { refreshToken: VALID_RT } = issueTokenPair('user-1', config, { loginMethod: 'email' });

const PHONE_USER: IUser = {
	...BASE_USER,
	id: 'user-2',
	email: null,
	passwordHash: null,
	phone: '+15141234567',
	emailVerifiedAt: null,
};

type AuthStoreOpts = {
	userByEmail?: IUser | null;
	userByPhone?: IUser | null;
	userById?: IUser | null;
	insertedId?: string;
	sessionExists?: boolean;
	resetRow?: { user_id: string; expires_at: Date } | null;
	resetLastSentAt?: Date | null;
	verifyRow?: { expires_at: Date } | null;
	phoneVerifRow?: { phone: string; expires_at: Date } | null;
	lastSentAt?: Date | null;
	updateRow?: { id: string } | null;
	// MFA-specific
	mfaPendingSecret?: string;
	mfaSecret?: string;
	backupCodeRows?: { id: string; code_hash: string }[];
};

function makeStore(opts: AuthStoreOpts = {}): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_users') && sql.includes('WHERE email = $1'))
				return (opts.userByEmail != null ? [opts.userByEmail] : []) as unknown as T[];

			if (sql.includes('fonderie_users') && sql.includes('WHERE phone = $1'))
				return (opts.userByPhone != null ? [opts.userByPhone] : []) as unknown as T[];

			if (
				sql.includes('fonderie_users') &&
				sql.includes('WHERE id = $1') &&
				sql.includes('deleted_at IS NULL')
			)
				return (opts.userById != null ? [opts.userById] : []) as unknown as T[];

			if (sql.includes('INSERT INTO fonderie_users'))
				return (opts.insertedId ? [{ id: opts.insertedId }] : []) as unknown as T[];

			if (sql.includes('fonderie_sessions') && sql.includes('SELECT id'))
				return (opts.sessionExists ? [{ id: 'sess-1' }] : []) as unknown as T[];

			if (sql.includes('fonderie_password_resets') && sql.includes('SELECT created_at'))
				return (opts.resetLastSentAt != null
					? [{ created_at: opts.resetLastSentAt }]
					: []) as unknown as T[];

			if (sql.includes('fonderie_password_resets') && sql.includes('WHERE pin'))
				return (opts.resetRow != null ? [opts.resetRow] : []) as unknown as T[];

			if (sql.includes('fonderie_email_verifications') && sql.includes('AND token'))
				return (opts.verifyRow != null ? [opts.verifyRow] : []) as unknown as T[];

			if (sql.includes('SELECT created_at') && sql.includes('WHERE user_id'))
				return (opts.lastSentAt != null ? [{ created_at: opts.lastSentAt }] : []) as unknown as T[];

			if (sql.includes('fonderie_phone_verifications') && sql.includes('WHERE user_id'))
				return (opts.phoneVerifRow != null ? [opts.phoneVerifRow] : []) as unknown as T[];

			if (sql.includes('UPDATE fonderie_users') && sql.includes('RETURNING id'))
				return (opts.updateRow != null ? [opts.updateRow] : []) as unknown as T[];

			if (sql.includes('fonderie_users') && sql.includes('mfa_secret_pending'))
				return (typeof opts.mfaPendingSecret === 'string'
					? [{ mfa_secret_pending: opts.mfaPendingSecret }]
					: []) as unknown as T[];

			if (
				sql.includes('fonderie_users') &&
				sql.includes('mfa_secret') &&
				!sql.includes('mfa_secret_pending')
			)
				return (typeof opts.mfaSecret === 'string'
					? [{ mfa_secret: opts.mfaSecret }]
					: []) as unknown as T[];

			if (sql.includes('fonderie_mfa_backup_codes') && sql.includes('used_at IS NULL'))
				return (opts.backupCodeRows ?? []) as unknown as T[];

			return [] as unknown as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	return stub;
}

function makeCtx(
	opts: {
		user?: {
			id: string;
			email: string | null;
			loginMethod?: 'email' | 'phone';
			phoneVerified?: boolean;
			[key: string]: unknown;
		} | null;
		body?: Record<string, unknown>;
		workspace?: { id: string } | null;
		cookie?: string;
		ip?: string;
	} = {},
): any {
	return {
		user: 'user' in opts ? opts.user : null,
		workspace: 'workspace' in opts ? opts.workspace : null,
		tenant: null,
		meta: { body: opts.body ?? {}, ...(opts.ip ? { clientIp: opts.ip } : {}) },
		request: new Request('http://localhost/', {
			headers: opts.cookie ? { cookie: opts.cookie } : {},
		}),
	};
}

function makeAuth(storeOpts: AuthStoreOpts = {}, bus?: any) {
	return authController(makeStore(storeOpts), config, bus);
}

function makeUser(storeOpts: AuthStoreOpts = {}, bus?: any) {
	return userController(makeStore(storeOpts), config, bus);
}

function makeMfa(storeOpts: AuthStoreOpts = {}, bus?: any) {
	return mfaController(makeStore(storeOpts), config, 'TestApp', bus);
}

// ── toUserDTO ─────────────────────────────────────────────────────

test('toUserDTO: maps all fields correctly', async () => {
	const { toUserDTO } = await import('../dtos/user');
	const dto = toUserDTO(BASE_USER);

	assert.equal(dto.profileImageUrl, 'https://cdn.example.com/avatar.jpg');
	assert.equal(dto.phone, '+1234567890');
	assert.equal(dto.isEmailVerified, true);
	assert.equal(dto.firstName, 'Jane');
	assert.equal(dto.lastName, 'Doe');
	assert.equal(dto.mfaEnabled, false);
	assert.equal(dto.isActive, true);
	assert.equal(dto.lastLogin, '');
	assert.equal(dto.suspended, false);
	assert.equal(dto.whitelist, false);
	assert.deepEqual(dto.ipWhitelist, []);
	assert.equal(dto.preferences.locale, 'en-US');
	assert.equal(dto.preferences.timezone, 'UTC');
	assert.equal(dto.preferences.emailDigest, 'immediate');
	assert.equal(dto.preferences.notifications.email, true);
	assert.equal(dto.preferences.notifications.sms, false);
});

test('toUserDTO: ipWhitelist and lastLogin are passed through', async () => {
	const { toUserDTO } = await import('../dtos/user');
	const user = {
		...BASE_USER,
		ipWhitelist: ['192.168.1.1'],
		lastLogin: new Date('2024-06-01T12:00:00Z'),
	};
	const dto = toUserDTO(user);
	assert.equal(dto.ipWhitelist[0], '192.168.1.1');
	assert.ok(dto.lastLogin.startsWith('2024-06-01'));
});

test('toUserDTO: falls back to defaults when preferences is null', async () => {
	const { toUserDTO } = await import('../dtos/user');
	const dto = toUserDTO({ ...BASE_USER, preferences: null as any });
	assert.equal(dto.preferences.emailDigest, 'immediate');
	assert.equal(dto.preferences.notifications.email, true);
});

// ── requireAuth middleware ────────────────────────────────────────

test('requireAuth: returns 401 when ctx.user is null', async () => {
	const { requireAuth } = await import('../middlewares/require-auth');
	const ctx = makeCtx({ user: null });
	const response = await requireAuth(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 401);
});

test('requireAuth: calls next when ctx.user is set', async () => {
	const { requireAuth } = await import('../middlewares/require-auth');
	const ctx = makeCtx({ user: { id: 'user-1', email: 'a@b.com' } });
	let called = false;
	await requireAuth(ctx, async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

test('requireAuth: 403 MFA_REQUIRED when ctx.user.mfaPending is true', async () => {
	const { requireAuth } = await import('../middlewares/require-auth');
	const ctx = makeCtx({ user: { id: 'user-1', email: 'a@b.com', mfaPending: true } });
	const response = await requireAuth(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_REQUIRED');
});

test('requireAnyAuth: 401 when ctx.user is null', async () => {
	const { requireAnyAuth } = await import('../middlewares/require-auth');
	const ctx = makeCtx({ user: null });
	const response = await requireAnyAuth(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 401);
});

test('requireAnyAuth: calls next when ctx.user.mfaPending is true', async () => {
	const { requireAnyAuth } = await import('../middlewares/require-auth');
	const ctx = makeCtx({ user: { id: 'user-1', email: 'a@b.com', mfaPending: true } });
	let called = false;
	await requireAnyAuth(ctx, async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

// ── requireVerified middleware ────────────────────────────────────

test('requireVerified: passes email user with verified email', async () => {
	const { requireVerified } = await import('@fonderie/core/middlewares');
	const ctx = makeCtx({ user: { ...BASE_USER, loginMethod: 'email', phoneVerified: false } });
	let called = false;
	await requireVerified(ctx, async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

test('requireVerified: 403 EMAIL_NOT_VERIFIED when email user has unverified email', async () => {
	const { requireVerified } = await import('@fonderie/core/middlewares');
	const ctx = makeCtx({
		user: { ...BASE_USER, emailVerifiedAt: null, loginMethod: 'email', phoneVerified: false },
	});
	const response = await requireVerified(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'EMAIL_NOT_VERIFIED');
});

test('requireVerified: passes phone user with phoneVerified: true in JWT', async () => {
	const { requireVerified } = await import('@fonderie/core/middlewares');
	const ctx = makeCtx({ user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: true } });
	let called = false;
	await requireVerified(ctx, async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

test('requireVerified: 403 PHONE_NOT_VERIFIED when phone user has phoneVerified: false', async () => {
	const { requireVerified } = await import('@fonderie/core/middlewares');
	const ctx = makeCtx({ user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: false } });
	const response = await requireVerified(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PHONE_NOT_VERIFIED');
});

test('requireVerified: uses phone gate for email+phone user who logged in via phone', async () => {
	const { requireVerified } = await import('@fonderie/core/middlewares');
	// email is set and verified — but loginMethod is phone so phone gate applies
	const ctx = makeCtx({ user: { ...BASE_USER, loginMethod: 'phone', phoneVerified: false } });
	const response = await requireVerified(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PHONE_NOT_VERIFIED');
});

// ── requireEmailLogin middleware ──────────────────────────────────

test('requireEmailLogin: passes for email session', async () => {
	const { requireEmailLogin } = await import('../middlewares/require-email-login');
	const ctx = makeCtx({ user: { ...BASE_USER, loginMethod: 'email', phoneVerified: false } });
	let called = false;
	await requireEmailLogin(ctx, async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

test('requireEmailLogin: 403 EMAIL_LOGIN_REQUIRED for phone session', async () => {
	const { requireEmailLogin } = await import('../middlewares/require-email-login');
	const ctx = makeCtx({ user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: true } });
	const response = await requireEmailLogin(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'EMAIL_LOGIN_REQUIRED');
});

// ── AuthController.register ───────────────────────────────────────

test('register: 422 when email or password missing', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.register(makeCtx({ body: { email: 'a@b.com' } }));
	assert.equal(response.status, 422);
});

test('register: 422 when password is too short', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.register(makeCtx({ body: { email: 'a@b.com', password: 'short' } }));
	assert.equal(response.status, 422);
});

test('register: 409 when email already registered', async () => {
	const ctrl = makeAuth({ userByEmail: BASE_USER });
	const response = await ctrl.register(
		makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }),
	);
	assert.equal(response.status, 409);
});

test('register: 201 with user DTO, access and refresh tokens', async () => {
	const ctrl = makeAuth({ insertedId: 'user-1', userById: BASE_USER });
	const response = await ctrl.register(
		makeCtx({
			body: {
				email: 'jane@example.com',
				password: 'password123',
				firstName: 'Jane',
				lastName: 'Doe',
			},
		}),
	);
	assert.equal(response.status, 201);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_EMAIL_REGISTERED');
	assert.ok(body.result?.user);
	assert.equal(body.result.user.email, 'jane@example.com');
	assert.equal(body.result.user.firstName, 'Jane');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.ok(response.headers.get('set-cookie')?.includes('access_token='));
});

// ── AuthController.register (phone) ──────────────────────────────

test('register: 409 when phone already registered', async () => {
	const ctrl = makeAuth({ userByPhone: PHONE_USER });
	const response = await ctrl.register(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 409);
});

test('register: 202 with tokens and isPhoneVerified: false on phone registration', async () => {
	const ctrl = makeAuth({ insertedId: 'user-2', userById: PHONE_USER });
	const response = await ctrl.register(
		makeCtx({
			body: { phone: '+15141234567', firstName: 'Jane', lastName: 'Doe' },
		}),
	);
	assert.equal(response.status, 202);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_PHONE_REGISTERED');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.equal(body.result.user.isPhoneVerified, false);
	assert.ok(response.headers.get('set-cookie')?.includes('access_token='));
});

// ── AuthController.login ──────────────────────────────────────────

test('login: 422 when body is invalid', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.login(makeCtx({ body: { email: 'a@b.com' } }));
	assert.equal(response.status, 422);
});

test('login: 401 when user not found', async () => {
	const ctrl = makeAuth({ userByEmail: null });
	const response = await ctrl.login(
		makeCtx({ body: { email: 'no@one.com', password: 'password123' } }),
	);
	assert.equal(response.status, 401);
});

test('login: 401 when password is wrong', async () => {
	const ctrl = makeAuth({ userByEmail: { ...BASE_USER, passwordHash: HASHED_PW } });
	const response = await ctrl.login(
		makeCtx({ body: { email: 'jane@example.com', password: 'wrongpass' } }),
	);
	assert.equal(response.status, 401);
});

test('login: 403 when account is suspended', async () => {
	const ctrl = makeAuth({
		userByEmail: { ...BASE_USER, passwordHash: HASHED_PW, suspended: true },
	});
	const response = await ctrl.login(
		makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }),
	);
	assert.equal(response.status, 403);
});

test('login: 200 with user DTO and tokens', async () => {
	const ctrl = makeAuth({ userByEmail: { ...BASE_USER, passwordHash: HASHED_PW } });
	const response = await ctrl.login(
		makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_EMAIL_LOGIN');
	assert.equal(body.result.user.email, 'jane@example.com');
	assert.equal(body.result.user.profileImageUrl, 'https://cdn.example.com/avatar.jpg');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
});

// ── AuthController.login (phone) ─────────────────────────────────

test('login: 401 when phone not found', async () => {
	const ctrl = makeAuth({ userByPhone: null });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 401);
});

test('login: 403 when phone account is suspended', async () => {
	const ctrl = makeAuth({ userByPhone: { ...PHONE_USER, suspended: true } });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 403);
});

test('login: 202 with tokens and isPhoneVerified: false on phone login', async () => {
	const ctrl = makeAuth({ userByPhone: PHONE_USER });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 202);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_PHONE_OTP_SENT');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.equal(body.result.user.isPhoneVerified, false);
});

test('login: 202 with tokens even when phone account has MFA enabled (OTP is sufficient factor)', async () => {
	const ctrl = makeAuth({ userByPhone: { ...PHONE_USER, mfaEnabled: true } });
	const response = await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	assert.equal(response.status, 202);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_PHONE_OTP_SENT');
});

test('login: email branch takes priority when both email+password and phone are present', async () => {
	const ctrl = makeAuth({ userByEmail: { ...BASE_USER, passwordHash: HASHED_PW } });
	const response = await ctrl.login(
		makeCtx({
			body: { email: 'jane@example.com', password: 'password123', phone: '+15141234567' },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_EMAIL_LOGIN');
});

test('login: 200 MFA_REQUIRED with mfaToken when email user has MFA enabled', async () => {
	const ctrl = makeAuth({
		userByEmail: { ...BASE_USER, passwordHash: HASHED_PW, mfaEnabled: true },
	});
	const response = await ctrl.login(
		makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_REQUIRED');
	assert.ok(typeof body.result.mfaToken === 'string', 'mfaToken must be present');
	// verify it is a valid access token with mfaPending: true
	const payload = verifyToken(body.result.mfaToken, config) as any;
	assert.ok(payload);
	assert.equal(payload.type, 'access');
	assert.equal(payload.mfaPending, true);
});

test('jwt: issueMfaPendingToken produces access token with mfaPending: true', () => {
	const token = issueMfaPendingToken('user-1', config, 'email');
	const payload = verifyToken(token, config) as any;
	assert.ok(payload);
	assert.equal(payload.type, 'access');
	assert.equal(payload.mfaPending, true);
	assert.equal(payload.sub, 'user-1');
});

// ── AuthController.logout ─────────────────────────────────────────

test('logout: 200 with USER_LOGOUT reason', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.logout(makeCtx());
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_LOGOUT');
});

test('logout: clears access_token and refresh_token cookies', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.logout(makeCtx({ body: { refreshToken: VALID_RT } }));
	const cookie = response.headers.get('set-cookie') ?? '';
	assert.ok(cookie.includes('access_token=;'));
	assert.ok(cookie.includes('Max-Age=0'));
});

// ── AuthController.refresh ────────────────────────────────────────

test('refresh: 401 when no refresh token provided', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.refresh(makeCtx());
	assert.equal(response.status, 401);
});

test('refresh: 401 when session does not exist', async () => {
	const ctrl = makeAuth({ sessionExists: false });
	const response = await ctrl.refresh(makeCtx({ body: { refreshToken: VALID_RT } }));
	assert.equal(response.status, 401);
});

test('refresh: 200 with new tokens when session is valid', async () => {
	const ctrl = makeAuth({ sessionExists: true, userById: BASE_USER });
	const response = await ctrl.refresh(makeCtx({ body: { refreshToken: VALID_RT } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'TOKENS_REFRESHED');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
});

// ── AuthController.forgotPassword ────────────────────────────────

test('forgotPassword: 422 when email missing', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.forgotPassword(makeCtx({ body: {} }));
	assert.equal(response.status, 422);
});

test('forgotPassword: 200 with PASSWORD_RESET_EMAIL_SENT even when email not found', async () => {
	const ctrl = makeAuth({ userByEmail: null });
	const response = await ctrl.forgotPassword(makeCtx({ body: { email: 'ghost@example.com' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PASSWORD_RESET_EMAIL_SENT');
});

test('forgotPassword: cooldown suppresses the send but keeps the uniform envelope (no enumeration)', async () => {
	// Previously returned 429 VERIFICATION_COOLDOWN — which fired only for
	// existing accounts, so two rapid requests revealed whether an email was
	// registered. The cooldown must be indistinguishable from every other
	// outcome of this endpoint.
	const ctrl = makeAuth({ userByEmail: BASE_USER, resetLastSentAt: new Date(Date.now() - 60_000) }); // 1 min ago
	const response = await ctrl.forgotPassword(makeCtx({ body: { email: 'jane@example.com' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PASSWORD_RESET_EMAIL_SENT');
});

test('forgotPassword: 200 PASSWORD_RESET_EMAIL_SENT when cooldown has passed', async () => {
	const ctrl = makeAuth({
		userByEmail: BASE_USER,
		resetLastSentAt: new Date(Date.now() - 6 * 60_000),
	}); // 6 min ago
	const response = await ctrl.forgotPassword(makeCtx({ body: { email: 'jane@example.com' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PASSWORD_RESET_EMAIL_SENT');
});

// ── AuthController.resetPassword ─────────────────────────────────

test('resetPassword: 422 when pin or password missing', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.resetPassword(makeCtx({ body: { pin: '123456' } }));
	assert.equal(response.status, 422);
});

test('resetPassword: 422 when pin is not a 6-digit code', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.resetPassword(
		makeCtx({ body: { pin: 'abcdef', password: 'newpass123' } }),
	);
	assert.equal(response.status, 422);
});

test('resetPassword: 400 when pin is invalid or expired', async () => {
	const ctrl = makeAuth({ resetRow: null });
	const response = await ctrl.resetPassword(
		makeCtx({ body: { pin: '000000', password: 'newpass123' } }),
	);
	assert.equal(response.status, 400);
});

test('resetPassword: 200 with PASSWORD_RESET_SUCCESSFUL on valid pin', async () => {
	const ctrl = makeAuth({
		resetRow: { user_id: 'user-1', expires_at: new Date(Date.now() + 60_000) },
	});
	const response = await ctrl.resetPassword(
		makeCtx({ body: { pin: '123456', password: 'newpass123' } }),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PASSWORD_RESET_SUCCESSFUL');
});

// ── AuthController.verify (unified) ──────────────────────────────

test('verify: 200 VERIFIED (idempotent) when email user is already verified', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.verify(makeCtx({ user: { ...BASE_USER, loginMethod: 'email' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFIED');
	assert.equal(body.result.verified, true);
});

test('verify: 422 when token missing or non-numeric', async () => {
	const ctrl = makeAuth();
	const unverified = { ...BASE_USER, emailVerifiedAt: null, loginMethod: 'email' as const };
	assert.equal((await ctrl.verify(makeCtx({ user: unverified, body: {} }))).status, 422);
	assert.equal(
		(await ctrl.verify(makeCtx({ user: unverified, body: { token: 'abcdef' } }))).status,
		422,
	);
	assert.equal(
		(await ctrl.verify(makeCtx({ user: unverified, body: { token: ' 12345 ' } }))).status,
		422,
	);
});

test('verify: 400 VERIFICATION_FAILED when email pin not found', async () => {
	const ctrl = makeAuth({ verifyRow: null });
	const unverified = { ...BASE_USER, emailVerifiedAt: null, loginMethod: 'email' as const };
	const response = await ctrl.verify(makeCtx({ user: unverified, body: { token: '000000' } }));
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFICATION_FAILED');
});

test('verify: 200 VERIFIED with verified and email on valid email pin', async () => {
	const ctrl = makeAuth({ verifyRow: { expires_at: new Date(Date.now() + 60_000) } });
	const unverified = { ...BASE_USER, emailVerifiedAt: null, loginMethod: 'email' as const };
	const response = await ctrl.verify(makeCtx({ user: unverified, body: { token: '123456' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFIED');
	assert.equal(body.result.verified, true);
	assert.equal(body.result.email, 'jane@example.com');
});

test('verify: 200 when email token has surrounding whitespace (trimmed before lookup)', async () => {
	const ctrl = makeAuth({ verifyRow: { expires_at: new Date(Date.now() + 60_000) } });
	const unverified = { ...BASE_USER, emailVerifiedAt: null, loginMethod: 'email' as const };
	const response = await ctrl.verify(makeCtx({ user: unverified, body: { token: '  123456  ' } }));
	assert.equal(response.status, 200);
});

test('verify: 400 VERIFICATION_FAILED when phone OTP not found', async () => {
	const ctrl = makeAuth({ phoneVerifRow: null });
	const response = await ctrl.verify(
		makeCtx({
			user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: false },
			body: { token: '000000' },
		}),
	);
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFICATION_FAILED');
});

test('verify: 200 VERIFIED with new tokens and isPhoneVerified: true on valid phone OTP', async () => {
	const ctrl = makeAuth({
		phoneVerifRow: { phone: '+15141234567', expires_at: new Date(Date.now() + 60_000) },
		userById: PHONE_USER,
	});
	const response = await ctrl.verify(
		makeCtx({
			user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: false },
			body: { token: '123456' },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFIED');
	assert.equal(body.result.user.isPhoneVerified, true);
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
});

// ── AuthController.sendVerification (unified) ────────────────────

test('sendVerification: 200 VERIFICATION_SENT with email for email user', async () => {
	const ctrl = makeAuth();
	const unverified = { ...BASE_USER, emailVerifiedAt: null };
	const response = await ctrl.sendVerification(makeCtx({ user: unverified }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFICATION_SENT');
	assert.equal(body.result.email, 'jane@example.com');
	assert.equal(body.result.token, undefined);
});

test('sendVerification: 200 EMAIL_VERIFIED (idempotent) when email already verified', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.sendVerification(makeCtx({ user: { ...BASE_USER } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'EMAIL_VERIFIED');
});

test('sendVerification: 400 NO_EMAIL_ON_ACCOUNT for phone-only email session', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.sendVerification(
		makeCtx({
			user: { ...PHONE_USER, loginMethod: 'email', phoneVerified: false },
		}),
	);
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'NO_EMAIL_ON_ACCOUNT');
});

test('sendVerification: 200 VERIFICATION_SENT for phone user (uses phone from session)', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.sendVerification(
		makeCtx({
			user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: false },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFICATION_SENT');
});

test('sendVerification: 400 NO_PHONE_ON_ACCOUNT when phone user has no phone in session', async () => {
	const ctrl = makeAuth();
	const response = await ctrl.sendVerification(
		makeCtx({
			user: { ...PHONE_USER, phone: null, loginMethod: 'phone', phoneVerified: false },
		}),
	);
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'NO_PHONE_ON_ACCOUNT');
});

test('sendVerification: 429 VERIFICATION_COOLDOWN when email code was sent recently', async () => {
	const ctrl = makeAuth({ lastSentAt: new Date(Date.now() - 60_000) }); // 1 min ago
	const unverified = { ...BASE_USER, emailVerifiedAt: null };
	const response = await ctrl.sendVerification(makeCtx({ user: unverified }));
	assert.equal(response.status, 429);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFICATION_COOLDOWN');
	assert.ok(typeof body.details.retryAfter === 'number');
	assert.ok(body.details.retryAfter > 0);
});

test('sendVerification: 200 VERIFICATION_SENT when cooldown has passed for email', async () => {
	const ctrl = makeAuth({ lastSentAt: new Date(Date.now() - 6 * 60_000) }); // 6 min ago
	const unverified = { ...BASE_USER, emailVerifiedAt: null };
	const response = await ctrl.sendVerification(makeCtx({ user: unverified }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFICATION_SENT');
});

test('sendVerification: 429 VERIFICATION_COOLDOWN when phone OTP was sent recently', async () => {
	const ctrl = makeAuth({ lastSentAt: new Date(Date.now() - 60_000) }); // 1 min ago
	const response = await ctrl.sendVerification(
		makeCtx({
			user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: false },
		}),
	);
	assert.equal(response.status, 429);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'VERIFICATION_COOLDOWN');
});

test('sendVerification: respects custom verificationCooldown from config', async () => {
	const shortConfig = { ...config, verificationCooldown: 30_000 }; // 30s
	const ctrl = authController(
		makeStore({ lastSentAt: new Date(Date.now() - 60_000) }),
		shortConfig,
	);
	const unverified = { ...BASE_USER, emailVerifiedAt: null };
	const response = await ctrl.sendVerification(makeCtx({ user: unverified }));
	// 60s elapsed > 30s cooldown → should pass
	assert.equal(response.status, 200);
});

// ── UserController.me ─────────────────────────────────────────────

test('me: 200 with user DTO including profileImageUrl', async () => {
	const ctrl = makeUser({ userById: BASE_USER });
	const response = await ctrl.me(makeCtx({ user: { id: 'user-1', email: 'jane@example.com' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_ACCOUNT_FETCHED');
	assert.equal(body.result.user.email, 'jane@example.com');
	assert.equal(body.result.user.profileImageUrl, 'https://cdn.example.com/avatar.jpg');
	assert.equal(body.result.user.phone, '+1234567890');
});

test('me: 200 for unverified email user (GET /users does not require verification)', async () => {
	const unverified = { ...BASE_USER, emailVerifiedAt: null };
	const ctrl = makeUser({ userById: unverified });
	const response = await ctrl.me(makeCtx({ user: { id: 'user-1', email: 'jane@example.com' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'USER_ACCOUNT_FETCHED');
	assert.equal(body.result.user.isEmailVerified, false);
});

// ── UserController.updateProfile ─────────────────────────────────

test('updateProfile: 422 when no profile fields provided', async () => {
	const ctrl = makeUser();
	const response = await ctrl.updateProfile(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { unknownField: 'value' },
		}),
	);
	assert.equal(response.status, 422);
});

test('updateProfile: 200 with updated DTO', async () => {
	const updated = {
		...BASE_USER,
		firstName: 'Janet',
		profileImageUrl: 'https://cdn.example.com/new.jpg',
	};
	const ctrl = makeUser({ updateRow: { id: 'user-1' }, userById: updated });
	const response = await ctrl.updateProfile(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { firstName: 'Janet', avatarUrl: 'https://cdn.example.com/new.jpg' },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PROFILE_UPDATED');
	assert.equal(body.result.user.firstName, 'Janet');
	assert.equal(body.result.user.profileImageUrl, 'https://cdn.example.com/new.jpg');
});

// ── UserController.updatePreferences ─────────────────────────────

test('updatePreferences: 422 when no preference fields provided', async () => {
	const ctrl = makeUser();
	const response = await ctrl.updatePreferences(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: {},
		}),
	);
	assert.equal(response.status, 422);
});

test('updatePreferences: 200 with updated locale and timezone', async () => {
	const updated = { ...BASE_USER, locale: 'fr-FR', timezone: 'America/Montreal' };
	const ctrl = makeUser({ updateRow: { id: 'user-1' }, userById: updated });
	const response = await ctrl.updatePreferences(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { locale: 'fr-FR', timezone: 'America/Montreal' },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PREFERENCES_UPDATED');
	assert.equal(body.result.user.preferences.locale, 'fr-FR');
	assert.equal(body.result.user.preferences.timezone, 'America/Montreal');
});

test('updatePreferences: 200 with notification sub-fields patched', async () => {
	const updated = {
		...BASE_USER,
		preferences: { ...BASE_USER.preferences, emailDigest: 'weekly' },
	};
	const ctrl = makeUser({ updateRow: { id: 'user-1' }, userById: updated });
	const response = await ctrl.updatePreferences(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { emailDigest: 'weekly' },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PREFERENCES_UPDATED');
	assert.equal(body.result.user.preferences.emailDigest, 'weekly');
});

// ── UserController.updateEmail ────────────────────────────────────

test('updateEmail: 422 when email is missing', async () => {
	const ctrl = makeUser();
	const response = await ctrl.updateEmail(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: {},
		}),
	);
	assert.equal(response.status, 422);
});

test('updateEmail: 422 when new email is same as current', async () => {
	const ctrl = makeUser();
	const response = await ctrl.updateEmail(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { email: 'jane@example.com' },
		}),
	);
	assert.equal(response.status, 422);
});

test('updateEmail: 409 when email is already in use by another account', async () => {
	const ctrl = makeUser({ userByEmail: { ...BASE_USER, id: 'user-2' } });
	const response = await ctrl.updateEmail(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { email: 'other@example.com' },
		}),
	);
	assert.equal(response.status, 409);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'EMAIL_IN_USE');
});

test('updateEmail: 200 EMAIL_UPDATED, emits verification to new address and alert to old via bus', async () => {
	const bus = makeBus();
	const ctrl = makeUser({}, bus);
	const ctx = makeCtx({
		user: { id: 'user-1', email: 'jane@example.com' },
		body: { email: 'new@example.com' },
	});
	const response = await ctrl.updateEmail(ctx);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'EMAIL_UPDATED');
	assert.equal(body.result.email, 'new@example.com');
	const notifications = bus.emitted.filter((e: any) => e.type === NOTIFICATION_EVENT);
	assert.equal(notifications.length, 2);
	const verif = notifications.find(
		(e: any) => (e.payload as any).type === MESSAGE_KEYS.emailVerification,
	);
	const alert = notifications.find(
		(e: any) => (e.payload as any).type === MESSAGE_KEYS.emailChanged,
	);
	assert.equal((verif?.payload as any)?.recipient?.email, 'new@example.com');
	assert.ok(typeof (verif?.payload as any)?.data?.pin === 'string');
	assert.equal((alert?.payload as any)?.recipient?.email, 'jane@example.com');
});

// ── UserController.updatePhone ────────────────────────────────────

test('updatePhone: 422 when phone is missing or invalid', async () => {
	const ctrl = makeUser();
	const response = await ctrl.updatePhone(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { phone: 'not-a-phone' },
		}),
	);
	assert.equal(response.status, 422);
});

test('updatePhone: 409 when phone is already in use', async () => {
	const ctrl = makeUser({ userByPhone: { ...BASE_USER, id: 'user-2' } });
	const response = await ctrl.updatePhone(
		makeCtx({
			user: { id: 'user-1', email: 'jane@example.com' },
			body: { phone: '+15141234567' },
		}),
	);
	assert.equal(response.status, 409);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PHONE_IN_USE');
});

test('updatePhone: 200 PHONE_UPDATED, emits OTP to new number and alert to email via bus', async () => {
	const bus = makeBus();
	const ctrl = makeUser({}, bus);
	const ctx = makeCtx({
		user: { id: 'user-1', email: 'jane@example.com' },
		body: { phone: '+15141234567' },
	});
	const response = await ctrl.updatePhone(ctx);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PHONE_UPDATED');
	assert.equal(body.result.phone, '+15141234567');
	const notifications = bus.emitted.filter((e: any) => e.type === NOTIFICATION_EVENT);
	assert.equal(notifications.length, 2);
	const otp = notifications.find((e: any) => (e.payload as any).type === MESSAGE_KEYS.phoneOtp);
	const alert = notifications.find(
		(e: any) => (e.payload as any).type === MESSAGE_KEYS.phoneChanged,
	);
	assert.equal((otp?.payload as any)?.recipient?.phone, '+15141234567');
	assert.ok(typeof (otp?.payload as any)?.data?.otp === 'string');
	assert.equal((alert?.payload as any)?.recipient?.email, 'jane@example.com');
});

// ── MfaController.regenerateBackupCodes ──────────────────────────

test('mfa.regenerateBackupCodes: 422 when token is missing', async () => {
	const ctrl = makeMfa();
	const response = await ctrl.regenerateBackupCodes(makeCtx({ user: MFA_USER, body: {} }));
	assert.equal(response.status, 422);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_PARAMETER');
});

test('mfa.regenerateBackupCodes: 400 MFA_NOT_ENABLED when mfaEnabled is false', async () => {
	const ctrl = makeMfa();
	const response = await ctrl.regenerateBackupCodes(
		makeCtx({
			user: { ...BASE_USER, mfaEnabled: false, loginMethod: 'email' },
			body: { token: '123456' },
		}),
	);
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_NOT_ENABLED');
});

test('mfa.regenerateBackupCodes: 401 INVALID_CODE when TOTP is wrong', async () => {
	const secret = generateTotpSecret();
	const ctrl = makeMfa({ mfaSecret: secret });
	const response = await ctrl.regenerateBackupCodes(
		makeCtx({
			user: MFA_USER,
			body: { token: '000000' },
		}),
	);
	assert.equal(response.status, 401);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_CODE');
});

test('mfa.regenerateBackupCodes: 200 with 8 fresh backup codes on valid TOTP', async () => {
	const secret = generateTotpSecret();
	const code = generateTotpCode(secret);
	const ctrl = makeMfa({ mfaSecret: secret });
	const response = await ctrl.regenerateBackupCodes(
		makeCtx({
			user: MFA_USER,
			body: { token: code },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'BACKUP_CODES_REGENERATED');
	assert.ok(Array.isArray(body.result.backupCodes));
	assert.equal(body.result.backupCodes.length, 8);
	assert.ok(body.result.backupCodes.every((c: string) => /^[A-F0-9]{8}$/.test(c)));
});

// ── MfaController.verify ─────────────────────────────────────────

const MFA_USER = { ...BASE_USER, mfaEnabled: true, loginMethod: 'email' as const };

test('mfa.verify: 422 when token is missing', async () => {
	const ctrl = makeMfa();
	const response = await ctrl.verify(
		makeCtx({ user: { ...MFA_USER, mfaPending: true }, body: {} }),
	);
	assert.equal(response.status, 422);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_PARAMETER');
});

// ── TOTP login branch ─────────────────────────────────────────────

test('mfa.verify: 403 MFA_NOT_PENDING when called with full-auth token (TOTP branch)', async () => {
	const ctrl = makeMfa();
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER, mfaPending: false },
			body: { token: '123456' },
		}),
	);
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_NOT_PENDING');
});

test('mfa.verify: 400 MFA_NOT_CONFIGURED when TOTP secret not in DB', async () => {
	const ctrl = makeMfa(); // mfaSecret undefined → empty row → null
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER, mfaPending: true },
			body: { token: '123456' },
		}),
	);
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_NOT_CONFIGURED');
});

test('mfa.verify: 401 INVALID_CODE for wrong TOTP code', async () => {
	const secret = generateTotpSecret();
	const ctrl = makeMfa({ mfaSecret: secret });
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER, mfaPending: true },
			body: { token: '000000' },
		}),
	);
	assert.equal(response.status, 401);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_CODE');
});

test('mfa.verify: 200 MFA_VERIFIED with access+refresh tokens on valid TOTP', async () => {
	const secret = generateTotpSecret();
	const code = generateTotpCode(secret);
	const ctrl = makeMfa({ mfaSecret: secret, userById: MFA_USER });
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER, mfaPending: true },
			body: { token: code },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_VERIFIED');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.ok(body.result.user);
	const access = verifyToken(body.result.tokens.access, config) as any;
	assert.equal(access?.mfaPending, undefined); // full-auth token — no mfaPending flag
	assert.ok(response.headers.get('set-cookie')?.includes('access_token='));
});

// ── Backup code branch ────────────────────────────────────────────

test('mfa.verify: 403 MFA_NOT_PENDING when called with full-auth token (backup code branch)', async () => {
	const ctrl = makeMfa();
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER, mfaPending: false },
			body: { token: 'ABCDEFGH' }, // 8-char alphanumeric → backup code branch
		}),
	);
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_NOT_PENDING');
});

test('mfa.verify: 400 MFA_NOT_CONFIGURED when mfaEnabled is false (backup code branch)', async () => {
	const ctrl = makeMfa();
	const response = await ctrl.verify(
		makeCtx({
			user: { ...BASE_USER, mfaEnabled: false, mfaPending: true, loginMethod: 'email' },
			body: { token: 'ABCDEFGH' },
		}),
	);
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_NOT_CONFIGURED');
});

test('mfa.verify: 401 INVALID_CODE when backup code has no match', async () => {
	const hash = await hashPassword('ABCD1234');
	const ctrl = makeMfa({ backupCodeRows: [{ id: 'bc-1', code_hash: hash }] });
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER, mfaPending: true },
			body: { token: 'ZZZZZZZZ' },
		}),
	);
	assert.equal(response.status, 401);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_CODE');
});

test('mfa.verify: 200 MFA_VERIFIED with tokens on valid backup code', async () => {
	const plainCode = generateBackupCodes(1)[0]!;
	const hash = await hashPassword(plainCode);
	const ctrl = makeMfa({
		backupCodeRows: [{ id: 'bc-1', code_hash: hash }],
		userById: MFA_USER,
	});
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER, mfaPending: true },
			body: { token: plainCode },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_VERIFIED');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
});

// ── Setup confirmation branch (user already logged in, confirming setup) ──

test('mfa.verify: 401 INVALID_CODE for wrong TOTP during setup confirmation', async () => {
	const secret = generateTotpSecret();
	const ctrl = makeMfa({ mfaPendingSecret: secret });
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER },
			body: { token: '000000' },
		}),
	);
	assert.equal(response.status, 401);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_CODE');
});

test('mfa.verify: 200 MFA_VERIFIED with mfaEnabled: true on valid TOTP during setup confirmation', async () => {
	const secret = generateTotpSecret();
	const code = generateTotpCode(secret);
	const ctrl = makeMfa({ mfaPendingSecret: secret });
	const response = await ctrl.verify(
		makeCtx({
			user: { ...MFA_USER },
			body: { token: code },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_VERIFIED');
	assert.equal(body.result.mfaEnabled, true);
	assert.equal(body.result.tokens, undefined);
	assert.equal(body.result.user, undefined);
});

// ── OauthController ───────────────────────────────────────────────

const GOOGLE_CONFIG: IAuthConfig = {
	...config,
	providers: ['email', 'google'],
	google: {
		clientId: 'test-client-id',
		clientSecret: 'test-client-secret',
		redirectUri: 'http://localhost/auth/google/callback',
	},
};

function makeOauth(storeOpts: AuthStoreOpts = {}, cfg: IAuthConfig = GOOGLE_CONFIG) {
	return oauthController(makeStore(storeOpts), cfg);
}

function fakeIdToken(payload: object): string {
	const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `header.${encoded}.signature`;
}

function mockFetch(body: object, status = 200) {
	return mock.method(
		globalThis,
		'fetch',
		async () =>
			new Response(JSON.stringify(body), {
				status,
				headers: { 'content-type': 'application/json' },
			}),
	);
}

// ── googleInit ────────────────────────────────────────────────────

test('googleInit: 501 NOT_CONFIGURED when google is not in config', async () => {
	const ctrl = makeOauth({}, config);
	const response = await ctrl.googleInit(makeCtx());
	assert.equal(response.status, 501);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'NOT_CONFIGURED');
});

test('googleInit: 200 GOOGLE_AUTH_URL with OAuth URL in result', async () => {
	const ctrl = makeOauth();
	const response = await ctrl.googleInit(makeCtx());
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'GOOGLE_AUTH_URL');
	assert.ok(body.result.url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
	assert.ok(body.result.url.includes('client_id=test-client-id'));
	assert.ok(body.result.url.includes('redirect_uri='));
	assert.ok(body.result.url.includes('scope='));
	assert.ok(body.result.url.includes('response_type=code'));
});

// ── googleCallback ────────────────────────────────────────────────

test('googleCallback: 501 NOT_CONFIGURED when google is not in config', async () => {
	const ctrl = makeOauth({}, config);
	const response = await ctrl.googleCallback(makeCtx());
	assert.equal(response.status, 501);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'NOT_CONFIGURED');
});

test('googleCallback: 400 INVALID_PARAMETER when code is missing', async () => {
	const ctrl = makeOauth();
	const ctx = makeCtx();
	ctx.request = new Request('http://localhost/auth/google/callback');
	const response = await ctrl.googleCallback(ctx);
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_PARAMETER');
});

test('googleCallback: 400 GOOGLE_AUTH_FAILED when token exchange returns no id_token', async () => {
	const fetchMock = mockFetch({});
	const ctrl = makeOauth();
	const ctx = makeCtx();
	ctx.request = new Request('http://localhost/auth/google/callback?code=test-code');
	const response = await ctrl.googleCallback(ctx);
	fetchMock.mock.restore();
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'GOOGLE_AUTH_FAILED');
});

test('googleCallback: 400 GOOGLE_AUTH_FAILED when id_token has no email', async () => {
	const fetchMock = mockFetch({ id_token: fakeIdToken({ sub: 'google-123' }) });
	const ctrl = makeOauth();
	const ctx = makeCtx();
	ctx.request = new Request('http://localhost/auth/google/callback?code=test-code');
	const response = await ctrl.googleCallback(ctx);
	fetchMock.mock.restore();
	assert.equal(response.status, 400);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'GOOGLE_AUTH_FAILED');
});

test('googleCallback: 500 SERVER_ERROR when upsert returns null', async () => {
	const fetchMock = mockFetch({
		id_token: fakeIdToken({ email: 'jane@example.com', sub: 'google-123' }),
	});
	const ctrl = makeOauth({}); // no insertedId → upsertByProvider returns null
	const ctx = makeCtx();
	ctx.request = new Request('http://localhost/auth/google/callback?code=test-code');
	const response = await ctrl.googleCallback(ctx);
	fetchMock.mock.restore();
	assert.equal(response.status, 500);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'SERVER_ERROR');
});

test('googleCallback: 200 GOOGLE_AUTH_SUCCESS with tokens and user on valid OAuth code', async () => {
	const fetchMock = mockFetch({
		id_token: fakeIdToken({ email: 'jane@example.com', sub: 'google-123' }),
	});
	const ctrl = makeOauth({ insertedId: 'user-1', userById: BASE_USER });
	const ctx = makeCtx();
	ctx.request = new Request('http://localhost/auth/google/callback?code=test-code');
	const response = await ctrl.googleCallback(ctx);
	fetchMock.mock.restore();
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'GOOGLE_AUTH_SUCCESS');
	assert.ok(typeof body.result.tokens.access === 'string');
	assert.ok(typeof body.result.tokens.refresh === 'string');
	assert.equal(body.result.user.id, 'user-1');
	assert.equal(body.result.user.email, 'jane@example.com');
	assert.equal(body.result.user.firstName, 'Jane');
	assert.equal(body.result.user.lastName, 'Doe');
	assert.equal(body.result.user.isEmailVerified, true);
	assert.ok(typeof body.result.user.preferences === 'object');
	assert.ok(response.headers.get('set-cookie')?.includes('access_token='));
	// Google sessions must carry loginMethod: 'google' so MFA routes reject them
	const payload = verifyToken(body.result.tokens.access, config) as any;
	assert.equal(payload?.loginMethod, 'google');
});

test('requireEmailLogin: 403 EMAIL_LOGIN_REQUIRED for google session', async () => {
	const { requireEmailLogin } = await import('../middlewares/require-email-login');
	const ctx = makeCtx({ user: { ...BASE_USER, loginMethod: 'google' as any } });
	const response = await requireEmailLogin(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'EMAIL_LOGIN_REQUIRED');
});

// ── Event bus integration ─────────────────────────────────────────

function makeBus() {
	const emitted: { type: string; payload: unknown }[] = [];
	return Object.assign(
		{
			on: () => {},
			emit: async (type: string, payload: unknown) => {
				emitted.push({ type, payload });
			},
		} as any,
		{ emitted },
	) as {
		emitted: { type: string; payload: unknown }[];
		on: () => void;
		emit: (type: string, payload: unknown) => Promise<void>;
	};
}

test('register (email): emits user.registered with correct payload', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({ insertedId: 'user-1', userById: BASE_USER }, bus);
	await ctrl.register(
		makeCtx({
			body: {
				email: 'jane@example.com',
				password: 'password123',
				firstName: 'Jane',
				lastName: 'Doe',
			},
		}),
	);
	// register emits NOTIFICATION_EVENT + user.registered
	assert.equal(bus.emitted.length, 2);
	const reg = bus.emitted.find((e) => e.type === EVENT_KEYS.userRegistered);
	assert.ok(reg, 'user.registered must be emitted');
	const p = reg!.payload as any;
	assert.equal(p.userId, 'user-1');
	assert.equal(p.loginMethod, 'email');
	assert.equal(p.email, 'jane@example.com');
});

test('register (phone): emits user.registered with loginMethod: phone', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({ insertedId: 'user-2', userById: PHONE_USER }, bus);
	await ctrl.register(makeCtx({ body: { phone: '+15141234567' } }));
	// register emits NOTIFICATION_EVENT + user.registered
	assert.equal(bus.emitted.length, 2);
	const reg = bus.emitted.find((e) => e.type === EVENT_KEYS.userRegistered);
	assert.ok(reg, 'user.registered must be emitted');
	const p = reg!.payload as any;
	assert.equal(p.loginMethod, 'phone');
});

test('deleteMe: emits user.deleted with correct userId', async () => {
	const bus = makeBus();
	const ctrl = userController(makeStore(), config, bus as any);
	await ctrl.deleteMe(makeCtx({ user: { id: 'user-1', email: 'jane@example.com' } }));
	assert.equal(bus.emitted.length, 1);
	assert.equal(bus.emitted[0]?.type, EVENT_KEYS.userDeleted);
	const p = bus.emitted[0]?.payload as any;
	assert.equal(p.userId, 'user-1');
});

test('register: no bus — no error thrown', async () => {
	const ctrl = authController(makeStore({ insertedId: 'user-1', userById: BASE_USER }), config);
	const response = await ctrl.register(
		makeCtx({ body: { email: 'jane@example.com', password: 'password123' } }),
	);
	assert.equal(response.status, 201);
});

// ── NOTIFICATION_EVENT coverage ────────────────────────────────────

test('register (email): emits NOTIFICATION_EVENT with emailRegistration payload', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({ insertedId: 'user-1', userById: BASE_USER }, bus);
	await ctrl.register(
		makeCtx({ body: { email: 'jane@example.com', password: 'password123', firstName: 'Jane' } }),
	);
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.emailRegistration);
	assert.equal(p.recipient.email, 'jane@example.com');
	assert.ok(typeof p.data.pin === 'string');
});

test('register (phone): emits NOTIFICATION_EVENT with phoneOtp payload', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({ insertedId: 'user-2', userById: PHONE_USER }, bus);
	await ctrl.register(makeCtx({ body: { phone: '+15141234567' } }));
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.phoneOtp);
	assert.equal(p.recipient.phone, '+15141234567');
	assert.ok(typeof p.data.otp === 'string');
});

test('login (phone): emits NOTIFICATION_EVENT with phoneOtp payload', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({ userByPhone: PHONE_USER }, bus);
	await ctrl.login(makeCtx({ body: { phone: '+15141234567' } }));
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.phoneOtp);
	assert.equal(p.recipient.phone, '+15141234567');
});

test('forgotPassword: emits NOTIFICATION_EVENT with passwordReset payload', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({ userByEmail: BASE_USER }, bus);
	await ctrl.forgotPassword(makeCtx({ body: { email: 'jane@example.com' } }));
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.passwordReset);
	assert.equal(p.recipient.email, 'jane@example.com');
	assert.ok(typeof p.data.pin === 'string');
});

test('sendVerification (email): emits NOTIFICATION_EVENT with emailVerification payload', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({}, bus);
	const unverified = { ...BASE_USER, emailVerifiedAt: null };
	await ctrl.sendVerification(makeCtx({ user: unverified }));
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.emailVerification);
	assert.equal(p.recipient.email, 'jane@example.com');
});

test('sendVerification (phone): emits NOTIFICATION_EVENT with phoneOtp payload', async () => {
	const bus = makeBus();
	const ctrl = makeAuth({}, bus);
	await ctrl.sendVerification(
		makeCtx({
			user: { ...PHONE_USER, loginMethod: 'phone', phoneVerified: false },
		}),
	);
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.phoneOtp);
	assert.equal(p.recipient.phone, '+15141234567');
});

test('mfa.verify (setup confirm): emits NOTIFICATION_EVENT with mfaEnabled payload', async () => {
	const secret = generateTotpSecret();
	const code = generateTotpCode(secret);
	const bus = makeBus();
	const ctrl = makeMfa({ mfaPendingSecret: secret }, bus);
	await ctrl.verify(makeCtx({ user: { ...MFA_USER }, body: { token: code } }));
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.mfaEnabled);
	assert.equal(p.recipient.email, 'jane@example.com');
});

test('mfa.regenerateBackupCodes: emits NOTIFICATION_EVENT with mfaBackupCodesRegenerated payload', async () => {
	const secret = generateTotpSecret();
	const code = generateTotpCode(secret);
	const bus = makeBus();
	const ctrl = makeMfa({ mfaSecret: secret }, bus);
	await ctrl.regenerateBackupCodes(makeCtx({ user: MFA_USER, body: { token: code } }));
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.mfaBackupCodesRegenerated);
	assert.equal(p.recipient.email, 'jane@example.com');
});

test('mfa.disable: 200 MFA_DISABLED and emits NOTIFICATION_EVENT with mfaDisabled payload', async () => {
	const secret = generateTotpSecret();
	const code = generateTotpCode(secret);
	const bus = makeBus();
	const ctrl = makeMfa({ userById: { ...MFA_USER, mfaSecret: secret } as any }, bus);
	const response = await ctrl.disable(makeCtx({ user: MFA_USER, body: { token: code } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'MFA_DISABLED');
	const notif = bus.emitted.find((e) => e.type === NOTIFICATION_EVENT);
	assert.ok(notif, 'NOTIFICATION_EVENT must be emitted');
	const p = notif!.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.mfaDisabled);
	assert.equal(p.recipient.email, 'jane@example.com');
});

// ── requireVerification config flag ──────────────────────────────

test('updateProfile: succeeds without email verification when requireVerification is false (default)', async () => {
	const updated  = { ...BASE_USER, firstName: 'Janet' };
	const ctrl     = makeUser({ updateRow: { id: 'user-1' }, userById: updated });
	// user has no emailVerifiedAt — would fail if requireVerified were enforced
	const unverified = { ...BASE_USER, emailVerifiedAt: null };
	const response = await ctrl.updateProfile(makeCtx({
		user: { id: 'user-1', email: 'jane@example.com' },
		body: { firstName: 'Janet' },
	}));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'PROFILE_UPDATED');
});

test('buildAuthRoutes: verifyGate is a no-op when requireVerification is false', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const stub: any = {
		query: async () => [],
		transaction: async (fn: any) => fn(stub),
	};
	const routes = buildAuthRoutes(stub, { ...config, requireVerification: false });
	const profileRoute = routes.find(([, path]) => path === '/users/profile');
	assert.ok(profileRoute);

	// Route shape: [method, path, requireAuth, verifyGate, validate, controller]
	const verifyGate = profileRoute[3] as any;
	let nextCalled = false;
	const unverifiedCtx = makeCtx({ user: { ...BASE_USER, emailVerifiedAt: null } });
	await verifyGate(unverifiedCtx, async () => { nextCalled = true; return new Response(); });
	assert.ok(nextCalled, 'verifyGate must call next when requireVerification is false');
});

test('buildAuthRoutes: verifyGate blocks unverified users when requireVerification is true', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const stub: any = {
		query: async () => [],
		transaction: async (fn: any) => fn(stub),
	};
	const routes = buildAuthRoutes(stub, { ...config, requireVerification: true });
	const profileRoute = routes.find(([, path]) => path === '/users/profile');
	assert.ok(profileRoute);

	// Route shape: [method, path, requireAuth, verifyGate, validate, controller]
	const verifyGate = profileRoute[3] as any;
	const unverifiedCtx = makeCtx({ user: { ...BASE_USER, emailVerifiedAt: null, loginMethod: 'email' } });
	const response = await verifyGate(unverifiedCtx, async () => new Response());
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'EMAIL_NOT_VERIFIED');
});

// ── validate() middleware + request schemas ─────────────────────────

test('validate: rejects registration with a weak password', async () => {
	const { validate } = await import('../middlewares/validate');
	const { registerSchema } = await import('../schemas');
	const mw = validate(registerSchema);
	const res = await mw(
		makeCtx({ body: { email: 'jane@example.com', password: 'short' } }),
		async () => new Response(),
	);
	assert.equal(res.status, 422);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'INVALID_PARAMETER');
});

test('validate: rejects registration with a malformed email', async () => {
	const { validate } = await import('../middlewares/validate');
	const { registerSchema } = await import('../schemas');
	const mw = validate(registerSchema);
	const res = await mw(
		makeCtx({ body: { email: 'not-an-email', password: 'longenough123' } }),
		async () => new Response(),
	);
	assert.equal(res.status, 422);
});

test('validate: rejects oversized passwords before they reach bcrypt', async () => {
	const { validate } = await import('../middlewares/validate');
	const { registerSchema } = await import('../schemas');
	const mw = validate(registerSchema);
	const res = await mw(
		makeCtx({ body: { email: 'jane@example.com', password: 'x'.repeat(4096) } }),
		async () => new Response(),
	);
	assert.equal(res.status, 422);
});

test('validate: passes clean registration through with parsed body', async () => {
	const { validate } = await import('../middlewares/validate');
	const { registerSchema } = await import('../schemas');
	const mw = validate(registerSchema);
	const ctx = makeCtx({
		body: { email: '  jane@example.com  ', password: 'longenough123', junk: 'stripped' },
	});
	let nextCalled = false;
	const res = await mw(ctx, async () => { nextCalled = true; return new Response(); });
	assert.ok(nextCalled);
	assert.equal(res.status, 200);
	const parsed = ctx.meta.body as Record<string, unknown>;
	assert.equal(parsed.email, 'jane@example.com'); // trimmed
	assert.equal('junk' in parsed, false); // unknown keys stripped
});

test('validate: reset requires a 6-digit pin', async () => {
	const { validate } = await import('../middlewares/validate');
	const { resetPasswordSchema } = await import('../schemas');
	const mw = validate(resetPasswordSchema);
	const bad = await mw(
		makeCtx({ body: { pin: 'abc123', password: 'longenough123' } }),
		async () => new Response(),
	);
	assert.equal(bad.status, 422);
	const ok = await mw(
		makeCtx({ body: { pin: ' 123456 ', password: 'longenough123' } }),
		async () => new Response(),
	);
	assert.equal(ok.status, 200);
});

test('validate: profile update requires at least one field', async () => {
	const { validate } = await import('../middlewares/validate');
	const { updateProfileSchema } = await import('../schemas');
	const mw = validate(updateProfileSchema);
	const res = await mw(makeCtx({ body: {} }), async () => new Response());
	assert.equal(res.status, 422);
});

test('validate: registration via phone branch accepts E.164 with separators', async () => {
	const { validate } = await import('../middlewares/validate');
	const { registerSchema } = await import('../schemas');
	const mw = validate(registerSchema);
	const ok = await mw(
		makeCtx({ body: { phone: '+1 (628) 555-0136' } }),
		async () => new Response(),
	);
	assert.equal(ok.status, 200);
	const bad = await mw(makeCtx({ body: { phone: '012' } }), async () => new Response());
	assert.equal(bad.status, 422);
});

// ── security patch: cookie Secure attribute + enumeration-safe cooldown ──

test('cookies carry Secure when secureCookies is true, never when false', async () => {
	const { tokenPairCookies, clearedTokenCookies } = await import('../services/cookies');
	const on = tokenPairCookies('a', 'r', { ...config, secureCookies: true });
	const off = tokenPairCookies('a', 'r', { ...config, secureCookies: false });
	assert.ok(/access_token=a; HttpOnly; SameSite=Strict; Path=\/; Secure/.test(on));
	assert.ok(/refresh_token=r; HttpOnly; SameSite=Strict; Path=\/auth\/refresh; Secure/.test(on));
	assert.ok(!off.includes('Secure'));
	assert.ok(clearedTokenCookies({ ...config, secureCookies: true }).match(/Max-Age=0; Secure/));
});

test('cookies default Secure from NODE_ENV=production', async () => {
	const { tokenPairCookies } = await import('../services/cookies');
	const prev = process.env.NODE_ENV;
	process.env.NODE_ENV = 'production';
	try {
		assert.ok(tokenPairCookies('a', 'r', config).includes('; Secure'));
	} finally {
		if (prev === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = prev;
	}
});

test('login sets Secure cookies when configured', async () => {
	const { hashPassword } = await import('../services/password');
	const user = { ...BASE_USER, passwordHash: await hashPassword('longenough123') };
	const ctrl = authController(
		makeStore({ userByEmail: user }),
		{ ...config, secureCookies: true },
	);
	const res = await ctrl.login(makeCtx({ body: { email: BASE_USER.email, password: 'longenough123' } }));
	assert.equal(res.status, 200);
	const setCookie = res.headers.get('Set-Cookie') ?? '';
	assert.ok(setCookie.includes('; Secure'), 'login cookies must carry Secure');
});

test('forgotPassword within cooldown returns the same envelope as unknown email', async () => {
	// resetLastSentAt = now → cooldown active for the known account
	const knownStore = makeStore({ userByEmail: { ...BASE_USER }, resetLastSentAt: new Date() });
	const unknownStore = makeStore({ userByEmail: null });
	const knownCtrl = authController(knownStore, config);
	const unknownCtrl = authController(unknownStore, config);

	const known = await knownCtrl.forgotPassword(makeCtx({ body: { email: BASE_USER.email } }));
	const unknown = await unknownCtrl.forgotPassword(makeCtx({ body: { email: 'ghost@example.com' } }));

	assert.equal(known.status, 200);
	assert.equal(known.status, unknown.status);
	const kb = (await known.json()) as any;
	const ub = (await unknown.json()) as any;
	assert.equal(kb.reason, ub.reason);
	assert.equal(kb.reason, 'PASSWORD_RESET_EMAIL_SENT');
	assert.equal('retryAfter' in (kb.result ?? {}), false);
});

// ── brute-force protection: on by default ─────────────────────────

test('rate limit: 6th login attempt for one account 429s out of the box', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const { MemoryStore } = await import('@fonderie/rate-limit');
	const routes = buildAuthRoutes(makeStore(), { ...config, rateLimit: { store: new MemoryStore() } });
	const login = routes.find(([m, p]) => m === 'POST' && p === '/auth/login');
	assert.ok(login);
	// Route shape: [method, path, ipLimit, validate, accountLimit, controller].
	// The per-account limiter (capacity 5) runs AFTER validation; exercise it.
	const accountLimit = (login as any[])[4];

	let last: Response = new Response();
	for (let i = 0; i < 6; i++) {
		last = await accountLimit(
			// no client IP → the IP phase is irrelevant; this is the account bucket
			makeCtx({ body: { email: 'target@example.com', password: 'x'.repeat(10) } }),
			async () => new Response('ok'),
		);
	}
	assert.equal(last.status, 429);
	const body = (await last.json()) as any;
	assert.equal(body.reason, 'RATE_LIMITED');
	assert.ok(last.headers.get('Retry-After'));
});

test('rate limit: IP phase (before validation) sheds a flood from one IP', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const { MemoryStore } = await import('@fonderie/rate-limit');
	const routes = buildAuthRoutes(makeStore(), { ...config, rateLimit: { store: new MemoryStore() } });
	const login = routes.find(([m, p]) => m === 'POST' && p === '/auth/login');
	const ipLimit = (login as any[])[2]; // login IP capacity = 10
	let last: Response = new Response();
	for (let i = 0; i < 11; i++) {
		last = await ipLimit(makeCtx({ ip: '203.0.113.50' }), async () => new Response('ok'));
	}
	assert.equal(last.status, 429);
});

test('rate limit: account bucket bites even as the attacker rotates IPs', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const { MemoryStore } = await import('@fonderie/rate-limit');
	const routes = buildAuthRoutes(makeStore(), { ...config, rateLimit: { store: new MemoryStore() } });
	const login = routes.find(([m, p]) => m === 'POST' && p === '/auth/login');
	const accountLimit = (login as any[])[4];
	let last: Response = new Response();
	for (let i = 0; i < 6; i++) {
		last = await accountLimit(
			makeCtx({ ip: `10.0.0.${i}`, body: { email: 'victim@example.com' } }),
			async () => new Response('ok'),
		);
	}
	assert.equal(last.status, 429, 'per-account limit is IP-independent');
});

test('rate limit: rateLimit: false disables it', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const routes = buildAuthRoutes(makeStore(), { ...config, rateLimit: false });
	const login = routes.find(([m, p]) => m === 'POST' && p === '/auth/login');
	const [, , maybeLimiter] = login as any[];
	// with rateLimit disabled the first middleware is the passthrough; hammer it
	for (let i = 0; i < 20; i++) {
		const res = await maybeLimiter(
			makeCtx({ body: { email: 'target@example.com', password: 'x'.repeat(10) } }),
			async () => new Response('ok'),
		);
		assert.equal(res.status, 200);
	}
});

test('rate limit: per-route override can relax a single rule', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const { MemoryStore } = await import('@fonderie/rate-limit');
	const routes = buildAuthRoutes(makeStore(), {
		...config,
		rateLimit: { store: new MemoryStore(), rules: { login: { capacity: 2, refillPerSec: 0.001 } } },
	});
	const login = routes.find(([m, p]) => m === 'POST' && p === '/auth/login');
	const [, , limiter] = login as any[];
	const hit = () =>
		limiter(makeCtx({ ip: '9.9.9.9', body: { email: 'a@b.c', password: 'x'.repeat(10) } }), async () => new Response('ok'));
	assert.equal((await hit()).status, 200);
	assert.equal((await hit()).status, 200);
	assert.equal((await hit()).status, 429);
});
