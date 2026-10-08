import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { requireAuth as requireAuthMw } from '@fonderie/core/middlewares';

import { WorkspacesModule } from '../module';
import { withWorkspace as withWorkspaceMw } from '../middlewares/workspace-context';
import { getMigrationsPath } from '../migrations';
import { MESSAGE_KEYS } from '../config';

// Permissions end to end on a REAL Postgres, driven over HTTP: catalog → system
// grants from config → stored custom-role grants → route guard → the
// effective-permissions read a client gates its UI on. Every allow has its
// refusal beside it, and removing a grant must flip the answer — RBAC bugs
// live in the joins (multi-role members, system vs local roles, deleted
// roles), not in a middleware's if.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'perms.acme.example';

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
	const { PermissionsModule, requirePermission } = await import('@fonderie/permissions');
	const { getMigrationsPath: permMigrations } = await import('@fonderie/permissions/migrations');
	await new InternalMigrationRunner(store, permMigrations()).run();
	const bus = {
		emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }),
		on() {},
		subscribe() {},
	};
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } }))
		.register(new AuthModule(store, { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email'], rateLimit: false } as never, bus as never))
		.register(new PermissionsModule(store, {
			superRole: 'ADMIN',
			catalog: [
				{ key: 'jobs', label: 'Jobs' },
				{ key: 'reports', operations: ['read'] },
			],
			systemGrants: { GUEST: { jobs: ['read'] } },
		}))
		.register(new WorkspacesModule(store, { personalWorkspace: false, invitationUrl: 'https://app.acme.example/invite/{token}' }, bus as never))
		.register({
			name: 'test-jobs',
			install(a: { addRoute: (m: string, p: string, ...h: unknown[]) => void }) {
				const ok = async () => new Response(JSON.stringify({ status: 200, reason: 'OK', result: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
				a.addRoute('GET', '/jobs', requireAuthMw, withWorkspaceMw(store), requirePermission('read', 'jobs'), ok);
				a.addRoute('POST', '/jobs', requireAuthMw, withWorkspaceMw(store), requirePermission('create', 'jobs'), ok);
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
	const r = await call(owner.token, 'POST', '/workspaces', { name: `Perm ${n}-${Date.now()}` });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { owner, ws: r.result['workspace'].id as string };
}

async function join(owner: Person, ws: string, roleId?: string): Promise<Person> {
	const p = await person('Marco');
	const inv = await call(owner.token, 'POST', '/workspaces/invitations', { email: p.email, ...(roleId ? { roleId } : {}) }, ws);
	assert.equal(inv.status, 201, JSON.stringify(inv));
	const m = [...emitted].reverse().find((e) => e.payload['type'] === MESSAGE_KEYS.workspaceInvitation);
	const token = (m!.payload['data'] as Record<string, string>)['token'];
	const acc = await call(p.token, 'POST', '/workspaces/invitations/accept', { token });
	assert.equal(acc.status, 200, JSON.stringify(acc));
	return p;
}

async function role(owner: Person, ws: string, name: string, grants: Array<Record<string, unknown>>): Promise<string> {
	const r = await call(owner.token, 'POST', '/workspaces/roles', { name: `${name} ${n}` }, ws);
	assert.equal(r.status, 201, JSON.stringify(r));
	const id = r.result['role'].id as string;
	const s = await call(owner.token, 'POST', `/workspaces/roles/${id}/permissions`, { permissions: grants }, ws);
	assert.equal(s.status, 200, JSON.stringify(s));
	return id;
}

const mine = async (p: Person, ws: string) => (await call(p.token, 'GET', '/workspaces/current/permissions', undefined, ws)).result;
const jobs = async (p: Person, ws: string, method: 'GET' | 'POST') => (await call(p.token, method, '/jobs', method === 'POST' ? {} : undefined, ws)).status;

// ── catalog ──────────────────────────────────────────────────────────────────

test('the catalog lists what the app checks, with each resource\'s operations', { skip }, async () => {
	const { owner, ws } = await team();
	const r = await call(owner.token, 'GET', '/workspaces/permissions/catalog', undefined, ws);
	assert.equal(r.status, 200);
	assert.equal(r.result['declared'], true);
	assert.deepEqual(r.result['catalog'], [
		{ key: 'jobs', operations: ['create', 'read', 'update', 'delete'], label: 'Jobs', description: '' },
		{ key: 'reports', operations: ['read'], label: 'reports', description: '' },
	]);
	// The configured system-role grants — never stored as rows — come with it,
	// so a role editor shows what GUEST may do instead of hard-coding it.
	assert.deepEqual(r.result['systemGrants'], { GUEST: { jobs: ['read'] } });
});

test('the catalog is readable by any member, systemGrants included', { skip }, async () => {
	const { owner, ws } = await team();
	const guest = await join(owner, ws);
	const r = await call(guest.token, 'GET', '/workspaces/permissions/catalog', undefined, ws);
	assert.equal(r.status, 200);
	assert.deepEqual(r.result['systemGrants'], { GUEST: { jobs: ['read'] } });
});

// ── owner / super role ───────────────────────────────────────────────────────

test('the owner (super role) may do everything the catalog lists', { skip }, async () => {
	const { owner, ws } = await team();
	const me = await mine(owner, ws);
	assert.equal(me['isOwner'], true);
	assert.equal(me['isManager'], true);
	assert.equal(me['isSuper'], true);
	assert.deepEqual(me['permissions'], {
		jobs: { create: true, read: true, update: true, delete: true },
		reports: { create: false, read: true, update: false, delete: false },
	});
	assert.equal(await jobs(owner, ws, 'POST'), 200);
});

// ── the default role: rights from config ─────────────────────────────────────

test('an invited member gets exactly the GUEST rights in config: read jobs, nothing else', { skip }, async () => {
	const { owner, ws } = await team();
	const guest = await join(owner, ws);
	const me = await mine(guest, ws);
	assert.equal(me['isOwner'], false);
	assert.equal(me['isManager'], false);
	assert.equal(me['isSuper'], false);
	assert.deepEqual(me['permissions'], {
		jobs: { create: false, read: true, update: false, delete: false },
		reports: { create: false, read: false, update: false, delete: false },
	});
	assert.equal(await jobs(guest, ws, 'GET'), 200);
	assert.equal(await jobs(guest, ws, 'POST'), 403);
});

test("a workspace's own role named GUEST gets none of the system GUEST's rights", { skip }, async () => {
	const { owner, ws } = await team();
	const r = await call(owner.token, 'POST', '/workspaces/roles', { name: 'GUEST' }, ws);
	assert.equal(r.status, 201, JSON.stringify(r));
	const p = await join(owner, ws, r.result['role'].id as string);
	assert.equal((await mine(p, ws))['permissions']['jobs'].read, false);
	assert.equal(await jobs(p, ws, 'GET'), 403);
});

// ── custom roles: stored grants ──────────────────────────────────────────────

test('a custom role grants what it stores, and removing the grant takes it away', { skip }, async () => {
	const { owner, ws } = await team();
	const dispatcher = await role(owner, ws, 'Dispatcher', [{ permissionKey: 'jobs', canCreate: true }]);
	const p = await join(owner, ws, dispatcher);
	assert.equal((await mine(p, ws))['permissions']['jobs'].create, true);
	assert.equal(await jobs(p, ws, 'POST'), 200);

	const cleared = await call(owner.token, 'POST', `/workspaces/roles/${dispatcher}/permissions`, { permissions: [] }, ws);
	assert.equal(cleared.status, 200);
	assert.equal((await mine(p, ws))['permissions']['jobs'].create, false);
	assert.equal(await jobs(p, ws, 'POST'), 403);
});

test('two roles give the union of their rights', { skip }, async () => {
	const { owner, ws } = await team();
	const reader = await role(owner, ws, 'Reader', [{ permissionKey: 'reports', canRead: true }]);
	const writer = await role(owner, ws, 'Writer', [{ permissionKey: 'jobs', canCreate: true }]);
	const p = await join(owner, ws, reader);
	assert.equal((await call(owner.token, 'POST', `/workspaces/members/${p.id}/roles`, { roleId: writer }, ws)).status, 200);
	const me = (await mine(p, ws))['permissions'];
	assert.equal(me['reports'].read, true);
	assert.equal(me['jobs'].create, true);
	assert.equal(me['jobs'].read, false);
});

test('a role can only grant what the catalog has', { skip }, async () => {
	const { owner, ws } = await team();
	const r = await call(owner.token, 'POST', '/workspaces/roles', { name: `Odd ${n}` }, ws);
	const id = r.result['role'].id as string;
	const unknown = await call(owner.token, 'POST', `/workspaces/roles/${id}/permissions`, { permissions: [{ permissionKey: 'forms', canRead: true }] }, ws);
	assert.equal(unknown.status, 422);
	assert.equal(unknown.reason, 'UNKNOWN_PERMISSION');
	const unsupported = await call(owner.token, 'POST', `/workspaces/roles/${id}/permissions`, { permissions: [{ permissionKey: 'reports', canDelete: true }] }, ws);
	assert.equal(unsupported.status, 422);
	assert.equal(unsupported.reason, 'UNSUPPORTED_OPERATION');
});

// ── deleting a role ──────────────────────────────────────────────────────────

test('deleting a role keeps its sole holders on the team (default role) and says how many held it', { skip }, async () => {
	const { owner, ws } = await team();
	const temp = await role(owner, ws, 'Temp', [{ permissionKey: 'jobs', canCreate: true }]);
	const keep = await role(owner, ws, 'Keep', [{ permissionKey: 'reports', canRead: true }]);
	const only = await join(owner, ws, temp);
	const both = await join(owner, ws, keep);
	assert.equal((await call(owner.token, 'POST', `/workspaces/members/${both.id}/roles`, { roleId: temp }, ws)).status, 200);

	const del = await call(owner.token, 'DELETE', `/workspaces/roles/${temp}`, undefined, ws);
	assert.equal(del.status, 200, JSON.stringify(del));
	assert.deepEqual(del.result, { membersAffected: 2, movedToDefaultRole: 1 });

	const list = (await call(owner.token, 'GET', '/workspaces/members', undefined, ws)).result['members'] as Array<Record<string, any>>;
	const roleNames = (id: string) => list.find((m) => m['userId'] === id)?.['roles'].map((r: { name: string }) => r.name);
	assert.deepEqual(roleNames(only.id), ['GUEST'], 'still a member, on the default role');
	const kept = roleNames(both.id) as string[];
	assert.equal(kept.length, 1, JSON.stringify(kept));
	assert.match(kept[0]!, /^Keep /, 'keeps their other role, nothing added');
	assert.equal(await jobs(only, ws, 'POST'), 403, 'the deleted role\'s rights are gone');
	const [left] = await store.query<{ c: string }>('SELECT COUNT(*) AS c FROM fonderie_role_permissions WHERE role_id = $1', [temp]);
	assert.equal(left!.c, '0', 'its grants are gone');
	assert.equal((await call(owner.token, 'DELETE', `/workspaces/roles/${temp}`, undefined, ws)).status, 404);
});
