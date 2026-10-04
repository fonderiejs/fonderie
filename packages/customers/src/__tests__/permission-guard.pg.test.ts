import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule, MESSAGE_KEYS } from '@fonderie/workspaces';
import { getMigrationsPath as workspacesMigrations } from '@fonderie/workspaces/migrations';

import { CustomersModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { operationFor } from '../routes';

// Customer routes guarded by a permission (config.permission), on a REAL
// Postgres over HTTP: with the grant a member succeeds, without it 403, the
// default role gets exactly what config says, and removing a grant flips it.
//
//   CUSTOMERS_PG_URL=postgres://... npm test -w @fonderie/customers

const PG_URL = process.env['CUSTOMERS_PG_URL'];
const skip = PG_URL ? false : 'set CUSTOMERS_PG_URL to run';
const DOMAIN = 'customers.acme.example';

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
	await new InternalMigrationRunner(store, workspacesMigrations()).run();
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	const { PermissionsModule } = await import('@fonderie/permissions');
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
			catalog: [{ key: 'customers' }],
			systemGrants: { GUEST: { customers: ['read'] } },
		}))
		.register(new WorkspacesModule(store, { personalWorkspace: false }, bus as never))
		.register(new CustomersModule(store, { permission: 'customers' }, bus as never));
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
	const r = await call(owner.token, 'POST', '/workspaces', { name: `Cust ${n}-${Date.now()}` });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { owner, ws: r.result['workspace'].id as string };
}

async function join(owner: Person, ws: string, roleId?: string): Promise<Person> {
	const p = await person('Marco');
	const inv = await call(owner.token, 'POST', '/workspaces/invitations', { email: p.email, ...(roleId ? { roleId } : {}) }, ws);
	assert.equal(inv.status, 201, JSON.stringify(inv));
	const m = [...emitted].reverse().find((e) => e.payload['type'] === MESSAGE_KEYS.workspaceInvitation);
	const token = (m!.payload['data'] as Record<string, string>)['token'];
	assert.equal((await call(p.token, 'POST', '/workspaces/invitations/accept', { token })).status, 200);
	return p;
}

async function customer(owner: Person, ws: string): Promise<string> {
	const r = await call(owner.token, 'POST', '/customers', { firstName: 'Ada', lastName: 'Client' }, ws);
	assert.equal(r.status, 201, JSON.stringify(r));
	return r.result['customer'].id as string;
}

test('every customer route needs the operation its verb implies', () => {
	assert.equal(operationFor('GET', '/customers/:customerId/notes'), 'read');
	assert.equal(operationFor('POST', '/customers'), 'create');
	assert.equal(operationFor('DELETE', '/customers/:customerId'), 'delete');
	// Changing what is attached to a customer changes the customer.
	assert.equal(operationFor('POST', '/customers/:customerId/emails'), 'update');
	assert.equal(operationFor('DELETE', '/customers/:customerId/notes/:noteId'), 'update');
	assert.equal(operationFor('POST', '/customers/:customerId/blacklist'), 'update');
});

test('the owner (super role) may do everything with customers', { skip }, async () => {
	const { owner, ws } = await team();
	const id = await customer(owner, ws);
	assert.equal((await call(owner.token, 'POST', `/customers/${id}/notes`, { body: 'Prefers mornings' }, ws)).status, 201);
	assert.equal((await call(owner.token, 'DELETE', `/customers/${id}`, undefined, ws)).status, 200);
});

test('the default role reads customers and nothing more', { skip }, async () => {
	const { owner, ws } = await team();
	const id = await customer(owner, ws);
	const guest = await join(owner, ws);
	assert.equal((await call(guest.token, 'GET', '/customers', undefined, ws)).status, 200);
	assert.equal((await call(guest.token, 'GET', `/customers/${id}`, undefined, ws)).status, 200);
	assert.equal((await call(guest.token, 'POST', '/customers', { firstName: 'X' }, ws)).status, 403);
	assert.equal((await call(guest.token, 'POST', `/customers/${id}/notes`, { body: 'hi' }, ws)).status, 403);
	assert.equal((await call(guest.token, 'POST', `/customers/${id}/blacklist`, {}, ws)).status, 403);
	assert.equal((await call(guest.token, 'DELETE', `/customers/${id}`, undefined, ws)).status, 403);
});

test('a role with update may change a customer but not delete one; removing the grant takes it away', { skip }, async () => {
	const { owner, ws } = await team();
	const id = await customer(owner, ws);
	const r = await call(owner.token, 'POST', '/workspaces/roles', { name: `Office ${n}` }, ws);
	const roleId = r.result['role'].id as string;
	const grant = (canUpdate: boolean) =>
		call(owner.token, 'POST', `/workspaces/roles/${roleId}/permissions`, { permissions: [{ permissionKey: 'customers', canRead: true, canUpdate }] }, ws);
	assert.equal((await grant(true)).status, 200);
	const office = await join(owner, ws, roleId);

	assert.equal((await call(office.token, 'POST', `/customers/${id}/notes`, { body: 'Gate code 1234' }, ws)).status, 201);
	assert.equal((await call(office.token, 'PUT', `/customers/${id}`, { lastName: 'Renamed' }, ws)).status, 200);
	assert.equal((await call(office.token, 'DELETE', `/customers/${id}`, undefined, ws)).status, 403);

	assert.equal((await grant(false)).status, 200);
	assert.equal((await call(office.token, 'POST', `/customers/${id}/notes`, { body: 'again' }, ws)).status, 403);
	assert.equal((await call(office.token, 'GET', `/customers/${id}`, undefined, ws)).status, 200, 'read stays');
});
