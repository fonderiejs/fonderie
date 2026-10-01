import { test } from 'node:test';
import assert from 'node:assert/strict';

import jwt from 'jsonwebtoken';

import type { IAuthConfig } from '../config';
import { durationMs, issueTokenPair } from '../services/jwt';

const SECRET = 'r'.repeat(20) + 't'.repeat(20);
const claims = (t: string) => jwt.decode(t) as { iat: number; exp: number; auth_time?: number };

test('defaults (Phase 3): access tokens live 1 h, a session 90 days idle', () => {
	const { accessToken, refreshToken } = issueTokenPair('u1', { jwtSecret: SECRET } as IAuthConfig, { loginMethod: 'email' });
	const a = claims(accessToken);
	const r = claims(refreshToken);
	assert.equal(a.exp - a.iat, 3600);
	assert.equal(r.exp - r.iat, 90 * 86400);
});

test('configured lifetimes still win', () => {
	const { accessToken, refreshToken } = issueTokenPair('u1', { jwtSecret: SECRET, accessTokenDuration: '15m', sessionDuration: '30d' } as IAuthConfig, { loginMethod: 'email' });
	assert.equal(claims(accessToken).exp - claims(accessToken).iat, 900);
	assert.equal(claims(refreshToken).exp - claims(refreshToken).iat, 30 * 86400);
});

test('auth_time: a sign-in sets it to now; a refresh carries the original', () => {
	const now = Math.floor(Date.now() / 1000);
	const signIn = issueTokenPair('u1', { jwtSecret: SECRET } as IAuthConfig, { loginMethod: 'email' });
	assert.ok(Math.abs((claims(signIn.accessToken).auth_time ?? 0) - now) <= 2);
	const carried = issueTokenPair('u1', { jwtSecret: SECRET } as IAuthConfig, { loginMethod: 'email', authTime: now - 86400 });
	assert.equal(claims(carried.accessToken).auth_time, now - 86400);
	assert.equal(claims(carried.refreshToken).auth_time, now - 86400);
});

test('durationMs reads jsonwebtoken-style durations', () => {
	assert.equal(durationMs('90d'), 90 * 864e5);
	assert.equal(durationMs('12h'), 12 * 36e5);
	assert.equal(durationMs('30m'), 30 * 6e4);
	assert.equal(durationMs('2w'), 2 * 6048e5);
	assert.equal(durationMs('1y'), 31_557_600_000);
	assert.equal(durationMs('45'), 45_000, 'a bare number is seconds, as in jsonwebtoken');
	assert.equal(durationMs(undefined), null);
	assert.equal(durationMs('soon'), null);
});
