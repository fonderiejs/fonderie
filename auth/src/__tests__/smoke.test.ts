import { test } from 'node:test';
import assert   from 'node:assert/strict';

import type { IStoreAdapter }                from '@fonderie-js/store';

import type { IAuthConfig }                   from '../config';
import { issueTokenPair, verifyToken }       from '../services/jwt';
import { generateTotpSecret, verifyTotpToken } from '../services/mfa';
import { hashPassword, verifyPassword }      from '../services/password';

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
	assert.notEqual(a, b);   // bcrypt salts — same input, different hash
});

// ── jwt ─────────────────────────────────────────────────────────

test('jwt: access token round-trip', () => {
	const { accessToken } = issueTokenPair('user-123', config);
	const payload         = verifyToken(accessToken, config);
	assert.ok(payload);
	assert.equal(payload?.sub,  'user-123');
	assert.equal(payload?.type, 'access');
});

test('jwt: refresh token round-trip', () => {
	const { refreshToken } = issueTokenPair('user-456', config);
	const payload          = verifyToken(refreshToken, config);
	assert.ok(payload);
	assert.equal(payload?.sub,  'user-456');
	assert.equal(payload?.type, 'refresh');
});

test('jwt: tampered token is rejected', () => {
	const { accessToken } = issueTokenPair('user-789', config);
	const tampered        = accessToken.slice(0, -4) + 'xxxx';
	const payload         = verifyToken(tampered, config);
	assert.equal(payload, null);
});

test('jwt: token signed with wrong secret is rejected', () => {
	const other   = issueTokenPair('user-000', { ...config, jwtSecret: 'other-secret-min-32-chars-long!!' });
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
