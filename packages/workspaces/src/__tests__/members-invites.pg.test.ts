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

test('a member who deleted their account leaves the team list (no name, email or photo) until they restore it', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	const listed = async () => (await members(owner, ws)).some((x) => (x['userId'] ?? x['id']) === m.id);
	assert.equal(await listed(), true);
	await store.query(`UPDATE fonderie_users SET deleted_at = now() WHERE id = $1`, [m.id]);
	assert.equal(await listed(), false, 'archived account hidden');
	await store.query(`UPDATE fonderie_users SET deleted_at = NULL WHERE id = $1`, [m.id]);
	assert.equal(await listed(), true, 'restored account back on the team');
});

test('deleting an account is refused while it owns a team with other members — not for a solo or handed-over team', { skip }, async () => {
	const { accountDeletionBlocker } = await import('../account-deletion');
	const blocker = accountDeletionBlocker(store);
	const { owner, ws } = await team();
	assert.equal(await blocker(owner.id), null, 'a team with nobody else in it goes with the account');
	const m = await join(owner, ws);
	const refusal = await blocker(owner.id);
	assert.equal(refusal?.reason, 'OWNS_TEAM_WORKSPACE');
	assert.match(String(refusal?.details?.['workspaceIds']), new RegExp(ws));
	assert.equal(await blocker(m.id), null, 'a plain member is never blocked');
	// Handed over: the former owner may go.
	assert.equal((await call(owner.token, 'POST', '/workspaces/transfer-ownership', { userId: m.id }, ws)).status, 200);
	assert.equal(await blocker(owner.id), null);
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

// ── Races: concurrent changes to one team are applied one at a time ──────────

test('race: five invites at once with ONE seat left — exactly one gets it', { skip }, async () => {
	const { invitationController } = await import('../controllers/invitation.controller');
	const { owner, ws } = await team();
	const ctrl = invitationController(store, '7d');
	const ctx = (email: string) => ({
		workspace: { id: ws, isPersonal: false, ownerId: owner.id },
		user: { id: owner.id, email: owner.email },
		meta: { body: { email }, billing: { statuses: { seats: { type: 'limit', limit: 1 } } } },
		request: new Request('http://x/workspaces/invitations', { method: 'POST' }),
	}) as never;
	const replies = await Promise.all(
		[1, 2, 3, 4, 5].map((i) => ctrl.invite(ctx(`seat${i}-${Date.now()}@${DOMAIN}`))),
	);
	const statuses = replies.map((r) => r.status).sort();
	assert.deepEqual(statuses, [201, 402, 402, 402, 402], `the plan allows one seat: ${statuses}`);
	assert.equal(await countOccupiedSeats(ws, store), 1);
});

test('race: two ownership transfers at once — one applies, the other says so', { skip }, async () => {
	const { owner, ws } = await team();
	const [a, b] = [await join(owner, ws), await join(owner, ws)];
	const replies = await Promise.all(
		[a, b].map((p) => call(owner.token, 'POST', '/workspaces/transfer-ownership', { userId: p.id }, ws)),
	);
	assert.deepEqual(replies.map((r) => r.status).sort(), [200, 404], JSON.stringify(replies.map((r) => r.reason)));
	const [row] = await store.query<{ ownerId: string }>(`SELECT owner_id AS "ownerId" FROM fonderie_workspaces WHERE id = $1`, [ws]);
	const winner = replies[0]!.status === 200 ? a : b;
	assert.equal(row!.ownerId, winner.id, 'the owner is the one the successful transfer named');
});

test('race: two saves of a role\'s permissions — the result is one of them, never the union', { skip }, async () => {
	const { owner, ws } = await team();
	const role = await call(owner.token, 'POST', '/workspaces/roles', { name: `Crew ${Date.now()}` }, ws);
	const id = role.result['role'].id as string;
	const sets = [
		[{ permissionKey: 'jobs', canRead: true }],
		[{ permissionKey: 'customers', canRead: true }, { permissionKey: 'estimates', canRead: true }],
	];
	for (let round = 0; round < 5; round++) {
		await Promise.all(sets.map((permissions) => call(owner.token, 'POST', `/workspaces/roles/${id}/permissions`, { permissions }, ws)));
		const keys = (await store.query<{ k: string }>(`SELECT permission_key AS k FROM fonderie_role_permissions WHERE role_id = $1 ORDER BY 1`, [id])).map((r) => r.k);
		assert.ok(
			JSON.stringify(keys) === '["jobs"]' || JSON.stringify(keys) === '["customers","estimates"]',
			`round ${round}: ${JSON.stringify(keys)} is a mix of two saves`,
		);
	}
});

test('race: removing a member while a role is assigned to them never leaves a removed person holding a role', { skip }, async () => {
	const { owner, ws } = await team();
	const role = await call(owner.token, 'POST', '/workspaces/roles', { name: `Lead ${Date.now()}` }, ws);
	for (let round = 0; round < 5; round++) {
		const m = await join(owner, ws);
		const [removed] = await Promise.all([
			call(owner.token, 'DELETE', `/workspaces/members/${m.id}`, undefined, ws),
			call(owner.token, 'POST', `/workspaces/members/${m.id}/roles`, { roleId: role.result['role'].id }, ws),
		]);
		assert.equal(removed.status, 200);
		const live = await store.query(`SELECT 1 FROM fonderie_role_user_workspaces WHERE user_id = $1 AND workspace_id = $2 AND removed = false`, [m.id, ws]);
		assert.equal(live.length, 0, `round ${round}: the removed person still holds a live role`);
	}
});

// ── Insider threat, Phase 1 (docs/INSIDER-THREAT-DESIGN.md) ─────────────────

const trailOf = (type: string) => emitted.filter((e) => e.type === type).map((e) => e.payload);

test('a rogue manager cannot remove another manager; the owner can; anyone else they can', { skip }, async () => {
	const { owner, ws } = await team();
	const [rogue, peer, plain] = [await join(owner, ws), await join(owner, ws), await join(owner, ws)];
	for (const p of [rogue, peer]) assert.equal((await call(owner.token, 'POST', `/workspaces/members/${p.id}/manager`, {}, ws)).status, 200);

	const r = await call(rogue.token, 'DELETE', `/workspaces/members/${peer.id}`, undefined, ws);
	assert.deepEqual([r.status, r.reason], [403, 'MANAGER_PROTECTED']);
	assert.ok((await members(owner, ws)).some((m) => m['userId'] === peer.id), 'the other manager is still in the team');
	assert.equal(trailOf('fonderie.workspace.member.removed').length, 0, 'a refused removal leaves no trail event');

	assert.equal((await call(rogue.token, 'DELETE', `/workspaces/members/${plain.id}`, undefined, ws)).status, 200, 'a manager still removes a plain member');
	assert.equal((await call(owner.token, 'DELETE', `/workspaces/members/${peer.id}`, undefined, ws)).status, 200, 'the owner removes a manager');
	assert.equal((await call(rogue.token, 'POST', '/workspaces/leave', undefined, ws)).status, 200, 'a manager can still leave');
});

test('only the owner archives the workspace', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	assert.equal((await call(owner.token, 'POST', `/workspaces/members/${m.id}/manager`, {}, ws)).status, 200);
	const r = await call(m.token, 'POST', '/workspaces/archive', undefined, ws);
	assert.deepEqual([r.status, r.reason], [403, 'OWNER_REQUIRED']);
	assert.equal((await call(owner.token, 'POST', '/workspaces/archive', undefined, ws)).status, 200);
	assert.deepEqual(trailOf('fonderie.workspace.archived').map((p) => p['userId']), [owner.id]);
});

test('every team change leaves a trail event: which workspace, who did it, to whom — ids only', { skip }, async () => {
	const { owner, ws } = await team();
	const m = await join(owner, ws);
	const target = await join(owner, ws);
	await call(owner.token, 'POST', `/workspaces/members/${m.id}/manager`, {}, ws);
	const role = await call(m.token, 'POST', '/workspaces/roles', { name: 'Crew lead' }, ws);
	const roleId = role.result['role'].id as string;
	await call(m.token, 'POST', `/workspaces/roles/${roleId}/permissions`, { permissions: [] }, ws);
	await call(m.token, 'POST', `/workspaces/members/${target.id}/roles`, { roleId }, ws);
	await call(m.token, 'DELETE', `/workspaces/members/${target.id}/roles/${roleId}`, undefined, ws);
	await call(m.token, 'DELETE', `/workspaces/members/${target.id}`, undefined, ws);
	await call(m.token, 'DELETE', `/workspaces/roles/${roleId}`, undefined, ws);
	await call(owner.token, 'DELETE', `/workspaces/members/${m.id}/manager`, undefined, ws);

	const expect = (type: string, facts: Record<string, unknown>) => {
		const hit = trailOf(type).find((p) => Object.entries({ workspaceId: ws, ...facts }).every(([k, v]) => p[k] === v));
		assert.ok(hit, `${type} ${JSON.stringify(facts)} in ${JSON.stringify(trailOf(type))}`);
	};
	expect('fonderie.workspace.invitation.accepted', { userId: target.id });
	expect('fonderie.workspace.manager.set', { userId: owner.id, targetUserId: m.id });
	expect('fonderie.workspace.role.created', { userId: m.id, roleId });
	expect('fonderie.workspace.role.permissions.set', { userId: m.id, roleId });
	expect('fonderie.workspace.member.role.added', { userId: m.id, targetUserId: target.id, roleId });
	expect('fonderie.workspace.member.role.removed', { userId: m.id, targetUserId: target.id, roleId });
	expect('fonderie.workspace.member.removed', { userId: m.id, targetUserId: target.id });
	expect('fonderie.workspace.role.deleted', { userId: m.id, roleId });
	expect('fonderie.workspace.manager.unset', { userId: owner.id, targetUserId: m.id });
	const invites = trailOf('fonderie.workspace.invitation.created').filter((p) => p['workspaceId'] === ws);
	assert.ok(invites.length >= 2 && invites.every((p) => Array.isArray(p['inviteIds']) && (p['inviteIds'] as string[]).length === 1));

	const all = JSON.stringify(emitted.filter((e) => e.type.startsWith('fonderie.workspace.')));
	for (const p of [owner, m, target]) assert.ok(!all.includes(p.email), 'no address in the trail');
	assert.ok(!all.includes('Crew lead'), 'no names in the trail');
});

// ── Insider threat, Phase 2: tell people ────────────────────────────────────

test('people are told: the removed member, the owner when a manager removed them, the ex-manager, the new owner', { skip }, async () => {
	const { sendTeamNotice } = await import('../services/team-notices');
	const { owner, ws } = await team();
	const [mgr, victim, heir] = [await join(owner, ws), await join(owner, ws), await join(owner, ws)];
	await call(owner.token, 'POST', `/workspaces/members/${mgr.id}/manager`, {}, ws);
	await call(mgr.token, 'DELETE', `/workspaces/members/${victim.id}`, undefined, ws);
	await call(owner.token, 'DELETE', `/workspaces/members/${mgr.id}/manager`, undefined, ws);

	// Replay the trail through the notice sender, as the bus subscriber does —
	// step by step: a notice reads who owns the team when it is sent.
	const notices: Array<{ type: string; to: string; data: Record<string, string> }> = [];
	const bus = { emit: async (_t: string, p: any) => void notices.push({ type: p.type, to: p.recipient.email, data: p.data }) };
	const replay = async () => {
		for (const e of emitted.splice(0).filter((x) => x.payload['workspaceId'] === ws && x.type.startsWith('fonderie.workspace.')))
			await sendTeamNotice(store, bus, e.type, e.payload as never);
	};
	await replay();
	await call(owner.token, 'POST', '/workspaces/transfer-ownership', { userId: heir.id }, ws);
	await replay();

	const got = (type: string) => notices.filter((x) => x.type === type);
	assert.deepEqual(got('workspace-member-removed').map((x) => x.to), [victim.email], 'the removed member is told');
	assert.equal(got('workspace-member-removed')[0]!.data['actorName'], 'Marco Tester', 'and by whom');
	assert.deepEqual(got('workspace-member-removed-alert').map((x) => x.to), [owner.email], 'the owner hears a manager removed someone');
	assert.deepEqual(got('workspace-manager-removed').map((x) => x.to), [mgr.email]);
	assert.deepEqual(got('workspace-ownership-received').map((x) => x.to), [heir.email]);
	assert.equal(got('workspace-ownership-received')[0]!.data['previousOwnerName'], 'Olivia Tester');
	assert.ok(notices.every((x) => x.data['workspaceName']?.startsWith('Crew ')));
});

test('no owner alert when the owner removed someone; nobody is written to about their own leaving', { skip }, async () => {
	const { sendTeamNotice } = await import('../services/team-notices');
	const { owner, ws } = await team();
	const [a, b] = [await join(owner, ws), await join(owner, ws)];
	await call(owner.token, 'DELETE', `/workspaces/members/${a.id}`, undefined, ws);
	await call(b.token, 'POST', '/workspaces/leave', undefined, ws);
	const notices: string[] = [];
	const bus = { emit: async (_t: string, p: any) => void notices.push(`${p.type}→${p.recipient.email}`) };
	for (const e of emitted.filter((x) => x.payload['workspaceId'] === ws)) await sendTeamNotice(store, bus, e.type, e.payload as never);
	assert.deepEqual(notices, [`workspace-member-removed→${a.email}`]);
});

// ── Insider threat, Phase 3: the undo bin for roles ─────────────────────────

test('a deleted role comes back from the bin: same id, its permissions, its holders — and they leave the default role again', { skip }, async () => {
	const { owner, ws } = await team();
	const mgr = await join(owner, ws);
	await call(owner.token, 'POST', `/workspaces/members/${mgr.id}/manager`, {}, ws);
	const role = (await call(mgr.token, 'POST', '/workspaces/roles', { name: `Lead ${n}` }, ws)).result['role'] as { id: string };
	// solo joins WITH this role as their only one; both holds it and another.
	const [solo, both] = [await join(owner, ws, role.id), await join(owner, ws)];
	const extra = (await call(mgr.token, 'POST', '/workspaces/roles', { name: `Extra ${n}` }, ws)).result['role'] as { id: string };
	await call(mgr.token, 'POST', `/workspaces/roles/${role.id}/permissions`, { permissions: [{ permissionKey: 'customers', canCreate: true, canRead: true, canUpdate: false, canDelete: false }] }, ws);
	await call(mgr.token, 'POST', `/workspaces/members/${both.id}/roles`, { roleId: role.id }, ws);
	await call(mgr.token, 'POST', `/workspaces/members/${both.id}/roles`, { roleId: extra.id }, ws);
	const guestOf = async (id: string) => ((await members(owner, ws)).find((m) => m['userId'] === id)!['roles'] as Array<{ name: string }>).map((r) => r.name).sort();
	const roleNamesBefore = { solo: await guestOf(solo.id), both: await guestOf(both.id) };
	assert.equal(roleNamesBefore.solo.length, 1, 'solo holds one role');
	assert.match(roleNamesBefore.solo[0]!, /^Lead /, 'and it is this one');
	const permsBefore = (await call(owner.token, 'GET', `/workspaces/roles/${role.id}/permissions`, undefined, ws)).result;

	const del = await call(mgr.token, 'DELETE', `/workspaces/roles/${role.id}`, undefined, ws);
	assert.equal(del.status, 200, JSON.stringify(del));
	const bin = (await call(mgr.token, 'GET', '/workspaces/roles/bin', undefined, ws)).result['roles'] as Array<{ id: string; name: string; holders: number }>;
	assert.deepEqual(bin.map((b) => [b.id, b.holders]), [[role.id, 2]]);
	assert.deepEqual(await guestOf(solo.id), ['GUEST'], 'the delete moved solo to the default role');

	// A manager cannot empty the bin — that would let them erase the undo.
	const purge = await call(mgr.token, 'DELETE', `/workspaces/roles/bin/${role.id}`, undefined, ws);
	assert.deepEqual([purge.status, purge.reason], [403, 'OWNER_REQUIRED']);

	const r = await call(mgr.token, 'POST', `/workspaces/roles/bin/${role.id}/restore`, undefined, ws);
	assert.deepEqual([r.status, r.reason, r.result['reassigned']], [200, 'ROLE_RESTORED', 2], JSON.stringify(r));
	assert.equal(r.result['role'].id, role.id, 'same id');
	assert.deepEqual((await call(owner.token, 'GET', `/workspaces/roles/${role.id}/permissions`, undefined, ws)).result, permsBefore, 'its permissions');
	assert.deepEqual({ solo: await guestOf(solo.id), both: await guestOf(both.id) }, roleNamesBefore, 'everyone holds exactly what they held before');
	assert.ok(trailOf('fonderie.workspace.role.restored').some((p) => p['roleId'] === role.id && p['userId'] === mgr.id), 'restore is in the trail');
});

test('a role whose name was taken meanwhile is not restored over it; the owner can empty the bin', { skip }, async () => {
	const { owner, ws } = await team();
	const role = (await call(owner.token, 'POST', '/workspaces/roles', { name: `Dup ${n}` }, ws)).result['role'] as { id: string; name: string };
	await call(owner.token, 'DELETE', `/workspaces/roles/${role.id}`, undefined, ws);
	assert.equal((await call(owner.token, 'POST', '/workspaces/roles', { name: role.name }, ws)).status, 201);
	const r = await call(owner.token, 'POST', `/workspaces/roles/bin/${role.id}/restore`, undefined, ws);
	assert.deepEqual([r.status, r.reason], [409, 'RESTORE_CONFLICT']);
	assert.equal(((await call(owner.token, 'GET', '/workspaces/roles/bin', undefined, ws)).result['roles'] as unknown[]).length, 1, 'still in the bin');
	assert.equal((await call(owner.token, 'DELETE', `/workspaces/roles/bin/${role.id}`, undefined, ws)).status, 204);
	assert.equal((await call(owner.token, 'POST', `/workspaces/roles/bin/${role.id}/restore`, undefined, ws)).status, 404);
});
