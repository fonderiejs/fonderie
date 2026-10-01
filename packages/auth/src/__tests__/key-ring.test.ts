import { test } from 'node:test';
import assert from 'node:assert/strict';

import jwt from 'jsonwebtoken';

import type { IAuthConfig } from '../config';
import { collectAuthConfigProblems } from '../services/config-guard';
import { issueTokenPair, keyIdOf, verifyToken } from '../services/jwt';

// Long, random-looking, low-entropy test secrets (no placeholder words).
const OLD = 'q'.repeat(20) + 'w'.repeat(20);
const NEW = 'z'.repeat(20) + 'x'.repeat(20);
const config = (jwtSecret: string, jwtPreviousSecrets?: string[]) =>
	({ jwtSecret, ...(jwtPreviousSecrets ? { jwtPreviousSecrets } : {}) }) as IAuthConfig;
const header = (token: string) => (jwt.decode(token, { complete: true }) as { header: { kid?: string } }).header;

test('tokens carry the key id of the secret that signed them', () => {
	const { accessToken, refreshToken } = issueTokenPair('u1', config(NEW), { loginMethod: 'email' });
	assert.equal(header(accessToken).kid, keyIdOf(NEW));
	assert.equal(header(refreshToken).kid, keyIdOf(NEW));
	assert.equal(keyIdOf(NEW).length, 16);
	assert.notEqual(keyIdOf(NEW), keyIdOf(OLD));
});

// The 2026-09-30 incident: rotating the secret signed every user out.
test('rotation signs nobody out: a token signed with the old secret still verifies while it is a previous secret', () => {
	const { accessToken } = issueTokenPair('u1', config(OLD), { loginMethod: 'email' });
	assert.equal(verifyToken(accessToken, config(NEW))?.sub, undefined, 'without the old key: refused');
	assert.equal(verifyToken(accessToken, config(NEW, [OLD]))?.sub, 'u1', 'old key kept as previous: accepted');
	const fresh = issueTokenPair('u1', config(NEW, [OLD]), { loginMethod: 'email' });
	assert.equal(header(fresh.accessToken).kid, keyIdOf(NEW), 'new tokens use the new key');
});

test('removing the old secret ends its tokens', () => {
	const { refreshToken } = issueTokenPair('u1', config(OLD), { loginMethod: 'email' });
	assert.equal(verifyToken(refreshToken, config(NEW, [OLD]))?.type, 'refresh');
	assert.equal(verifyToken(refreshToken, config(NEW)), null);
});

test('a token issued before key ids (no kid) is tried against every key', () => {
	const legacy = jwt.sign({ sub: 'u1', type: 'access', loginMethod: 'email', phoneVerified: false }, OLD, { expiresIn: '1h' });
	assert.equal(header(legacy).kid, undefined);
	assert.equal(verifyToken(legacy, config(NEW, [OLD]))?.sub, 'u1');
	assert.equal(verifyToken(legacy, config(NEW)), null);
});

test('a kid names exactly one key: an unknown kid, or a kid that does not match the signature, is refused', () => {
	const unknownKid = jwt.sign({ sub: 'u1', type: 'access' }, NEW, { expiresIn: '1h', keyid: '0000000000000000' });
	assert.equal(verifyToken(unknownKid, config(NEW, [OLD])), null);
	const lyingKid = jwt.sign({ sub: 'u1', type: 'access' }, OLD, { expiresIn: '1h', keyid: keyIdOf(NEW) });
	assert.equal(verifyToken(lyingKid, config(NEW, [OLD])), null, 'claims the new key, signed with the old');
});

test('an expired token is refused whichever key signed it', () => {
	const expired = jwt.sign({ sub: 'u1', type: 'access' }, OLD, { expiresIn: -10, keyid: keyIdOf(OLD) });
	assert.equal(verifyToken(expired, config(NEW, [OLD])), null);
});

test('readiness: a weak previous secret is an error (it still verifies tokens); strong ones pass', () => {
	const weak = collectAuthConfigProblems(config(NEW, [OLD, 'short']));
	const found = weak.filter((p) => p.reason === 'JWT_PREVIOUS_SECRET_WEAK');
	assert.equal(found.length, 1);
	assert.equal(found[0]?.severity, 'error');
	assert.deepEqual(found[0]?.metadata, { index: 1 });
	assert.equal(collectAuthConfigProblems(config(NEW, [OLD])).filter((p) => p.reason === 'JWT_PREVIOUS_SECRET_WEAK').length, 0);
});
