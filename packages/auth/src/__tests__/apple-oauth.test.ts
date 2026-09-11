import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';

import type { IAuthConfig } from '../config';
import { collectAuthConfigProblems } from '../services/config-guard';
import { appleNativeSchema } from '../schemas';
import { mintAppleClientSecret, verifyAppleIdToken } from '../controllers/oauth.controller';

const APPLE_ISSUER = 'https://appleid.apple.com';

const baseConfig: IAuthConfig = {
	jwtSecret: 'unit-test-jwt-secret-000000000000000',
	sessionDuration: '7d',
	providers: ['email'],
};

// A full, well-formed apple config (dummy EC key generated below where needed).
const appleConfig = (over: Partial<NonNullable<IAuthConfig['apple']>> = {}) => ({
	clientId: 'com.example.services',
	teamId: 'TEAM123456',
	keyId: 'KEY1234567',
	privateKey: '-----BEGIN PRIVATE KEY-----\nMIGdummy\n-----END PRIVATE KEY-----',
	redirectUri: 'https://app.example.com/auth/apple/callback',
	...over,
});

// ── Route registration ───────────────────────────────────────────────────────

test('buildAuthRoutes: apple provider registers init + form_post callback + native', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const stub: any = { query: async () => [], transaction: async (fn: any) => fn(stub) };
	const routes = buildAuthRoutes(stub, {
		...baseConfig,
		providers: ['email', 'apple'],
		apple: appleConfig(),
	});

	const init = routes.find(([m, p]) => m === 'GET' && p === '/auth/apple');
	const cb = routes.find(([m, p]) => m === 'POST' && p === '/auth/apple/callback');
	const native = routes.find(([m, p]) => m === 'POST' && p === '/auth/apple/native');

	assert.ok(init, 'GET /auth/apple present');
	assert.ok(cb, 'POST /auth/apple/callback present (form_post)');
	assert.ok(native, 'POST /auth/apple/native present');
	// native shape: [method, path, ipLimit, validate, controller]
	assert.equal(native!.slice(2).length, 3, 'native carries ipLimit + validate + controller');
});

test('buildAuthRoutes: no apple routes unless the provider is enabled', async () => {
	const { buildAuthRoutes } = await import('../routes');
	const stub: any = { query: async () => [], transaction: async (fn: any) => fn(stub) };
	const routes = buildAuthRoutes(stub, baseConfig); // providers: ['email']
	assert.ok(!routes.some(([, p]) => p.startsWith('/auth/apple')), 'no apple routes when not enabled');
});

// ── Config guard ─────────────────────────────────────────────────────────────

test('collectAuthConfigProblems: apple missing a field is a boot-blocking error', () => {
	const problems = collectAuthConfigProblems({
		...baseConfig,
		apple: appleConfig({ teamId: '' }),
	});
	const apple = problems.find((p) => p.message.includes('apple OAuth is configured'));
	assert.ok(apple, 'missing teamId flagged');
	assert.equal(apple!.severity, 'error');
});

test('collectAuthConfigProblems: apple.privateKey that is not a PEM is an error', () => {
	const problems = collectAuthConfigProblems({
		...baseConfig,
		apple: appleConfig({ privateKey: 'not-a-pem-key' }),
	});
	const apple = problems.find((p) => p.message.includes('does not look like a PEM'));
	assert.ok(apple, 'non-PEM key flagged');
	assert.equal(apple!.severity, 'error');
});

test('collectAuthConfigProblems: a complete apple config raises no apple problem', () => {
	const problems = collectAuthConfigProblems({ ...baseConfig, apple: appleConfig() });
	assert.ok(!problems.some((p) => p.message.toLowerCase().includes('apple')), 'no apple problems');
});

// ── Native request schema ────────────────────────────────────────────────────

test('appleNativeSchema: accepts an identityToken (+ optional nonce), rejects junk', () => {
	assert.ok(appleNativeSchema.safeParse({ identityToken: 'a.b.c' }).success);
	assert.ok(appleNativeSchema.safeParse({ identityToken: 'a.b.c', nonce: 'n1' }).success);
	assert.ok(!appleNativeSchema.safeParse({}).success, 'missing identityToken rejected');
	assert.ok(!appleNativeSchema.safeParse({ identityToken: '' }).success, 'empty rejected');
	assert.ok(
		!appleNativeSchema.safeParse({ identityToken: 'x'.repeat(9000) }).success,
		'oversized rejected',
	);
});

// ── Client secret minting (ES256) ────────────────────────────────────────────

test('mintAppleClientSecret: is an ES256 JWT with the Apple claim shape', () => {
	const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
	const secret = mintAppleClientSecret(
		appleConfig({
			privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
			keyId: 'KEYABCDEFG',
			teamId: 'TEAMXYZ123',
			clientId: 'com.example.services',
		}),
	);
	// Header carries the kid + ES256; signature verifies against the public key.
	const header = JSON.parse(Buffer.from(secret.split('.')[0]!, 'base64url').toString());
	assert.equal(header.alg, 'ES256');
	assert.equal(header.kid, 'KEYABCDEFG');
	const claims = jwt.verify(secret, publicKey, {
		algorithms: ['ES256'],
		issuer: 'TEAMXYZ123',
		audience: APPLE_ISSUER,
	}) as { sub: string };
	assert.equal(claims.sub, 'com.example.services', 'sub is the Services ID');
});

// ── id_token verification (the security-critical native path) ────────────────

// Sign an Apple-shaped id_token and stub the JWKS endpoint with the matching
// public key, so verifyAppleIdToken's real signature check runs offline.
function makeSignedIdToken(
	signWith: KeyObject,
	kid: string,
	claims: Record<string, unknown>,
	opts: { audience: string; issuer?: string; expiresIn?: SignOptions['expiresIn'] } = { audience: 'com.example.app' },
): string {
	return jwt.sign(claims, signWith, {
		algorithm: 'RS256',
		keyid: kid,
		issuer: opts.issuer ?? APPLE_ISSUER,
		audience: opts.audience,
		expiresIn: opts.expiresIn ?? '5m',
	});
}

async function withStubbedJwks(jwk: Record<string, unknown>, fn: () => Promise<void>) {
	const orig = globalThis.fetch;
	globalThis.fetch = (async () => ({ json: async () => ({ keys: [jwk] }) })) as unknown as typeof fetch;
	try {
		await fn();
	} finally {
		globalThis.fetch = orig;
	}
}

test('verifyAppleIdToken: accepts a correctly-signed token and returns claims', async () => {
	const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'apple-good', alg: 'RS256', use: 'sig' };
	const token = makeSignedIdToken(privateKey, 'apple-good', {
		email: 'user@example.com',
		email_verified: true,
		sub: 'apple-sub-1',
	});
	await withStubbedJwks(jwk, async () => {
		const claims = await verifyAppleIdToken(token, { audiences: ['com.example.app'] });
		assert.ok(claims, 'valid token accepted');
		assert.equal(claims!.email, 'user@example.com');
		assert.equal(claims!.sub, 'apple-sub-1');
	});
});

test('verifyAppleIdToken: rejects a token minted for a different audience', async () => {
	const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'apple-aud', alg: 'RS256', use: 'sig' };
	const token = makeSignedIdToken(privateKey, 'apple-aud', { email: 'u@example.com', email_verified: true }, {
		audience: 'com.someone.else',
	});
	await withStubbedJwks(jwk, async () => {
		assert.equal(await verifyAppleIdToken(token, { audiences: ['com.example.app'] }), null);
	});
});

test('verifyAppleIdToken: rejects an expired token', async () => {
	const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'apple-exp', alg: 'RS256', use: 'sig' };
	const token = makeSignedIdToken(
		privateKey,
		'apple-exp',
		{ email: 'u@example.com', email_verified: true },
		{ audience: 'com.example.app', expiresIn: '-1m' },
	);
	await withStubbedJwks(jwk, async () => {
		assert.equal(await verifyAppleIdToken(token, { audiences: ['com.example.app'] }), null);
	});
});

test('verifyAppleIdToken: rejects a token signed by the wrong key (forgery)', async () => {
	// Advertise one public key in the JWKS, but sign the token with a DIFFERENT
	// private key under the same kid — the signature must fail.
	const advertised = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const jwk = { ...(advertised.publicKey.export({ format: 'jwk' }) as object), kid: 'apple-forge', alg: 'RS256', use: 'sig' };
	const token = makeSignedIdToken(attacker.privateKey, 'apple-forge', {
		email: 'attacker@example.com',
		email_verified: true,
	});
	await withStubbedJwks(jwk, async () => {
		assert.equal(await verifyAppleIdToken(token, { audiences: ['com.example.app'] }), null);
	});
});

test('verifyAppleIdToken: enforces nonce round-trip when one is expected', async () => {
	const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: 'apple-nonce', alg: 'RS256', use: 'sig' };
	const token = makeSignedIdToken(privateKey, 'apple-nonce', {
		email: 'u@example.com',
		email_verified: true,
		nonce: 'expected-nonce',
	});
	await withStubbedJwks(jwk, async () => {
		assert.ok(await verifyAppleIdToken(token, { audiences: ['com.example.app'], nonce: 'expected-nonce' }));
		assert.equal(
			await verifyAppleIdToken(token, { audiences: ['com.example.app'], nonce: 'WRONG' }),
			null,
			'nonce mismatch rejected',
		);
	});
});
