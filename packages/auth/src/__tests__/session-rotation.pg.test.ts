import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { AuthModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { hashRefreshToken } from '../models/session.model';

// Refresh rotation on a REAL Postgres (docs/SESSION-DESIGN.md, Phase 2): the
// hashing, the grace window and the conditional update are behaviours of the
// database — a mocked store would only prove itself.
//
//   AUTH_PG_URL=postgres://... npm test -w @fonderie/auth

const PG_URL = process.env['AUTH_PG_URL'];
const skip = PG_URL ? false : 'set AUTH_PG_URL to run';

let store: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	const { InternalMigrationRunner } = await import('@fonderie/store');
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	const bus = { emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }), on() {}, subscribe() {} };
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } })).register(
		new AuthModule(store, { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email'], rateLimit: false, } as never, bus as never),
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

beforeEach(async () => {
	if (!PG_URL) return;
	emitted.length = 0;
	await store.query(`DELETE FROM fonderie_sessions`);
	await store.query(`DELETE FROM fonderie_users WHERE email LIKE '%@rotation.acme.example'`);
});

let n = 0;
async function signUp(clientKind?: string): Promise<{ access: string; refresh: string }> {
	const res = await fetch(`${base}/auth/register`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...(clientKind ? { 'x-client-kind': clientKind } : {}) },
		body: JSON.stringify({ email: `u${++n}-${Date.now()}@rotation.acme.example`, password: 'Aa1!aaaa-bbbb-cccc' }),
	});
	const body = (await res.json()) as { result: { tokens: { access: string; refresh: string } } };
	assert.equal(res.status, 201, JSON.stringify(body));
	return body.result.tokens;
}
async function refresh(token: string, clientKind?: string): Promise<{ status: number; tokens?: { access: string; refresh: string } }> {
	const res = await fetch(`${base}/auth/refresh`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...(clientKind ? { 'x-client-kind': clientKind } : {}) },
		body: JSON.stringify({ refreshToken: token }),
	});
	const body = (await res.json()) as { result?: { tokens?: { access: string; refresh: string } } };
	return { status: res.status, ...(body.result?.tokens ? { tokens: body.result.tokens } : {}) };
}
const rows = () => store.query<{ id: string; token: string; sid: string; previous_token_hash: string | null }>(`SELECT id, token, sid, previous_token_hash FROM fonderie_sessions`);

test('the database holds the HASH of the refresh token, never the token', { skip }, async () => {
	const { refresh: token } = await signUp();
	const [row] = await rows();
	assert.equal(row?.token, hashRefreshToken(token));
	assert.ok(!row?.token.includes('.'), 'no raw JWT at rest');
});

test('a refresh rotates the SAME row: the device and its session id stay', { skip }, async () => {
	const first = await signUp();
	const [before] = await rows();
	const r = await refresh(first.refresh);
	assert.equal(r.status, 200);
	const after = await rows();
	assert.equal(after.length, 1);
	assert.equal(after[0]?.id, before?.id, 'same device row');
	assert.equal(after[0]?.sid, before?.sid, 'same session id');
	assert.equal(after[0]?.token, hashRefreshToken(r.tokens!.refresh));
	assert.equal(after[0]?.previous_token_hash, hashRefreshToken(first.refresh));
});

test('within the grace, the previous token still refreshes (a retry or a race)', { skip }, async () => {
	const first = await signUp();
	assert.equal((await refresh(first.refresh)).status, 200);
	const retry = await refresh(first.refresh);
	assert.equal(retry.status, 200, 'the client never got the first answer and retried');
	assert.equal((await rows()).length, 1);
	assert.equal((await refresh(retry.tokens!.refresh)).status, 200, 'the retry\'s token is the live one');
});

test('the previous token AFTER the grace is a reuse: the session is revoked, and the event emitted', { skip }, async () => {
	const first = await signUp();
	const second = await refresh(first.refresh);
	await store.query(`UPDATE fonderie_sessions SET previous_valid_until = now() - interval '1 second'`);
	const stolen = await refresh(first.refresh);
	assert.equal(stolen.status, 401);
	assert.equal((await rows()).length, 0, 'session revoked');
	assert.equal((await refresh(second.tokens!.refresh)).status, 401, 'the live token died with it');
	const ev = emitted.find((e) => e.type === 'fonderie.session.revoked');
	assert.equal(ev?.payload['reason'], 'refresh-reuse');
});

test('concurrent refreshes with one token all succeed and leave ONE row', { skip }, async () => {
	const first = await signUp();
	const results = await Promise.all(Array.from({ length: 5 }, () => refresh(first.refresh)));
	assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200]);
	assert.equal((await rows()).length, 1);
});

test('a session stored before hashing (raw token) still refreshes, and is hashed by the rotation', { skip }, async () => {
	const first = await signUp();
	await store.query(`UPDATE fonderie_sessions SET token = $1`, [first.refresh]); // as written before migration 020
	const r = await refresh(first.refresh);
	assert.equal(r.status, 200);
	const [row] = await rows();
	assert.equal(row?.token, hashRefreshToken(r.tokens!.refresh));
});

// Deploy safety: the code still serving during a deploy looks sessions up by
// the RAW token. The migration must leave those rows readable — it only adds
// columns — and the new code hashes each on its next refresh.
test('migration 020 leaves raw rows readable by the previous code, and is safe to re-run', { skip }, async () => {
	const first = await signUp();
	await store.query(`UPDATE fonderie_sessions SET token = $1`, [first.refresh]); // a session from before this release
	const sql = readFileSync(join(getMigrationsPath(), '020_session_rotation.sql'), 'utf8');
	await store.query(sql);
	await store.query(sql);
	const [raw] = await store.query<{ id: string }>(`SELECT id FROM fonderie_sessions WHERE token = $1`, [first.refresh]);
	assert.ok(raw, 'the previous code\'s lookup (token = raw) still finds the session');
	const r = await refresh(first.refresh);
	assert.equal(r.status, 200);
	assert.equal((await rows())[0]?.token, hashRefreshToken(r.tokens!.refresh), 'hashed by its next refresh');
});

// ── Phase 3: lifetimes ─────────────────────────────────────────────────────
const claim = (t: string) => JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString()) as { auth_time?: number };

test('a refresh carries auth_time (when the user last SIGNED IN), and slides the idle timeout to 90 days out', { skip }, async () => {
	const first = await signUp();
	await store.query(`UPDATE fonderie_sessions SET expires_at = now() + interval '1 day'`); // nearly idle
	// Over a second later: a freshly minted auth_time would differ — the same
	// second would make a regression look like a pass.
	await new Promise((r) => setTimeout(r, 1100));
	const r = await refresh(first.refresh);
	assert.equal(r.status, 200);
	assert.equal(claim(r.tokens!.access).auth_time, claim(first.access).auth_time, 'a refresh is not a sign-in');
	const [row] = await store.query<{ days: number }>(`SELECT EXTRACT(EPOCH FROM (expires_at - now())) / 86400 AS days FROM fonderie_sessions`);
	assert.ok(Number(row?.days) > 89, `extended to ~90 days, got ${row?.days}`);
});

test('a session past the absolute cap (sessionMaxAge) is refused at refresh and revoked, however active', { skip }, async () => {
	const first = await signUp('mobile'); // mobile preset: 365 d cap
	await store.query(`UPDATE fonderie_sessions SET created_at = now() - interval '400 days'`);
	const r = await refresh(first.refresh);
	assert.equal(r.status, 401);
	assert.equal((await rows()).length, 0);
});

// ── Phase 3c: lifetimes per platform ───────────────────────────────────────
const lifetimeDays = (t: string) => {
	const c = JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString()) as { iat: number; exp: number };
	return (c.exp - c.iat) / 86400;
};

test('a web sign-in gets the web lifetime, recorded on the session; a refresh cannot promote it', { skip }, async () => {
	const web = await signUp('web');
	assert.equal(lifetimeDays(web.refresh), 14);
	const [row] = await store.query<{ client_kind: string }>(`SELECT client_kind FROM fonderie_sessions`);
	assert.equal(row?.client_kind, 'web');
	const r = await refresh(web.refresh, 'mobile'); // claims to be a phone now
	assert.equal(r.status, 200);
	assert.equal(lifetimeDays(r.tokens!.refresh), 14, 'still the web lifetime');
});

test('an undeclared client keeps the shared lifetime (today\'s behaviour)', { skip }, async () => {
	const plain = await signUp();
	assert.equal(lifetimeDays(plain.refresh), 90);
	const [row] = await store.query<{ client_kind: string | null }>(`SELECT client_kind FROM fonderie_sessions`);
	assert.equal(row?.client_kind, null);
});
