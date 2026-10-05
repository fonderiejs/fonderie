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
	const json = (await res.json().catch(() => ({}))) as { reason?: string; explanation?: string; result?: Record<string, unknown>; details?: Record<string, unknown> };
	return {
		status: res.status,
		reason: json.reason,
		explanation: json.explanation ?? '',
		result: (json.result ?? {}) as Record<string, any>,
		details: (json.details ?? {}) as Record<string, any>,
	};
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
	const old = await call(p.token, 'POST', '/workspaces/invitations/accept', { pin: first['pin'] });
	assert.equal(old.status, 404);
	assert.equal(old.reason, 'INVITATION_NOT_FOUND');
	// …and the old LINK too: a resend replaces the token.
	const oldLink = await call(p.token, 'POST', '/workspaces/invitations/accept', { token: first['token'] });
	assert.equal(oldLink.reason, 'INVITATION_NOT_FOUND');
	assert.equal((await call(p.token, 'POST', '/workspaces/invitations/accept', { pin: second['pin'] })).status, 200);
});

test('an invitation link joins ONCE, even when a double tap races it', { skip }, async () => {
	const { owner, ws } = await team();
	const a = await person('Ana');
	await call(owner.token, 'POST', '/workspaces/invitations', { email: a.email }, ws);
	const { token } = lastInvitationEmail().data;
	const results = await Promise.all([
		call(a.token, 'POST', '/workspaces/invitations/accept', { token }),
		call(a.token, 'POST', '/workspaces/invitations/accept', { token }),
	]);
	assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], JSON.stringify(results));
	assert.equal(results.find((r) => r.status === 409)!.reason, 'INVITATION_ALREADY_USED');
	const joined = (await members(owner, ws)).filter((m) => (m['userId'] ?? m['id']) === a.id);
	assert.equal(joined.length, 1, JSON.stringify(joined));
	// A used link stays used — and says so.
	const again = await call(a.token, 'POST', '/workspaces/invitations/accept', { token });
	assert.equal(again.status, 409);
	assert.equal(again.reason, 'INVITATION_ALREADY_USED');
});

test('a link only joins the account it was sent to: another signed-in account is told which email to use', { skip }, async () => {
	const { owner, ws } = await team();
	const [invited, other] = [await person('Ana'), await person('Bea')];
	await call(owner.token, 'POST', '/workspaces/invitations', { email: invited.email }, ws);
	const { token } = lastInvitationEmail().data;
	const r = await call(other.token, 'POST', '/workspaces/invitations/accept', { token });
	assert.equal(r.status, 403);
	assert.equal(r.reason, 'INVITATION_EMAIL_MISMATCH');
	assert.equal(r.details['email'], `p***@${DOMAIN}`);
	assert.ok(!r.explanation.includes(invited.email), 'the full invited address is not revealed');
	assert.equal((await members(owner, ws)).some((m) => (m['userId'] ?? m['id']) === other.id), false);
	// The refusal did not spend the link: the invitee still joins with it.
	assert.equal((await call(invited.token, 'POST', '/workspaces/invitations/accept', { token })).status, 200);
});

test("an invite sent to a '+tag' address is the same person: link and PIN both join the base account", { skip }, async () => {
	const { owner, ws } = await team();
	const [byLink, byPin] = [await person('Lin'), await person('Pia')];
	const alias = (email: string) => email.replace('@', '+crew@').replace(/^./, (c) => c.toUpperCase());

	await call(owner.token, 'POST', '/workspaces/invitations', { email: alias(byLink.email) }, ws);
	const link = lastInvitationEmail();
	assert.equal(link.recipient.email, alias(byLink.email).toLowerCase(), 'the email goes to the address as typed');
	const l = await call(byLink.token, 'POST', '/workspaces/invitations/accept', { token: link.data['token'] });
	assert.equal(l.status, 200, JSON.stringify(l));

	await call(owner.token, 'POST', '/workspaces/invitations', { email: alias(byPin.email) }, ws);
	const p = await call(byPin.token, 'POST', '/workspaces/invitations/accept', { pin: lastInvitationEmail().data['pin'] });
	assert.equal(p.status, 200, JSON.stringify(p));

	const joined = (await members(owner, ws)).map((m) => m['userId'] ?? m['id']);
	assert.ok(joined.includes(byLink.id) && joined.includes(byPin.id), JSON.stringify(joined));
});

test('an expired or cancelled invitation says which', { skip }, async () => {
	const { owner, ws } = await team();
	const [p, q] = [await person('Eve'), await person('Cy')];
	await call(owner.token, 'POST', '/workspaces/invitations', { email: p.email }, ws);
	const expiredToken = lastInvitationEmail().data['token']!;
	await store.query(`UPDATE fonderie_workspace_invitations SET expires_at = now() - interval '1 day' WHERE token = $1`, [expiredToken]);
	const e = await call(p.token, 'POST', '/workspaces/invitations/accept', { token: expiredToken });
	assert.deepEqual([e.status, e.reason], [410, 'INVITATION_EXPIRED']);

	await call(owner.token, 'POST', '/workspaces/invitations', { email: q.email }, ws);
	const cancelledToken = lastInvitationEmail().data['token']!;
	const inv = (await pending(owner, ws)).find((i) => i['email'] === q.email.toLowerCase());
	assert.equal((await call(owner.token, 'DELETE', `/workspaces/invitations/${inv!['id']}`, undefined, ws)).status, 200);
	const c = await call(q.token, 'POST', '/workspaces/invitations/accept', { token: cancelledToken });
	assert.deepEqual([c.status, c.reason], [410, 'INVITATION_REVOKED']);

	const nope = await call(q.token, 'POST', '/workspaces/invitations/accept', { token: 'not-a-real-token' });
	assert.deepEqual([nope.status, nope.reason], [404, 'INVITATION_NOT_FOUND']);
});

test('an account with no email (phone sign-up) accepts with the link; "email" mode refuses it, "any" lets anyone', { skip }, async () => {
	const { acceptInvitationByToken, InvitationError } = await import('../services/invitations');
	const { owner, ws } = await team();
	const phoneOnly = await person('Pat');
	const fresh = async (): Promise<string> => {
		await call(owner.token, 'POST', '/workspaces/invitations', { email: `x${++n}-${Date.now()}@${DOMAIN}` }, ws);
		return lastInvitationEmail().data['token']!;
	};
	await assert.rejects(
		acceptInvitationByToken(await fresh(), phoneOnly.id, store, { email: null, match: 'email' }),
		(err: unknown) => err instanceof InvitationError && err.reason === 'INVITATION_EMAIL_MISMATCH',
	);
	assert.equal((await acceptInvitationByToken(await fresh(), phoneOnly.id, store, { email: null })).workspaceId, ws);
	const someoneElse = await person('Zed');
	assert.equal((await acceptInvitationByToken(await fresh(), someoneElse.id, store, { email: someoneElse.email, match: 'any' })).workspaceId, ws);
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

test("a rogue manager cannot strip manager rights — from another manager or from the owner", { skip }, async () => {
	const { owner, ws } = await team();
	const [rogue, peer] = [await join(owner, ws), await join(owner, ws)];
	for (const p of [rogue, peer]) assert.equal((await call(owner.token, 'POST', `/workspaces/members/${p.id}/manager`, {}, ws)).status, 200);
	const roles = (await call(owner.token, 'GET', '/workspaces/roles', undefined, ws)).result['roles'] as Array<{ id: string; name: string }>;
	const admin = roles.find((r) => r.name === 'ADMIN')!;
	const decoy = await call(owner.token, 'POST', '/workspaces/roles', { name: 'Decoy' }, ws);

	// The attack: give the target a custom role (so ADMIN is not their "last"
	// role), then delete their ADMIN row.
	for (const target of [peer.id, owner.id]) {
		await call(rogue.token, 'POST', `/workspaces/members/${target}/roles`, { roleId: decoy.result['role'].id }, ws);
		const r = await call(rogue.token, 'DELETE', `/workspaces/members/${target}/roles/${admin.id}`, undefined, ws);
		assert.deepEqual([r.status, r.reason], [403, 'SYSTEM_ROLE'], `stripping ${target === owner.id ? 'the owner' : 'a manager'}`);
	}
	const after = await members(owner, ws);
	assert.equal(after.find((m) => m['userId'] === peer.id)!['isManager'], true, 'the other manager keeps manager rights');
	const ownerRoles = after.find((m) => m['userId'] === owner.id)!['roles'].map((r: { name: string }) => r.name);
	assert.ok(ownerRoles.includes('ADMIN'), `the owner keeps ADMIN: ${ownerRoles}`);
	// Custom roles still come off normally; the owner's own control still works.
	assert.equal((await call(rogue.token, 'DELETE', `/workspaces/members/${peer.id}/roles/${decoy.result['role'].id}`, undefined, ws)).status, 200);
	assert.equal((await call(owner.token, 'DELETE', `/workspaces/members/${peer.id}/manager`, undefined, ws)).status, 200);
});

test('two role removals racing for a two-role member never leave them with none', { skip }, async () => {
	const { owner, ws } = await team();
	const [a, b] = [
		await call(owner.token, 'POST', '/workspaces/roles', { name: 'Roofer' }, ws),
		await call(owner.token, 'POST', '/workspaces/roles', { name: 'Glazier' }, ws),
	];
	const m = await join(owner, ws);
	for (const r of [a, b]) await call(owner.token, 'POST', `/workspaces/members/${m.id}/roles`, { roleId: r.result['role'].id }, ws);
	const roles = (await call(owner.token, 'GET', '/workspaces/roles', undefined, ws)).result['roles'] as Array<{ id: string; name: string }>;
	const guest = roles.find((r) => r.name === 'GUEST')!;
	// Remove GUEST first? It is a system role — refused. So race the two custom ones,
	// after which GUEST must remain.
	assert.equal((await call(owner.token, 'DELETE', `/workspaces/members/${m.id}/roles/${guest.id}`, undefined, ws)).reason, 'SYSTEM_ROLE');
	const results = await Promise.all([a, b].map((r) => call(owner.token, 'DELETE', `/workspaces/members/${m.id}/roles/${r.result['role'].id}`, undefined, ws)));
	assert.deepEqual(results.map((r) => r.status), [200, 200]);
	const row = (await members(owner, ws)).find((x) => x['userId'] === m.id);
	assert.deepEqual(row!['roles'].map((r: { name: string }) => r.name), ['GUEST']);
	// And the last role never comes off.
	const last = await call(owner.token, 'DELETE', `/workspaces/members/${m.id}/roles/${a.result['role'].id}`, undefined, ws);
	assert.deepEqual([last.status, last.reason], [404, 'ROLE_NOT_HELD']);
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
