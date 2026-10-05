import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { getMigrationsPath } from '../migrations';
import { AdminModule } from '../module';
import {
	base32Encode,
	hashPassword,
	hotp,
	newBackupCodes,
	passwordProblem,
	secretBox,
	totpCounter,
	verifyPassword,
	verifyTotp,
} from '../operators/crypto';
import { needsStepUp, resetAttemptLimits } from '../operators/http';

// ── primitives (no database) ─────────────────────────────────────────────

test('TOTP: RFC 6238 SHA-1 vector, drift window, replay guard', () => {
	const secret = base32Encode(Buffer.from('12345678901234567890'));
	// RFC 6238 Appendix B: T=59s ⇒ 94287082 (8 digits) ⇒ 287082 at 6.
	assert.equal(hotp(secret, 1), '287082');
	assert.equal(verifyTotp(secret, '287082', null, 59_000), 1);
	assert.equal(verifyTotp(secret, '287 082', null, 59_000), 1, 'spaces are tolerated');
	assert.equal(
		verifyTotp(secret, '287082', 1, 59_000),
		null,
		'a used time-step is refused (replay)',
	);
	assert.equal(verifyTotp(secret, '287082', null, 59_000 + 90_000), null, 'outside ±1 step');
	assert.equal(verifyTotp(secret, '28708', null, 59_000), null);
});

test('passwords: scrypt round-trip, wrong password, policy', async () => {
	const h = await hashPassword('correct horse battery');
	assert.match(h, /^scrypt\$32768\$8\$1\$/);
	assert.equal(await verifyPassword('correct horse battery', h), true);
	assert.equal(await verifyPassword('correct horse batterx', h), false);
	assert.equal(await verifyPassword('x', 'not-a-hash'), false);
	assert.ok(passwordProblem('short'));
	assert.ok(passwordProblem('aaaaaaaaaaaaaaaa'));
	assert.equal(passwordProblem('a perfectly fine passphrase'), null);
});

test('secretBox: sealed at rest with a key, passthrough without, wrong key length refused', () => {
	const key = 'ab'.repeat(32);
	const box = secretBox(key);
	const sealed = box.seal('JBSWY3DPEHPK3PXP');
	assert.notEqual(sealed, 'JBSWY3DPEHPK3PXP');
	assert.equal(box.open(sealed), 'JBSWY3DPEHPK3PXP');
	assert.equal(secretBox(undefined).seal('X'), 'X');
	assert.throws(() => secretBox('abcd'), /64 hex/);
});

test('backup codes: ten, distinct, readable groups', () => {
	const codes = newBackupCodes();
	assert.equal(codes.length, 10);
	assert.equal(new Set(codes).size, 10);
	for (const c of codes) assert.match(c, /^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
});

test('step-up: dangerous writes only', () => {
	assert.equal(
		needsStepUp('GET', '/_admin/secrets', 'secrets'),
		false,
		'listing masked secrets is a read',
	);
	assert.equal(needsStepUp('POST', '/_admin/secrets/K/reveal', 'secrets'), true);
	assert.equal(needsStepUp('POST', '/_admin/access/tokens', 'root'), true);
	assert.equal(needsStepUp('DELETE', '/_admin/config/K', 'write'), true);
	assert.equal(needsStepUp('POST', '/_admin/migrations/app/apply', 'write'), true);
	assert.equal(needsStepUp('PUT', '/_admin/config/K', 'write'), false, 'an ordinary edit is not');
});

test('checkReadiness: no operatorKey is a supported setup; a malformed key is an error', () => {
	const store = {
		query: async () => [],
		transaction: async () => undefined,
	} as unknown as IStoreAdapter;
	const TOKEN = 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb';
	assert.deepEqual(
		new AdminModule({ adminToken: TOKEN, store }).checkReadiness(),
		[],
		'zero config: no extra env var to set',
	);
	assert.equal(
		new AdminModule({ adminToken: TOKEN, store, operatorKey: 'nope' }).checkReadiness()[0]
			?.severity,
		'error',
	);
	assert.deepEqual(
		new AdminModule({ adminToken: TOKEN, store, operatorKey: 'ab'.repeat(32) }).checkReadiness(),
		[],
	);
	assert.deepEqual(
		new AdminModule({ adminToken: TOKEN, store, operators: false }).checkReadiness(),
		[],
	);
});

// ── the sign-in flows, against a real Postgres ──────────────────────────
// Locks, conditional updates, array_remove and single-use links are
// behaviours of the database; a mocked store would only prove itself.
//
//   ADMIN_PG_URL=postgres://... npm test -w @fonderie/admin

const PG_URL = process.env['ADMIN_PG_URL'];
const skip = PG_URL ? false : 'set ADMIN_PG_URL to run';

const ROOT = 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb';
const EMAIL = 'ada@example.com';
const PASSWORD = 'a long enough passphrase';

let store: IStoreAdapter & { close?: () => Promise<void> };
let app: FonderieApp;

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	const dir = getMigrationsPath();
	for (const f of readdirSync(dir)
		.filter((x) => x.endsWith('.sql'))
		.sort()) {
		await store.query(readFileSync(join(dir, f), 'utf8'));
	}
	await store.query(
		'TRUNCATE fonderie_admin_invites, fonderie_admin_sessions, fonderie_admin_operators, fonderie_admin_log',
	);
	app = new FonderieApp(defineConfig({ db: { url: PG_URL } })).register(
		new AdminModule({ adminToken: ROOT, store, operatorKey: 'cd'.repeat(32) }),
	);
	await app.boot();
});

after(async () => {
	if (!PG_URL) return;
	await (store as unknown as { end?: () => Promise<void>; close?: () => Promise<void> }).end?.();
	await store.close?.();
});

type Call = {
	method?: string;
	path: string;
	body?: unknown;
	cookie?: string | undefined;
	token?: string;
	origin?: string;
};
async function call({ method = 'GET', path, body, cookie, token, origin }: Call) {
	const headers: Record<string, string> = {};
	if (body !== undefined) headers['content-type'] = 'application/json';
	if (cookie) headers['cookie'] = `fonderie_admin=${cookie}`;
	if (token) headers['authorization'] = `Bearer ${token}`;
	if (origin) headers['origin'] = origin;
	const res = await app.handle(
		new Request(`http://localhost${path}`, {
			method,
			headers,
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		}),
	);
	const set = res.headers.get('set-cookie') ?? '';
	const m = /fonderie_admin=([^;]*)/.exec(set);
	const json = (await res.json().catch(() => ({}))) as {
		reason?: string;
		result?: Record<string, unknown>;
	};
	return {
		status: res.status,
		reason: json.reason,
		result: json.result ?? {},
		cookie: m ? m[1] : undefined,
		setCookie: set,
	};
}

const codeFor = (secret: string, offset = 0) => hotp(secret, totpCounter() + offset);

// State the flows build on, in order.
const S: { cookie?: string; secret?: string; backup?: string[]; opId?: string } = {};

test('claim: needs the root token, works once, starts enrollment with a strict HttpOnly cookie', {
	skip,
}, async () => {
	resetAttemptLimits();
	const state = await call({ path: '/_admin/session' });
	assert.equal(state.result['claimable'], true);
	assert.equal(state.result['state'], 'signed-out');

	const noRoot = await call({
		method: 'POST',
		path: '/_admin/session/claim',
		body: { email: EMAIL, password: PASSWORD },
	});
	assert.equal(noRoot.status, 401);
	const weak = await call({
		method: 'POST',
		path: '/_admin/session/claim',
		token: ROOT,
		body: { email: EMAIL, password: 'short' },
	});
	assert.equal(weak.reason, 'WEAK_PASSWORD');

	const claim = await call({
		method: 'POST',
		path: '/_admin/session/claim',
		token: ROOT,
		body: { email: EMAIL, name: 'Ada', password: PASSWORD },
	});
	assert.equal(claim.status, 200, JSON.stringify(claim));
	assert.equal(claim.result['state'], 'needs-enrollment');
	assert.match(claim.setCookie, /HttpOnly/);
	assert.match(claim.setCookie, /SameSite=Strict/);
	assert.ok(claim.cookie);
	S.cookie = claim.cookie;

	const again = await call({
		method: 'POST',
		path: '/_admin/session/claim',
		token: ROOT,
		body: { email: 'eve@example.com', password: PASSWORD },
	});
	assert.equal(again.status, 409);
	assert.equal(again.reason, 'ALREADY_CLAIMED');
	assert.equal((await call({ path: '/_admin/session' })).result['claimable'], false);
});

test('a pending session opens nothing', { skip }, async () => {
	assert.equal((await call({ path: '/_admin/manifest', cookie: S.cookie })).status, 401);
});

test('enrollment: secret is sealed at rest; wrong code refused; right code signs in with 10 backup codes on a NEW session', {
	skip,
}, async () => {
	const e = await call({ path: '/_admin/session/enrollment', cookie: S.cookie });
	assert.equal(e.status, 200);
	const secret = String(e.result['secret']);
	assert.match(String(e.result['uri']), /^otpauth:\/\/totp\//);
	const [row] = await store.query<{ totp_secret: string }>(
		'SELECT totp_secret FROM fonderie_admin_operators WHERE email = $1',
		[EMAIL],
	);
	assert.ok(row?.totp_secret.startsWith('op.v1:'), 'sealed with operatorKey');
	assert.equal(
		(await call({ path: '/_admin/session/enrollment', cookie: S.cookie })).result['secret'],
		secret,
		'stable across reloads',
	);

	const wrong = await call({
		method: 'POST',
		path: '/_admin/session/enrollment',
		cookie: S.cookie,
		body: { code: '000000' },
	});
	assert.equal(wrong.status, 401);

	const ok = await call({
		method: 'POST',
		path: '/_admin/session/enrollment',
		cookie: S.cookie,
		body: { code: codeFor(secret) },
	});
	assert.equal(ok.status, 200, JSON.stringify(ok));
	assert.equal(ok.result['state'], 'signed-in');
	const codes = ok.result['backupCodes'] as string[];
	assert.equal(codes.length, 10);
	assert.ok(ok.cookie && ok.cookie !== S.cookie, 'session id rotated at the privilege change');
	assert.equal(
		(await call({ path: '/_admin/session', cookie: S.cookie })).result['state'],
		'signed-out',
		'the pending id is gone, not merely unprivileged',
	);
	S.cookie = ok.cookie;
	S.secret = secret;
	S.backup = codes;
});

test('an active session reads; the log names the operator, not a spoofable header', {
	skip,
}, async () => {
	const m = await call({ path: '/_admin/manifest', cookie: S.cookie });
	assert.equal(m.status, 200);
	const [row] = await store.query<{ actor: string }>(
		`SELECT actor FROM fonderie_admin_log WHERE path = '/_admin/manifest' ORDER BY at DESC LIMIT 1`,
	);
	assert.equal(row?.actor, `operator:${EMAIL}`);
});

test('cookie writes must come from this origin', { skip }, async () => {
	const r = await call({
		method: 'POST',
		path: '/_admin/access/operators/invites',
		cookie: S.cookie,
		origin: 'http://evil.example',
		body: {},
	});
	assert.equal(r.status, 403);
	assert.equal(r.reason, 'CROSS_ORIGIN');
});

test('step-up: a dangerous action needs a fresh code; a replayed code is refused; a backup code works once', {
	skip,
}, async () => {
	const body = { email: 'grace@example.com', scopes: ['read'] };
	const blocked = await call({
		method: 'POST',
		path: '/_admin/access/operators/invites',
		cookie: S.cookie,
		body,
	});
	assert.equal(blocked.status, 403);
	assert.equal(blocked.reason, 'STEP_UP_REQUIRED');

	const replay = await call({
		method: 'POST',
		path: '/_admin/session/step-up',
		cookie: S.cookie,
		body: { code: codeFor(S.secret!) },
	});
	assert.equal(replay.status, 401, 'the enrollment code cannot be reused');

	const backup = S.backup![0]!;
	const up = await call({
		method: 'POST',
		path: '/_admin/session/step-up',
		cookie: S.cookie,
		body: { backupCode: backup.toLowerCase() },
	});
	assert.equal(up.status, 200);
	assert.equal(up.result['backupCodesLeft'], 9);
	const reuse = await call({
		method: 'POST',
		path: '/_admin/session/step-up',
		cookie: S.cookie,
		body: { backupCode: backup },
	});
	assert.equal(reuse.status, 401, 'backup codes are single-use');

	const invite = await call({
		method: 'POST',
		path: '/_admin/access/operators/invites',
		cookie: S.cookie,
		body,
	});
	assert.equal(invite.status, 201, JSON.stringify(invite));
	assert.match(String(invite.result['url']), /\/_admin\/ui#\/link\/fai_/);
	(S as Record<string, unknown>)['invite'] = invite.result['token'];
});

test('invite: inspect, weak password refused, redeem once into enrollment, then the scopes it carried', {
	skip,
}, async () => {
	const token = String((S as Record<string, unknown>)['invite']);
	const inspect = await call({
		method: 'POST',
		path: '/_admin/session/link/inspect',
		body: { token },
	});
	assert.deepEqual(inspect.result, { kind: 'invite', email: 'grace@example.com' });
	assert.equal(
		(
			await call({
				method: 'POST',
				path: '/_admin/session/link',
				body: { token, password: 'short' },
			})
		).reason,
		'WEAK_PASSWORD',
	);

	const redeem = await call({
		method: 'POST',
		path: '/_admin/session/link',
		body: { token, password: PASSWORD, name: 'Grace' },
	});
	assert.equal(redeem.result['state'], 'needs-enrollment');
	assert.equal(
		(
			await call({
				method: 'POST',
				path: '/_admin/session/link',
				body: { token, password: PASSWORD },
			})
		).status,
		404,
		'single use',
	);

	const e = await call({ path: '/_admin/session/enrollment', cookie: redeem.cookie });
	const done = await call({
		method: 'POST',
		path: '/_admin/session/enrollment',
		cookie: redeem.cookie,
		body: { code: codeFor(String(e.result['secret'])) },
	});
	assert.equal(done.result['state'], 'signed-in');
	assert.equal(
		(await call({ path: '/_admin/manifest', cookie: done.cookie })).status,
		200,
		'read scope reads',
	);
	const write = await call({
		method: 'PUT',
		path: '/_admin/access/operators/x',
		cookie: done.cookie,
		body: {},
	});
	assert.equal(write.status, 403, 'read scope cannot manage operators');
	assert.equal(write.reason, 'FORBIDDEN');
});

test('login: generic failures, then a lockout; the second factor is required after the password', {
	skip,
}, async () => {
	resetAttemptLimits();
	const unknown = await call({
		method: 'POST',
		path: '/_admin/session/login',
		body: { email: 'nobody@example.com', password: PASSWORD },
	});
	const wrong = await call({
		method: 'POST',
		path: '/_admin/session/login',
		body: { email: EMAIL, password: 'wrong wrong wrong' },
	});
	assert.equal(unknown.status, 401);
	assert.deepEqual(
		[unknown.reason, wrong.reason],
		['INVALID_CREDENTIALS', 'INVALID_CREDENTIALS'],
		'no hint which part was wrong',
	);

	const pw = await call({
		method: 'POST',
		path: '/_admin/session/login',
		body: { email: EMAIL, password: PASSWORD },
	});
	assert.equal(pw.result['state'], 'needs-2fa');
	assert.equal(
		(await call({ path: '/_admin/manifest', cookie: pw.cookie })).status,
		401,
		'password alone opens nothing',
	);
	const v = await call({
		method: 'POST',
		path: '/_admin/session/verify',
		cookie: pw.cookie,
		body: { code: codeFor(S.secret!, 1) },
	});
	assert.equal(v.result['state'], 'signed-in', JSON.stringify(v));
	assert.equal(
		(await call({ path: '/_admin/session', cookie: pw.cookie })).result['state'],
		'signed-out',
		'rotated after the second factor too',
	);

	for (let i = 0; i < 5; i++)
		await call({
			method: 'POST',
			path: '/_admin/session/login',
			body: { email: EMAIL, password: 'wrong wrong wrong' },
		});
	const locked = await call({
		method: 'POST',
		path: '/_admin/session/login',
		body: { email: EMAIL, password: PASSWORD },
	});
	assert.equal(locked.status, 429);
	assert.equal(locked.reason, 'LOCKED');
	await store.query(
		`UPDATE fonderie_admin_operators SET failed_attempts = 0, locked_until = NULL WHERE email = $1`,
		[EMAIL],
	);
});

test('a burst of parallel wrong passwords is checked one at a time: at most 5 are tried, the rest are locked out', {
	skip,
}, async () => {
	const burst = await Promise.all(
		Array.from({ length: 15 }, () =>
			call({ method: 'POST', path: '/_admin/session/login', body: { email: EMAIL, password: 'wrong wrong wrong' } }),
		),
	);
	const tried = burst.filter((r) => r.reason !== 'LOCKED').length;
	assert.ok(tried <= 5, `${tried} guesses were verified; the lockout allows 5`);
	assert.equal(burst.filter((r) => r.reason === 'LOCKED').length, 15 - tried);
	const [row] = await store.query<{ n: number }>(`SELECT failed_attempts AS n FROM fonderie_admin_operators WHERE email = $1`, [EMAIL]);
	assert.equal(Number(row!.n), tried, 'every verified guess was counted');
	await store.query(
		`UPDATE fonderie_admin_operators SET failed_attempts = 0, locked_until = NULL WHERE email = $1`,
		[EMAIL],
	);
});

test('recovery via the root token (break-glass): new password, must re-enroll, old sessions end', {
	skip,
}, async () => {
	const list = await call({ path: '/_admin/access/operators', token: ROOT });
	const ada = (list.result['operators'] as Array<{ id: string; email: string }>).find(
		(o) => o.email === EMAIL,
	)!;
	const rec = await call({
		method: 'POST',
		path: `/_admin/access/operators/${ada.id}/recovery`,
		token: ROOT,
	});
	assert.equal(rec.status, 201);
	assert.equal(
		(await call({ path: '/_admin/manifest', cookie: S.cookie })).status,
		401,
		'signed out everywhere',
	);

	const redeem = await call({
		method: 'POST',
		path: '/_admin/session/link',
		body: { token: rec.result['token'], password: 'a brand new passphrase' },
	});
	assert.equal(redeem.result['state'], 'needs-enrollment');
	const old = await call({
		method: 'POST',
		path: '/_admin/session/login',
		body: { email: EMAIL, password: PASSWORD },
	});
	assert.equal(old.status, 401, 'the old password is gone');
});

test('the root token still works for machines; a disabled operator is out', { skip }, async () => {
	assert.equal((await call({ path: '/_admin/manifest', token: ROOT })).status, 200);
	const list = await call({ path: '/_admin/access/operators', token: ROOT });
	const grace = (list.result['operators'] as Array<{ id: string; email: string }>).find(
		(o) => o.email === 'grace@example.com',
	)!;
	const off = await call({
		method: 'PUT',
		path: `/_admin/access/operators/${grace.id}`,
		token: ROOT,
		body: { disabled: true },
	});
	assert.equal(off.status, 200);
	const login = await call({
		method: 'POST',
		path: '/_admin/session/login',
		body: { email: 'grace@example.com', password: PASSWORD },
	});
	assert.equal(login.status, 401);
});

test('sign out clears the cookie and ends the session', { skip }, async () => {
	await store.query(
		`UPDATE fonderie_admin_operators SET disabled_at = NULL WHERE email = 'grace@example.com'`,
	);
	const pw = await call({
		method: 'POST',
		path: '/_admin/session/login',
		body: { email: 'grace@example.com', password: PASSWORD },
	});
	const out = await call({ method: 'DELETE', path: '/_admin/session', cookie: pw.cookie });
	assert.equal(out.status, 200);
	assert.match(out.setCookie, /Max-Age=0/);
	assert.equal(
		(await call({ path: '/_admin/session', cookie: pw.cookie })).result['state'],
		'signed-out',
	);
});
