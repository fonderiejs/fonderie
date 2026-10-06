import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { AuthModule } from '../module';
import { getMigrationsPath } from '../migrations';

// Registration is all-or-nothing, on a REAL Postgres (atomicity audit B2): the
// account row and its verification code are written together. Before, a crash
// between the two left an account with no code — it could never be verified,
// and its address answered USER_ALREADY_EXISTS to every new attempt: stuck.
// The failure is injected into the SECOND write; afterwards nothing of the
// attempt may remain, no event may announce it, and the same address must
// register cleanly.
//
//   AUTH_PG_URL=postgres://... npm test -w @fonderie/auth

const PG_URL = process.env['AUTH_PG_URL'];
const skip = PG_URL ? false : 'set AUTH_PG_URL to run';
const DOMAIN = 'register-atomic.acme.example';

let inner: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];

// Fails the next statement that matches, inside a transaction or not.
let failOn: RegExp | null = null;
function failing(s: IStoreAdapter): IStoreAdapter {
	return {
		query: async <T = unknown>(sql: string, params?: unknown[]) => {
			if (failOn && failOn.test(sql)) {
				failOn = null;
				throw new Error('injected: the process died here');
			}
			return s.query<T>(sql, params);
		},
		transaction: <T>(fn: (tx: IStoreAdapter) => Promise<T>) => s.transaction((tx) => fn(failing(tx))),
	};
}

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	inner = new PGAdapter(PG_URL) as typeof inner;
	await new InternalMigrationRunner(inner, getMigrationsPath()).run();
	// Only this suite's own rows (CI shares one database across suites).
	await inner.query(`DELETE FROM fonderie_users WHERE email LIKE $1`, [`%@${DOMAIN}`]);
	const bus = { emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }), on() {}, subscribe() {} };
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } })).register(
		new AuthModule(failing(inner), { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email', 'phone'], rateLimit: false } as never, bus as never),
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
	await inner.end?.();
});

beforeEach(() => {
	emitted.length = 0;
	failOn = null;
});

async function register(body: Record<string, unknown>): Promise<{ status: number; reason?: string }> {
	const res = await fetch(`${base}/auth/register`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	const json = (await res.json().catch(() => ({}))) as { reason?: string };
	return { status: res.status, ...(json.reason ? { reason: json.reason } : {}) };
}

test('email: a failure writing the code leaves no account, and the address registers again', { skip }, async () => {
	const email = `stuck-${Date.now()}@${DOMAIN}`;
	failOn = /INSERT INTO fonderie_email_verifications/;
	const first = await register({ email, password: 'Aa1!aaaa-bbbb-cccc' });
	assert.equal(failOn, null, 'the injected failure fired');
	assert.notEqual(first.status, 201);

	const users = await inner.query<{ id: string }>(`SELECT id FROM fonderie_users WHERE email = $1`, [email]);
	assert.equal(users.length, 0, 'the account row was rolled back with its code');
	assert.equal(emitted.length, 0, 'nothing announced an account that does not exist');

	const again = await register({ email, password: 'Aa1!aaaa-bbbb-cccc' });
	assert.equal(again.status, 201, JSON.stringify(again));
	const [row] = await inner.query<{ n: string }>(
		`SELECT COUNT(*) AS n FROM fonderie_email_verifications v JOIN fonderie_users u ON u.id = v.user_id WHERE u.email = $1`,
		[email],
	);
	assert.equal(Number(row?.n), 1, 'the second attempt has its code');

	await inner.query(`DELETE FROM fonderie_users WHERE email = $1`, [email]);
});

test('phone: a failure writing the code leaves no account, and the number registers again', { skip }, async () => {
	// 555-01xx is reserved for fiction; the tail keeps parallel runs apart.
	const phone = `+1555010${String(Date.now() % 10_000).padStart(4, '0')}`;
	await inner.query(`DELETE FROM fonderie_users WHERE phone = $1`, [phone]);
	failOn = /INSERT INTO fonderie_phone_verifications/;
	const first = await register({ phone, firstName: 'Pat' });
	assert.equal(failOn, null, 'the injected failure fired');
	assert.notEqual(first.reason, 'USER_PHONE_REGISTERED');

	const users = await inner.query<{ id: string }>(`SELECT id FROM fonderie_users WHERE phone = $1`, [phone]);
	assert.equal(users.length, 0, 'the account row was rolled back with its code');
	assert.equal(emitted.length, 0, 'nothing announced an account that does not exist');

	const again = await register({ phone, firstName: 'Pat' });
	assert.equal(again.reason, 'USER_PHONE_REGISTERED', JSON.stringify(again));
	const [code] = await inner.query<{ n: string }>(`SELECT COUNT(*) AS n FROM fonderie_phone_verifications WHERE phone = $1`, [phone]);
	assert.equal(Number(code?.n), 1, 'the second attempt has its code');

	await inner.query(`DELETE FROM fonderie_phone_verifications WHERE phone = $1`, [phone]);
	await inner.query(`DELETE FROM fonderie_users WHERE phone = $1`, [phone]);
});
