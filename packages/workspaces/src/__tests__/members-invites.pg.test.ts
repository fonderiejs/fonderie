import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { MESSAGE_KEYS } from '../config';
import { countOccupiedSeats } from '../services/members';

// Members and invitations on a REAL Postgres, driven over HTTP: one row per
// person, invitation dedup, link + PIN acceptance, owner-only manager grants,
// ownership transfer, leaving, seat counting. These are joins, unique indexes
// and conditional writes — behaviours of the database a mocked store would
// only claim.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'members.acme.example';

let store: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { AuthModule } = await import('@fonderie/auth');
	const { getMigrationsPath: authMigrations } = await import('@fonderie/auth/migrations');
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
		.register(new WorkspacesModule(store, { personalWorkspace: false, invitationUrl: 'https://app.acme.example/invite/{token}' }, bus as never));
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

// ── helpers ──────────────────────────────────────────────────────────────────

interface Person { id: string; email: string; token: string }
let n = 0;

async function call(token: string | null, method: string, path: string, body?: unknown, workspaceId?: string) {
	const res = await fetch(`${base}${path}`, {
		method,
		headers: {
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
	const r = await call(owner.token, 'POST', '/workspaces', { name: `Crew ${n}-${Date.now()}` });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { owner, ws: r.result['workspace'].id as string };
}

function lastInvitationEmail() {
	const m = [...emitted].reverse().find((e) => e.payload['type'] === MESSAGE_KEYS.workspaceInvitation);
	assert.ok(m, 'an invitation email was sent');
	return m.payload as { recipient: { email: string }; data: Record<string, string> };
}

async function join(owner: Person, ws: string, roleId?: string): Promise<Person> {
	const p = await person('Marco');
	const inv = await call(owner.token, 'POST', '/workspaces/invitations', { email: p.email, ...(roleId ? { roleId } : {}) }, ws);
	assert.equal(inv.status, 201, JSON.stringify(inv));
	const { token } = lastInvitationEmail().data;
	const acc = await call(p.token, 'POST', '/workspaces/invitations/accept', { token });
	assert.equal(acc.status, 200, JSON.stringify(acc));
	return p;
}

const members = async (owner: Person, ws: string) =>
	(await call(owner.token, 'GET', '/workspaces/members', undefined, ws)).result['members'] as Array<Record<string, any>>;
const pending = async (owner: Person, ws: string) =>
	(await call(owner.token, 'GET', '/workspaces/invitations', undefined, ws)).result['invitations'] as Array<Record<string, any>>;

// ── invitations ──────────────────────────────────────────────────────────────

test('the invitation email carries a link, the workspace and who invited', { skip }, async () => {
	const { owner, ws } = await team();
	await call(owner.token, 'POST', '/workspaces/invitations', { email: `new-${n}@${DOMAIN}` }, ws);
	const { data } = lastInvitationEmail();
	assert.equal(data['acceptUrl'], `https://app.acme.example/invite/${data['token']}`);
	assert.match(data['workspaceName'] ?? '', /^Crew /);
	assert.equal(data['inviterName'], 'Olivia Tester');
	assert.match(data['pin'] ?? '', /^\d{6}$/);
});

test('inviting with the default role, explicitly, is accepted', { skip }, async () => {
	const { owner, ws } = await team();
	const roles = (await call(owner.token, 'GET', '/workspaces/roles', undefined, ws)).result['roles'] as Array<{ id: string; name: string }>;
	const guest = roles.find((r) => r.name === 'GUEST');
	assert.ok(guest);
	const r = await call(owner.token, 'POST', '/workspaces/invitations', { email: `g-${n}@${DOMAIN}`, roleId: guest.id }, ws);
	assert.equal(r.status, 201, JSON.stringify(r));
});

test('a system manager role cannot be smuggled through an invitation', { skip }, async () => {
	const { owner, ws } = await team();
	const roles = (await call(owner.token, 'GET', '/workspaces/roles', undefined, ws)).result['roles'] as Array<{ id: string; name: string }>;
	const admin = roles.find((r) => r.name === 'ADMIN');
	assert.ok(admin);
	const r = await call(owner.token, 'POST', '/workspaces/invitations', { email: `a-${n}@${DOMAIN}`, roleId: admin.id }, ws);
	assert.equal(r.status, 422);
	assert.equal(r.reason, 'INVALID_ROLE');
});

test('inviting the same address twice keeps ONE pending invitation, whatever the case', { skip }, async () => {
	const { owner, ws } = await team();
	const email = `twice-${n}@${DOMAIN}`;
	await call(owner.token, 'POST', '/workspaces/invitations', { email }, ws);
	await call(owner.token, 'POST', '/workspaces/invitations', { email: email.toUpperCase() }, ws);
	const list = (await pending(owner, ws)).filter((i) => String(i['email']).toLowerCase() === email);
	assert.equal(list.length, 1, JSON.stringify(list));
});

test('resend replaces the code: the old PIN stops working, the new one joins', { skip }, async () => {
	const { owner, ws } = await team();
	const p = await person('Rita');
	await call(owner.token, 'POST', '/workspaces/invitations', { email: p.email }, ws);
	const first = lastInvitationEmail().data;
	const [inv] = await pending(owner, ws);
	const re = await call(owner.token, 'POST', `/workspaces/invitations/${inv!['id']}/resend`, {}, ws);
	assert.equal(re.status, 200, JSON.stringify(re));
	const second = lastInvitationEmail().data;
	assert.notEqual(second['pin'], first['pin']);
	assert.equal((await call(p.token, 'POST', '/workspaces/invitations/accept', { pin: first['pin'] })).status, 400);
	assert.equal((await call(p.token, 'POST', '/workspaces/invitations/accept', { pin: second['pin'] })).status, 200);
});

test('an invitation link joins ONE person, even when two race for it', { skip }, async () => {
	const { owner, ws } = await team();
	const [a, b] = [await person('Ana'), await person('Bea')];
	await call(owner.token, 'POST', '/workspaces/invitations', { email: a.email }, ws);
	const { token } = lastInvitationEmail().data;
	const results = await Promise.all([
		call(a.token, 'POST', '/workspaces/invitations/accept', { token }),
		call(b.token, 'POST', '/workspaces/invitations/accept', { token }),
	]);
	assert.deepEqual(results.map((r) => r.status).sort(), [200, 400], JSON.stringify(results));
	const joined = (await members(owner, ws)).filter((m) => [a.id, b.id].includes(m['userId'] ?? m['id']));
	assert.equal(joined.length, 1, JSON.stringify(joined));
	// A used link stays used.
	assert.equal((await call(a.token, 'POST', '/workspaces/invitations/accept', { token })).status, 400);
});

test('a non-manager cannot resend', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	await call(owner.token, 'POST', '/workspaces/invitations', { email: `x-${n}@${DOMAIN}` }, ws);
	const [inv] = await pending(owner, ws);
	const r = await call(m.token, 'POST', `/workspaces/invitations/${inv!['id']}/resend`, {}, ws);
	assert.equal(r.status, 403);
});

// ── members ──────────────────────────────────────────────────────────────────

test('a member holding two roles is ONE row, with both roles', { skip }, async () => {
	const { owner, ws } = await team();
	const role = await call(owner.token, 'POST', '/workspaces/roles', { name: 'Electrician' }, ws);
	const m = await join(owner, ws);
	assert.equal((await call(owner.token, 'POST', `/workspaces/members/${m.id}/roles`, { roleId: role.result['role'].id }, ws)).status, 200);
	const rows = (await members(owner, ws)).filter((r) => r['userId'] === m.id);
	assert.equal(rows.length, 1, JSON.stringify(rows));
	assert.deepEqual(rows[0]!['roles'].map((r: { name: string }) => r.name).sort(), ['Electrician', 'GUEST']);
	assert.equal(rows[0]!['firstName'], 'Marco');
	const own = (await members(owner, ws)).find((r) => r['userId'] === owner.id);
	assert.equal(own!['isOwner'], true);
	assert.equal(rows[0]!['isOwner'], false);
});

test('assigning a role never makes someone a member', { skip }, async () => {
	const { owner, ws } = await team();
	const role = await call(owner.token, 'POST', '/workspaces/roles', { name: 'Crew lead' }, ws);
	const stranger = await person('Sam');
	const r = await call(owner.token, 'POST', `/workspaces/members/${stranger.id}/roles`, { roleId: role.result['role'].id }, ws);
	assert.equal(r.status, 404, JSON.stringify(r));
	assert.equal((await members(owner, ws)).some((x) => x['userId'] === stranger.id), false);
});

test('only the owner makes or unmakes a manager', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	const other = await join(owner, ws);
	// A plain member cannot invite yet.
	assert.equal((await call(m.token, 'POST', '/workspaces/invitations', { email: `y-${n}@${DOMAIN}` }, ws)).status, 403);
	assert.equal((await call(owner.token, 'POST', `/workspaces/members/${m.id}/manager`, {}, ws)).status, 200);
	assert.equal((await call(m.token, 'POST', '/workspaces/invitations', { email: `y-${n}@${DOMAIN}` }, ws)).status, 201);
	// A manager cannot create another manager.
	assert.equal((await call(m.token, 'POST', `/workspaces/members/${other.id}/manager`, {}, ws)).status, 403);
	const row = (await members(owner, ws)).find((r) => r['userId'] === m.id);
	assert.equal(row!['isManager'], true);
	assert.equal((await call(owner.token, 'DELETE', `/workspaces/members/${m.id}/manager`, undefined, ws)).status, 200);
	assert.equal((await call(m.token, 'POST', '/workspaces/invitations', { email: `z-${n}@${DOMAIN}` }, ws)).status, 403);
});

test('ownership moves to a member; the previous owner stays as a manager', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	assert.equal((await call(m.token, 'POST', '/workspaces/transfer-ownership', { userId: owner.id }, ws)).status, 403);
	const stranger = await person('Lee');
	assert.equal((await call(owner.token, 'POST', '/workspaces/transfer-ownership', { userId: stranger.id }, ws)).status, 404);
	const r = await call(owner.token, 'POST', '/workspaces/transfer-ownership', { userId: m.id }, ws);
	assert.equal(r.status, 200, JSON.stringify(r));
	const rows = await members(m, ws);
	assert.equal(rows.find((x) => x['userId'] === m.id)!['isOwner'], true);
	const prev = rows.find((x) => x['userId'] === owner.id)!;
	assert.equal(prev['isOwner'], false);
	assert.equal(prev['isManager'], true);
	assert.equal((await call(owner.token, 'POST', '/workspaces/transfer-ownership', { userId: owner.id }, ws)).status, 403);
});

test('a member can leave; the owner must hand over first', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	assert.equal((await call(m.token, 'POST', '/workspaces/leave', {}, ws)).status, 200);
	assert.equal((await members(owner, ws)).some((x) => x['userId'] === m.id), false);
	const o = await call(owner.token, 'POST', '/workspaces/leave', {}, ws);
	assert.equal(o.status, 400);
	assert.equal(o.reason, 'OWNER_CANNOT_LEAVE');
});

// ── seats ────────────────────────────────────────────────────────────────────

test('seats count each person once, plus pending invitations, never the owner', { skip }, async () => {
	const { owner, ws } = await team();
	const role = await call(owner.token, 'POST', '/workspaces/roles', { name: 'Apprentice' }, ws);
	const m = await join(owner, ws);
	await call(owner.token, 'POST', `/workspaces/members/${m.id}/roles`, { roleId: role.result['role'].id }, ws);
	await call(owner.token, 'POST', '/workspaces/invitations', { email: `seat-${n}@${DOMAIN}` }, ws);
	// m (two roles) = 1, one pending invite = 1, owner = 0.
	assert.equal(await countOccupiedSeats(ws, store), 2);
	// A pending invite to someone already a member takes no extra seat.
	await call(owner.token, 'POST', '/workspaces/invitations', { email: m.email }, ws);
	assert.equal(await countOccupiedSeats(ws, store), 2);
});

// ── the current workspace and its settings ───────────────────────────────────

test('GET /workspaces/current answers the workspace the request is scoped to', { skip }, async () => {
	const { owner, ws } = await team();
	const r = await call(owner.token, 'GET', '/workspaces/current', undefined, ws);
	assert.equal(r.status, 200, JSON.stringify(r));
	assert.equal(r.result['workspace'].id, ws);
});

test('updating one setting keeps the others', { skip }, async () => {
	const { owner, ws } = await team();
	await call(owner.token, 'PUT', '/workspaces/settings', { locale: 'fr-CA' }, ws);
	await call(owner.token, 'PUT', '/workspaces/settings', { timezone: 'America/Toronto' }, ws);
	const s = (await call(owner.token, 'GET', '/workspaces/settings', undefined, ws)).result['settings'] as Record<string, string>;
	assert.equal(s['locale'], 'fr-CA');
	assert.equal(s['timezone'], 'America/Toronto');
});

test("an invitation is written in the business's language for someone without an account", { skip }, async () => {
	const { owner, ws } = await team();
	assert.equal((await call(owner.token, 'PUT', '/workspaces/settings', { locale: 'fr-CA' }, ws)).status, 200);
	await call(owner.token, 'POST', '/workspaces/invitations', { email: `nouveau-${n}@${DOMAIN}` }, ws);
	const m = [...emitted].reverse().find((e) => e.payload['type'] === MESSAGE_KEYS.workspaceInvitation);
	assert.equal(m?.payload['fallbackLocale'], 'fr-CA');
	assert.equal(m?.payload['locale'], undefined, "no explicit locale: the invitee's own account, when they have one, wins in courier");
});
