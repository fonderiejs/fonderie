import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { AuthModule } from '../module';
import { getMigrationsPath } from '../migrations';

// An ARCHIVED account (deleted, inside its grace period) on a REAL Postgres —
// docs/ACCOUNT-DELETION-DESIGN.md, Phase 1. Before: login said "invalid
// credentials", sign-up with the address was a 500, and a reset code issued
// before the deletion still changed the archived account's password.
//
//   AUTH_PG_URL=postgres://... npm test -w @fonderie/auth

const PG_URL = process.env['AUTH_PG_URL'];
const skip = PG_URL ? false : 'set AUTH_PG_URL to run';
const DOMAIN = 'deletion.acme.example';
const PASSWORD = 'Aa1!aaaa-bbbb-cccc';

let store: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	const bus = { emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }), on() {}, subscribe() {} };
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } })).register(
		new AuthModule(
			store,
			{ jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email', 'phone'], rateLimit: false, accountDeletion: { gracePeriodDays: 30 } } as never,
			bus as never,
		),
	);
	await app.boot();
	const s = app.listen(0, { quiet: true }) as unknown as typeof server & { address(): { port: number }; listening: boolean; once(e: string, f: () => void): void };
	await new Promise<void>((r) => (s.listening ? r() : s.once('listening', r)));
	server = s;
	base = `http://127.0.0.1:${s.address().port}`;
});

after(async () => {
	if (!PG_URL) return;
	server?.closeAllConnections?.();
	await new Promise<void>((r) => server?.close(() => r()));
	await store.end?.();
});

// CI shares one database across suites: touch only this suite's users.
beforeEach(async () => {
	if (!PG_URL) return;
	emitted.length = 0;
	await store.query(`DELETE FROM fonderie_users WHERE email LIKE $1`, [`%@${DOMAIN}`]);
});

async function call(method: string, path: string, body?: unknown, token?: string) {
	const res = await fetch(`${base}${path}`, {
		method,
		headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const json = (await res.json().catch(() => ({}))) as { reason?: string; details?: Record<string, string>; result?: Record<string, any> };
	return { status: res.status, reason: json.reason, details: json.details ?? {}, result: json.result ?? {} };
}

let n = 0;
async function deletedAccount(): Promise<{ email: string; id: string }> {
	const email = `p${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call('POST', '/auth/register', { email, password: PASSWORD });
	assert.equal(r.status, 201, JSON.stringify(r));
	const d = await call('DELETE', '/users', undefined, r.result['tokens'].access);
	assert.equal(d.status, 200, JSON.stringify(d));
	return { email, id: r.result['user'].id };
}

test('signing in to an archived account says when it will be deleted — only with the right password', { skip }, async () => {
	const { email } = await deletedAccount();
	const ok = await call('POST', '/auth/login', { email, password: PASSWORD });
	assert.equal(ok.status, 403);
	assert.equal(ok.reason, 'ACCOUNT_PENDING_DELETION');
	const requested = Date.parse(ok.details['requestedAt']!);
	const deleteOn = Date.parse(ok.details['deleteOn']!);
	assert.ok(Math.abs(Date.now() - requested) < 60_000, 'requested just now');
	assert.equal(Math.round((deleteOn - requested) / 86_400_000), 30, 'the configured 30-day grace period');
	assert.equal(ok.result['tokens'], undefined, 'no session is opened');

	// A wrong password learns nothing: the same 401 as an unknown address.
	const wrong = await call('POST', '/auth/login', { email, password: 'Zz9!wrong-wrong-wrong' });
	assert.deepEqual([wrong.status, wrong.reason, wrong.details], [401, 'INVALID_CREDENTIALS', {}]);
	// …and a '+tag' variant of the address is the same account.
	const alias = await call('POST', '/auth/login', { email: email.replace('@', '+x@'), password: PASSWORD });
	assert.equal(alias.reason, 'ACCOUNT_PENDING_DELETION');
});

test('signing up again with the archived address is a clear 409, not a 500, and changes nothing', { skip }, async () => {
	const { email, id } = await deletedAccount();
	const r = await call('POST', '/auth/register', { email, password: 'Bb2!other-other-other' });
	assert.equal(r.status, 409);
	assert.equal(r.reason, 'ACCOUNT_PENDING_DELETION');
	assert.deepEqual(r.details, {}, 'no dates without proof');
	const [row] = await store.query<{ deletedAt: Date | null }>(`SELECT deleted_at AS "deletedAt" FROM fonderie_users WHERE id = $1`, [id]);
	assert.ok(row?.deletedAt, 'still archived');
});

test('signing up by phone with an archived account’s number is a 409 and does not rewrite it', { skip }, async () => {
	const { id } = await deletedAccount();
	const phone = `+1514555${String(1000 + (n % 9000)).padStart(4, '0')}`;
	await store.query(`UPDATE fonderie_users SET phone = $2, first_name = 'Original' WHERE id = $1`, [id, phone]);
	const r = await call('POST', '/auth/register', { phone, firstName: 'Intruder' });
	assert.deepEqual([r.status, r.reason], [409, 'ACCOUNT_PENDING_DELETION']);
	const [row] = await store.query<{ firstName: string }>(`SELECT first_name AS "firstName" FROM fonderie_users WHERE id = $1`, [id]);
	assert.equal(row?.firstName, 'Original');
});

test('a reset code issued before the deletion no longer works on the archived account', { skip }, async () => {
	const email = `p${++n}-${Date.now()}@${DOMAIN}`;
	const reg = await call('POST', '/auth/register', { email, password: PASSWORD });
	assert.equal((await call('POST', '/auth/email/forgot', { email })).status, 200);
	const sent = [...emitted].reverse().find((e) => JSON.stringify(e.payload).includes('"pin"') && JSON.stringify(e.payload).includes(email));
	const pin = (sent?.payload['data'] as Record<string, string> | undefined)?.['pin'];
	assert.ok(pin, 'a reset code was sent');
	assert.equal((await call('DELETE', '/users', undefined, reg.result['tokens'].access)).status, 200);

	const r = await call('POST', '/auth/email/reset', { pin, password: 'Cc3!taken-over-now' });
	assert.deepEqual([r.status, r.reason], [400, 'PASSWORD_RESET_FAILED']);
	// The archived account still answers to its ORIGINAL password only.
	assert.equal((await call('POST', '/auth/login', { email, password: PASSWORD })).reason, 'ACCOUNT_PENDING_DELETION');
	assert.equal((await call('POST', '/auth/login', { email, password: 'Cc3!taken-over-now' })).status, 401);
});
