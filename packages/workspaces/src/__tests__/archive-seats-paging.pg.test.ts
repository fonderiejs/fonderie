import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { MESSAGE_KEYS } from '../config';
import { WORKSPACE_ARCHIVED_META_KEY } from '../middlewares/require-active-workspace';

// An archived workspace is read-only; restoring it is the owner's; the seats
// read; members and invitations paged — on a REAL Postgres, over HTTP.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'archive.acme.example';

let store: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];
// What another brick saw on ctx.meta for the last request to /probe.
let probed: unknown;

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { AuthModule } = await import('@fonderie/auth');
	const { getMigrationsPath: authMigrations } = await import('@fonderie/auth/migrations');
	const { requireAuth } = await import('@fonderie/core/middlewares');
	const { withWorkspace } = await import('../middlewares/workspace-context');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, authMigrations()).run();
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	const bus = {
		emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }),
		on() {},
		subscribe() {},
	};
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } }))
		.register(new AuthModule(store, { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email'], rateLimit: false } as never, bus as never))
		.register(new WorkspacesModule(store, { personalWorkspace: false, invitationUrl: 'https://app.acme.example/invite/{token}', velocityBrake: false }, bus as never))
		.register({
			name: 'test-probe',
			install(a: { use: (m: unknown) => void; addRoute: (m: string, p: string, ...h: unknown[]) => void }) {
				// Stands in for @fonderie/billing: a plan with a seat limit, set by header.
				a.use(async (ctx: { request: Request; meta: Record<string, unknown> }, next: () => Promise<Response>) => {
					const limit = ctx.request.headers.get('x-test-seat-limit');
					if (limit) ctx.meta['billing'] = { statuses: { seats: { type: 'limit', limit: Number(limit) } } };
					return next();
				});
				// Another brick's route, reading the archived flag by shape.
				a.addRoute('POST', '/probe', requireAuth, withWorkspace(store), async (ctx: { meta: Record<string, unknown> }) => {
					probed = ctx.meta[WORKSPACE_ARCHIVED_META_KEY];
					return new Response(JSON.stringify({ status: 200, reason: 'OK', result: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
				});
			},
		} as never);
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

beforeEach(() => {
	emitted.length = 0;
});

interface Person { id: string; email: string; token: string }
let n = 0;

async function call(token: string | null, method: string, path: string, body?: unknown, workspaceId?: string, extra: Record<string, string> = {}) {
	const res = await fetch(`${base}${path}`, {
		method,
		headers: {
			...extra,
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {}),
			...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const json = (await res.json().catch(() => ({}))) as { reason?: string; result?: Record<string, unknown> };
	return { status: res.status, reason: json.reason, result: (json.result ?? {}) as Record<string, any> };
}

async function person(first = 'Ana'): Promise<Person> {
	const email = `p${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc', firstName: first, lastName: 'Tester' });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { id: r.result['user'].id as string, email, token: r.result['tokens'].access as string };
}

async function team(): Promise<{ owner: Person; ws: string }> {
	const owner = await person('Olivia');
	const r = await call(owner.token, 'POST', '/workspaces', { name: `Archive crew ${n}-${Date.now()}` });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { owner, ws: r.result['workspace'].id as string };
}

function lastInvitationToken(): string {
	const m = [...emitted].reverse().find((e) => e.payload['type'] === MESSAGE_KEYS.workspaceInvitation);
	assert.ok(m, 'an invitation email was sent');
	return (m.payload as { data: Record<string, string> }).data['token'] as string;
}

async function join(owner: Person, ws: string): Promise<Person> {
	const p = await person('Marco');
	const inv = await call(owner.token, 'POST', '/workspaces/invitations', { email: p.email }, ws);
	assert.equal(inv.status, 201, JSON.stringify(inv));
	const acc = await call(p.token, 'POST', '/workspaces/invitations/accept', { token: lastInvitationToken() });
	assert.equal(acc.status, 200, JSON.stringify(acc));
	return p;
}

const trailOf = (type: string) => emitted.filter((e) => e.type === type).map((e) => e.payload);

// ── archive ──────────────────────────────────────────────────────────────────

test('an archived workspace is read-only: writes answer 409 WORKSPACE_ARCHIVED, reads still work', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	const outsider = await person('Iris');
	await call(owner.token, 'POST', '/workspaces/invitations', { email: outsider.email }, ws);
	const pendingToken = lastInvitationToken();

	const archived = await call(owner.token, 'POST', '/workspaces/archive', undefined, ws);
	assert.equal(archived.status, 200, JSON.stringify(archived));
	assert.deepEqual(trailOf('fonderie.workspace.archived'), [{ workspaceId: ws, userId: owner.id }]);

	// Writes — the owner's included — are refused.
	const writes: Array<[string, string, unknown?]> = [
		['PUT', '/workspaces', { name: 'Renamed' }],
		['PUT', '/workspaces/settings', { locale: 'fr-CA' }],
		['POST', '/workspaces/invitations', { email: `late-${Date.now()}@${DOMAIN}` }],
		['POST', '/workspaces/roles', { name: 'Crew lead' }],
		['DELETE', `/workspaces/members/${m.id}`],
		['POST', `/workspaces/members/${m.id}/manager`, {}],
		['POST', '/workspaces/emails', { email: `office@${DOMAIN}` }],
		['POST', '/workspaces/archive'],
	];
	for (const [method, path, body] of writes) {
		const r = await call(owner.token, method, path, body, ws);
		assert.deepEqual([method, path, r.status, r.reason], [method, path, 409, 'WORKSPACE_ARCHIVED']);
	}
	// …and nothing changed.
	const current = await call(owner.token, 'GET', '/workspaces/current', undefined, ws);
	assert.equal(current.status, 200);
	assert.notEqual(current.result['workspace'].name, 'Renamed');
	assert.equal(current.result['workspace'].isArchived, true);
	assert.ok(current.result['workspace'].archivedAt, 'archivedAt is exposed');

	// Reads work, for the owner and a member — the data can be exported.
	for (const path of ['/workspaces/members', '/workspaces/invitations', '/workspaces/roles', '/workspaces/settings', '/workspaces/contacts', '/workspaces/seats']) {
		assert.equal((await call(m.token, 'GET', path, undefined, ws)).status, 200, path);
	}
	const list = await call(m.token, 'GET', '/workspaces');
	const listed = (list.result['workspaces'] as Array<Record<string, any>>).find((w) => w['id'] === ws);
	assert.equal(listed?.['isArchived'], true, 'the list marks it archived');
	assert.ok(listed?.['archivedAt']);

	// Nobody joins an archived workspace — the pending invitation waits for a restore.
	const join2 = await call(outsider.token, 'POST', '/workspaces/invitations/accept', { token: pendingToken });
	assert.deepEqual([join2.status, join2.reason], [409, 'WORKSPACE_ARCHIVED']);

	// Another brick reads the flag by shape.
	await call(m.token, 'POST', '/probe', undefined, ws);
	assert.equal(probed, true);

	// Leaving still works.
	assert.equal((await call(m.token, 'POST', '/workspaces/leave', undefined, ws)).status, 200);

	// Restored: writes and joining work again, and the invitation is still good.
	const restored = await call(owner.token, 'POST', '/workspaces/restore', undefined, ws);
	assert.equal(restored.status, 200, JSON.stringify(restored));
	assert.deepEqual(trailOf('fonderie.workspace.restored'), [{ workspaceId: ws, userId: owner.id }]);
	assert.equal((await call(owner.token, 'PUT', '/workspaces/settings', { locale: 'fr-CA' }, ws)).status, 200);
	assert.equal((await call(outsider.token, 'POST', '/workspaces/invitations/accept', { token: pendingToken })).status, 200);
	await call(owner.token, 'POST', '/probe', undefined, ws);
	assert.equal(probed, false);
});

test('only the owner restores; restoring a workspace that is not archived is refused', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	assert.equal((await call(owner.token, 'POST', `/workspaces/members/${m.id}/manager`, {}, ws)).status, 200);
	const notArchived = await call(owner.token, 'POST', '/workspaces/restore', undefined, ws);
	assert.deepEqual([notArchived.status, notArchived.reason], [409, 'WORKSPACE_NOT_ARCHIVED']);
	assert.equal((await call(owner.token, 'POST', '/workspaces/archive', undefined, ws)).status, 200);
	emitted.length = 0;
	const byManager = await call(m.token, 'POST', '/workspaces/restore', undefined, ws);
	assert.deepEqual([byManager.status, byManager.reason], [403, 'OWNER_REQUIRED']);
	assert.deepEqual(trailOf('fonderie.workspace.restored'), [], 'a refused restore leaves no trail');
	assert.equal((await call(owner.token, 'POST', '/workspaces/restore', undefined, ws)).status, 200);
});

test('handing an archived workspace over still works', { skip }, async () => {
	const { owner, ws } = await team();
	const heir = await join(owner, ws);
	assert.equal((await call(owner.token, 'POST', '/workspaces/archive', undefined, ws)).status, 200);
	const step = await call(owner.token, 'POST', '/auth/step-up', { password: 'Aa1!aaaa-bbbb-cccc' });
	const offer = await call(owner.token, 'POST', '/workspaces/transfer-ownership', { userId: heir.id }, ws, { 'x-step-up': step.result['stepUpToken'] as string });
	assert.equal(offer.status, 202, JSON.stringify(offer));
	assert.equal((await call(heir.token, 'POST', '/workspaces/transfer-ownership/accept', undefined, ws)).status, 200);
	// The new owner may restore it.
	assert.equal((await call(heir.token, 'POST', '/workspaces/restore', undefined, ws)).status, 200);
});

// ── seats ────────────────────────────────────────────────────────────────────

test('seats: any member reads used (incl. pending invitations), the plan limit, and what is left', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	await join(owner, ws);
	await call(owner.token, 'POST', '/workspaces/invitations', [{ email: `a-${Date.now()}@${DOMAIN}` }, { email: `b-${Date.now()}@${DOMAIN}` }], ws);

	const unlimited = await call(m.token, 'GET', '/workspaces/seats', undefined, ws);
	assert.equal(unlimited.status, 200, JSON.stringify(unlimited));
	assert.deepEqual(unlimited.result, { used: 4, members: 2, pendingInvites: 2, limit: null, available: null });

	const limited = await call(m.token, 'GET', '/workspaces/seats', undefined, ws, { 'x-test-seat-limit': '5' });
	assert.deepEqual(limited.result, { used: 4, members: 2, pendingInvites: 2, limit: 5, available: 1 });
	// The same number the invite path checks: one more fits, two do not.
	const two = await call(owner.token, 'POST', '/workspaces/invitations', [{ email: `c-${Date.now()}@${DOMAIN}` }, { email: `d-${Date.now()}@${DOMAIN}` }], ws, { 'x-test-seat-limit': '5' });
	assert.equal(two.status, 402, JSON.stringify(two));
	const one = await call(owner.token, 'POST', '/workspaces/invitations', { email: `e-${Date.now()}@${DOMAIN}` }, ws, { 'x-test-seat-limit': '5' });
	assert.equal(one.status, 201, JSON.stringify(one));
	const full = await call(owner.token, 'GET', '/workspaces/seats', undefined, ws, { 'x-test-seat-limit': '5' });
	assert.deepEqual(full.result, { used: 5, members: 2, pendingInvites: 3, limit: 5, available: 0 });

	const outsider = await person('Iris');
	assert.equal((await call(outsider.token, 'GET', '/workspaces/seats', undefined, ws)).status, 403);
});

// ── paging ───────────────────────────────────────────────────────────────────

test('members and invitations page in a stable order; without limit/cursor the whole list comes back as before', { skip }, async () => {
	const { owner, ws } = await team();
	for (let i = 0; i < 4; i++) await join(owner, ws);
	const stamp = Date.now();
	for (let i = 0; i < 5; i++) await call(owner.token, 'POST', '/workspaces/invitations', { email: `inv${i}-${stamp}@${DOMAIN}` }, ws);
	// Same created_at for every membership row: only the tie-break keeps pages stable.
	await store.query(`UPDATE fonderie_role_user_workspaces SET created_at = '2026-01-01T00:00:00.123456Z' WHERE workspace_id = $1`, [ws]);

	const whole = await call(owner.token, 'GET', '/workspaces/members', undefined, ws);
	assert.equal(whole.status, 200);
	assert.equal('nextCursor' in whole.result, false, 'the unpaged response is unchanged');
	const all = (whole.result['members'] as Array<Record<string, any>>).map((x) => x['userId']);
	assert.equal(all.length, 5);

	const seen: string[] = [];
	let cursor: string | null = null;
	let pages = 0;
	do {
		const qs: string = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
		const r = await call(owner.token, 'GET', `/workspaces/members${qs}`, undefined, ws);
		assert.equal(r.status, 200, JSON.stringify(r));
		const rows = r.result['members'] as Array<Record<string, any>>;
		assert.ok(rows.length <= 2);
		seen.push(...rows.map((x) => x['userId'] as string));
		cursor = r.result['nextCursor'] as string | null;
		pages++;
	} while (cursor && pages < 10);
	assert.equal(pages, 3);
	assert.deepEqual(seen, all, 'pages concatenate to the whole list, in its order, no repeats');

	const wholeInv = (await call(owner.token, 'GET', '/workspaces/invitations', undefined, ws)).result['invitations'] as Array<Record<string, any>>;
	assert.equal(wholeInv.length, 5);
	const p1 = await call(owner.token, 'GET', '/workspaces/invitations?limit=3', undefined, ws);
	const p2 = await call(owner.token, 'GET', `/workspaces/invitations?limit=3&cursor=${encodeURIComponent(p1.result['nextCursor'] as string)}`, undefined, ws);
	assert.equal(p2.result['nextCursor'], null, 'the last page says so');
	assert.deepEqual(
		[...p1.result['invitations'], ...p2.result['invitations']].map((x: Record<string, any>) => x['id']),
		wholeInv.map((x) => x['id']),
	);

	const bad = await call(owner.token, 'GET', '/workspaces/members?cursor=not-a-cursor', undefined, ws);
	assert.deepEqual([bad.status, bad.reason], [422, 'INVALID_PARAMETER']);
	const zero = await call(owner.token, 'GET', '/workspaces/invitations?limit=0', undefined, ws);
	assert.equal(zero.status, 422);
});
