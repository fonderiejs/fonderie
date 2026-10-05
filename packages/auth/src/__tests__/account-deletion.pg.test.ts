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
const blockedUsers = new Set<string>();

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	const bus = { emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }), on() {}, subscribe() {} };
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } })).register(
		new AuthModule(
			store,
			{ jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email', 'phone'], rateLimit: false, accountDeletion: { gracePeriodDays: 30, blockers: [async (id: string) => (blockedUsers.has(id) ? { reason: 'OWNS_TEAM_WORKSPACE', explanation: 'Transfer it first.', details: { workspaces: 'Acme Crew' } } : null)] } } as never,
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
	const json = (await res.json().catch(() => ({}))) as { reason?: string; details?: Record<string, any>; result?: Record<string, any> };
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


// ── Phase 2: deleting with proof, and keeping the account ───────────────────

const sent = (type: string, to: string) =>
	[...emitted].reverse().find((e) => e.type === 'fonderie.notification.send' && e.payload['type'] === type && JSON.stringify(e.payload['recipient']).includes(to))
		?.payload as { data: Record<string, any>; recipient: Record<string, string | null> } | undefined;

async function account(): Promise<{ email: string; id: string; token: string }> {
	const email = `q${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call('POST', '/auth/register', { email, password: PASSWORD });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { email, id: r.result['user'].id, token: r.result['tokens'].access };
}

test('deleting takes a code sent to the chosen channel; a wrong code does nothing; the right one closes the account', { skip }, async () => {
	const a = await account();
	const noPhone = await call('POST', '/users/me/deletion', { channel: 'sms' }, a.token);
	assert.deepEqual([noPhone.status, noPhone.reason], [422, 'NO_PHONE_ON_ACCOUNT']);

	const req = await call('POST', '/users/me/deletion', { channel: 'email' }, a.token);
	assert.equal(req.status, 202, JSON.stringify(req));
	const code = sent('account-deletion-code', a.email)?.data['code'];
	assert.match(String(code), /^\d{6}$/);
	assert.deepEqual(sent('account-deletion-code', a.email)?.recipient['phone'], null, 'only the chosen channel');

	const wrong = await call('POST', '/users/me/deletion/confirm', { code: code === '111111' ? '222222' : '111111' }, a.token);
	assert.deepEqual([wrong.status, wrong.reason], [400, 'VERIFICATION_FAILED']);
	assert.equal((await call('GET', '/users', undefined, a.token)).status, 200, 'still open after a wrong code');

	const ok = await call('POST', '/users/me/deletion/confirm', { code }, a.token);
	assert.deepEqual([ok.status, ok.reason], [200, 'ACCOUNT_DELETED']);
	assert.equal(Math.round((Date.parse(ok.result['deleteOn']) - Date.parse(ok.result['requestedAt'])) / 86_400_000), 30);
	assert.equal((await call('GET', '/users', undefined, a.token)).status, 401, 'every session ended');
	const notice = sent('account-deletion-scheduled', a.email);
	assert.ok(notice, 'the scheduled notice went out');
	assert.equal(notice!.data['$format']?.deleteOn?.style, 'long', 'the date is formatted in the reader\'s language');
	assert.ok(emitted.some((e) => e.type === 'fonderie.user.deleted' && e.payload['userId'] === a.id));
});

test('five wrong codes spend it — even a right one afterwards is refused', { skip }, async () => {
	const a = await account();
	await call('POST', '/users/me/deletion', { channel: 'email' }, a.token);
	const code = sent('account-deletion-code', a.email)!.data['code'];
	const other = code === '111111' ? '222222' : '111111';
	for (let i = 0; i < 5; i++) await call('POST', '/users/me/deletion/confirm', { code: other }, a.token);
	const late = await call('POST', '/users/me/deletion/confirm', { code }, a.token);
	assert.deepEqual([late.status, late.reason], [400, 'VERIFICATION_FAILED']);
	assert.equal((await call('GET', '/users', undefined, a.token)).status, 200, 'not deleted');
});

test('a blocker (e.g. owning a team) refuses the request, with its reason', { skip }, async () => {
	const a = await account();
	blockedUsers.add(a.id);
	const r = await call('POST', '/users/me/deletion', { channel: 'email' }, a.token);
	blockedUsers.delete(a.id);
	assert.deepEqual([r.status, r.reason, r.details['workspaces']], [409, 'OWNS_TEAM_WORKSPACE', 'Acme Crew']);
	assert.equal(sent('account-deletion-code', a.email), undefined, 'no code sent');
});

test('signing in to the archived account offers to keep it; keeping it signs in and the account works again', { skip }, async () => {
	const a = await account();
	await call('POST', '/users/me/deletion', { channel: 'email' }, a.token);
	await call('POST', '/users/me/deletion/confirm', { code: sent('account-deletion-code', a.email)!.data['code'] }, a.token);

	const login = await call('POST', '/auth/login', { email: a.email, password: PASSWORD });
	assert.equal(login.reason, 'ACCOUNT_PENDING_DELETION');
	const restoreToken = login.details['restoreToken'];
	assert.ok(restoreToken, 'a restore token comes with the dates');
	assert.equal(login.details['mfaRequired'], false);

	assert.equal((await call('POST', '/auth/account/restore', { restoreToken: 'x'.repeat(40) })).status, 401, 'a forged token does nothing');
	const kept = await call('POST', '/auth/account/restore', { restoreToken });
	assert.deepEqual([kept.status, kept.reason], [200, 'ACCOUNT_RESTORED']);
	assert.equal((await call('GET', '/users', undefined, kept.result['tokens'].access)).status, 200, 'signed in');
	assert.ok(sent('account-restored', a.email), 'restored notice sent');
	assert.ok(emitted.some((e) => e.type === 'fonderie.user.restored' && e.payload['userId'] === a.id));

	// The same proof cannot be replayed onto a LATER archive of the account.
	assert.equal((await call('POST', '/auth/account/restore', { restoreToken })).status, 401);
	assert.equal((await call('POST', '/auth/login', { email: a.email, password: PASSWORD })).status, 200, 'normal sign-in again');
});

test('with two-factor on, confirming and keeping both need the second factor', { skip }, async () => {
	const { generateTotpSecret, generateTotpCode } = await import('../services/mfa');
	const a = await account();
	const secret = generateTotpSecret();
	await store.query(`UPDATE fonderie_users SET mfa_enabled = true, mfa_secret = $2 WHERE id = $1`, [a.id, secret]);
	await call('POST', '/users/me/deletion', { channel: 'email' }, a.token);
	const code = sent('account-deletion-code', a.email)!.data['code'];
	const no2fa = await call('POST', '/users/me/deletion/confirm', { code }, a.token);
	assert.deepEqual([no2fa.status, no2fa.reason], [401, 'MFA_REQUIRED']);
	assert.equal((await call('POST', '/users/me/deletion/confirm', { code, mfaCode: generateTotpCode(secret) }, a.token)).status, 200);

	const login = await call('POST', '/auth/login', { email: a.email, password: PASSWORD });
	assert.equal(login.details['mfaRequired'], true);
	const bare = await call('POST', '/auth/account/restore', { restoreToken: login.details['restoreToken'] });
	assert.deepEqual([bare.status, bare.reason], [401, 'MFA_REQUIRED']);
	const kept = await call('POST', '/auth/account/restore', { restoreToken: login.details['restoreToken'], mfaCode: generateTotpCode(secret) });
	assert.equal(kept.status, 200, JSON.stringify(kept));
});

test('by phone: the code proves the archived account, and verify offers to keep it instead of a session', { skip }, async () => {
	const a = await account();
	const phone = `+1438555${String(1000 + (n % 9000)).padStart(4, '0')}`;
	await store.query(`UPDATE fonderie_users SET phone = $2 WHERE id = $1`, [a.id, phone]);
	await call('POST', '/users/me/deletion', { channel: 'sms' }, a.token);
	const viaSms = sent('account-deletion-code', phone);
	assert.ok(viaSms, 'the code went to the phone');
	assert.equal(viaSms!.recipient['email'], null);
	await call('POST', '/users/me/deletion/confirm', { code: viaSms!.data['code'] }, a.token);
	assert.ok(sent('account-deletion-scheduled', phone), 'the notice follows the chosen channel');

	const login = await call('POST', '/auth/login', { phone });
	assert.equal(login.status, 202, JSON.stringify(login));
	const otp = sent('phone-otp', phone)!.data['otp'];
	const verify = await call('POST', '/auth/verify', { token: otp }, login.result['otpToken']);
	assert.deepEqual([verify.status, verify.reason], [403, 'ACCOUNT_PENDING_DELETION']);
	assert.equal(verify.result['tokens'], undefined, 'no session');
	const kept = await call('POST', '/auth/account/restore', { restoreToken: verify.details['restoreToken'] });
	assert.equal(kept.status, 200, JSON.stringify(kept));
	assert.ok(sent('account-restored', phone), 'restored notice by SMS');
});

// ── One-time codes are spent once, even under a race ─────────────────────────

test('two resets racing with ONE code: exactly one changes the password', { skip }, async () => {
	const a = await account();
	await call('POST', '/auth/email/forgot', { email: a.email });
	const pin = sent('password-reset', a.email)!.data['pin'];
	const results = await Promise.all(
		['Rr1!first-first-first', 'Rr2!second-second-sec'].map((password) => call('POST', '/auth/email/reset', { pin, password })),
	);
	assert.deepEqual(results.map((r) => r.status).sort(), [200, 400], JSON.stringify(results));
});

test('one backup code used twice at once: exactly one succeeds', { skip }, async () => {
	const { verifySecondFactor } = await import('../services/second-factor');
	const { hashPassword } = await import('../services/password');
	const a = await account();
	await store.query(`INSERT INTO fonderie_mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)`, [a.id, await hashPassword('ABCD2345')]);
	const config = { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20) } as never;
	const outcomes = await Promise.all([1, 2, 3].map(() => verifySecondFactor(store, config, a.id, 'abcd2345')));
	assert.equal(outcomes.filter(Boolean).length, 1, JSON.stringify(outcomes));
});

// ── Phase 3: the reminder, then the purge with every brick's eraser ──────────

const SECRET = 'k'.repeat(20) + 'm'.repeat(20);
// Move an archived account (and its history, so sign-up still comes before the
// request) back in time.
const daysAgo = async (id: string, days: number) => {
	await store.query(`UPDATE fonderie_login_events SET created_at = created_at - make_interval(days => $2) WHERE user_id = $1`, [id, days]);
	await store.query(`UPDATE fonderie_users SET deleted_at = deleted_at - make_interval(days => $2), deletion_reminded_at = NULL WHERE id = $1`, [id, days]);
};

async function archived(): Promise<{ id: string; email: string }> {
	const a = await account();
	await call('POST', '/users/me/deletion', { channel: 'email' }, a.token);
	await call('POST', '/users/me/deletion/confirm', { code: sent('account-deletion-code', a.email)!.data['code'] }, a.token);
	return { id: a.id, email: a.email };
}

test('a week before the date, ONE reminder on the chosen channel — not if they tried to sign in since', { skip }, async () => {
	const { runAccountDeletionSchedule } = await import('../services/deletion-schedule');
	const bus = { emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }) };
	const config = { jwtSecret: SECRET, accountDeletion: { gracePeriodDays: 30 } } as never;
	const [quiet, tried, early] = [await archived(), await archived(), await archived()];
	await daysAgo(quiet.id, 24);
	await daysAgo(tried.id, 24);
	await daysAgo(early.id, 10);
	await call('POST', '/auth/login', { email: tried.email, password: PASSWORD }); // an attempt since the request
	// Login events are written in the background after the response; wait for it.
	for (let i = 0; i < 50; i++) {
		const [r] = await store.query<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM fonderie_login_events le JOIN fonderie_users u ON u.id = le.user_id WHERE u.id = $1 AND le.created_at > u.deleted_at`, [tried.id]);
		if (r!.n > 0) break;
		await new Promise((res) => setTimeout(res, 50));
	}

	await runAccountDeletionSchedule(store, config, bus);
	const reminder = sent('account-deletion-reminder', quiet.email);
	assert.ok(reminder, 'the quiet one is reminded');
	assert.equal(reminder!.data['$format']?.deleteOn?.style, 'long');
	assert.equal(sent('account-deletion-reminder', tried.email), undefined, 'whoever tried to sign in already knows');
	assert.equal(sent('account-deletion-reminder', early.email), undefined, 'not yet due');

	emitted.length = 0;
	await runAccountDeletionSchedule(store, config, bus);
	assert.equal(sent('account-deletion-reminder', quiet.email), undefined, 'once');
});

test('on the date the account is erased: erasers first, row gone, a receipt without personal data, purged announced', { skip }, async () => {
	const { runAccountDeletionSchedule, erasureHash } = await import('../services/deletion-schedule');
	const bus = { emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }) };
	const a = await archived();
	// A sign-in attempt recorded against the address alone (no user id) — personal data outside the user row.
	await store.query(`INSERT INTO fonderie_login_events (user_id, email_attempted, method, outcome) VALUES (NULL, $1, 'password', 'failed')`, [a.email]);
	await daysAgo(a.id, 31);
	const seen: string[] = [];
	const config = { jwtSecret: SECRET, accountDeletion: { gracePeriodDays: 30, erasers: [{ name: 'test-brick', erase: async (s: { userId: string }) => { seen.push(s.userId); return { erased: 2 }; } }] } } as never;

	await runAccountDeletionSchedule(store, config, bus);
	assert.deepEqual(seen, [a.id], 'every brick erased first');
	assert.equal((await store.query(`SELECT 1 FROM fonderie_users WHERE id = $1`, [a.id])).length, 0, 'the account row is gone');
	assert.equal((await store.query(`SELECT 1 FROM fonderie_login_events WHERE email_attempted = $1`, [a.email])).length, 0, 'address-only sign-in attempts erased');
	const [receipt] = await store.query<{ emailHash: string; outcomes: Array<{ brick: string; erased: number }>; requestedAt: Date }>(
		`SELECT email_hash AS "emailHash", outcomes, requested_at AS "requestedAt" FROM fonderie_account_erasures WHERE user_id = $1`, [a.id],
	);
	assert.equal(receipt!.emailHash, erasureHash(SECRET, a.email), 'the address only as a keyed hash');
	assert.ok(!JSON.stringify(receipt).includes(a.email), 'no personal data in the receipt');
	assert.deepEqual(receipt!.outcomes.map((o) => o.brick), ['auth', 'test-brick']);
	assert.ok(emitted.some((e) => e.type === 'fonderie.user.purged' && e.payload['userId'] === a.id));
});

test('if any brick fails to erase, the account stays archived and the next run retries', { skip }, async () => {
	const { runAccountDeletionSchedule } = await import('../services/deletion-schedule');
	const a = await archived();
	await daysAgo(a.id, 31);
	let fail = true;
	const config = { jwtSecret: SECRET, accountDeletion: { gracePeriodDays: 30, erasers: [{ name: 'flaky', erase: async () => { if (fail) throw new Error('storage down'); return { erased: 0 }; } }] } } as never;
	const first = await runAccountDeletionSchedule(store, config);
	assert.ok(first.failed.some((f) => f.userId === a.id && f.eraser === 'flaky'));
	assert.equal((await store.query(`SELECT 1 FROM fonderie_users WHERE id = $1`, [a.id])).length, 1, 'kept — nothing half-erased');
	fail = false;
	await runAccountDeletionSchedule(store, config);
	assert.equal((await store.query(`SELECT 1 FROM fonderie_users WHERE id = $1`, [a.id])).length, 0, 'erased on the retry');
});

test('two schedulers at once erase each account exactly once', { skip }, async () => {
	const { runAccountDeletionSchedule } = await import('../services/deletion-schedule');
	const accounts = [await archived(), await archived(), await archived()];
	for (const a of accounts) await daysAgo(a.id, 31);
	const seen: string[] = [];
	const config = { jwtSecret: SECRET, accountDeletion: { gracePeriodDays: 30, erasers: [{ name: 'count', erase: async (s: { userId: string }) => { seen.push(s.userId); return { erased: 0 }; } }] } } as never;
	await Promise.all([runAccountDeletionSchedule(store, config), runAccountDeletionSchedule(store, config)]);
	const mine = seen.filter((id) => accounts.some((a) => a.id === id));
	assert.equal(mine.length, 3, `each of my 3 accounts erased once: ${mine.length}`);
	assert.equal(new Set(mine).size, 3);
});
