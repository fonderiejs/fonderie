import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IFonderieApp, IFonderieModule } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { describeAuthAdminRoutes, toAdminUserDTO } from '../admin';
import type { IUser } from '../types';

// The routes exist only through composition; here a minimal stand-in for
// @fonderie/admin mounts them, unguarded, so the handlers are what's tested.

const USER: IUser = {
	id: 'u1',
	email: 'ada@example.com',
	emailDigest: 'd',
	passwordHash: 'sha256$secret-hash',
	firstName: 'Ada',
	lastName: 'L',
	phone: null,
	profileImageUrl: null,
	locale: 'en-US',
	timezone: 'UTC',
	isActive: true,
	lastLogin: null,
	preferences: {} as IUser['preferences'],
	suspended: false,
	whitelist: false,
	ipWhitelist: [],
	deletedAt: null,
	createdAt: new Date('2024-01-01T00:00:00Z'),
	updatedAt: new Date('2024-01-01T00:00:00Z'),
	emailVerifiedAt: null,
	mfaEnabled: false,
	mfaSecret: 'TOTP-SECRET',
	provider: null,
	providerId: null,
} as unknown as IUser;

function makeStore() {
	const state = { user: { ...USER }, sessionsDeleted: 0 };
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			if (sql.includes('fonderie_users') && sql.includes('WHERE email = $1'))
				return (params[0] === state.user.email ? [state.user] : []) as unknown as T[];
			if (
				sql.includes('fonderie_users') &&
				sql.includes('WHERE id = $1') &&
				sql.startsWith('SELECT')
			)
				return (params[0] === 'u1' ? [state.user] : []) as unknown as T[];
			if (sql.includes('UPDATE fonderie_users SET suspended')) {
				if (params[0] !== 'u1') return [];
				state.user = { ...state.user, suspended: params[1] as boolean };
				return [{ id: 'u1' }] as unknown as T[];
			}
			if (sql.includes('fonderie_sessions') && sql.startsWith('SELECT'))
				return [
					{
						id: 's1',
						sid: 'sid1',
						userAgent: 'ua',
						ipAddress: '1.2.3.4',
						createdAt: new Date(),
						expiresAt: new Date(Date.now() + 1000),
					},
				] as unknown as T[];
			if (sql.includes('DELETE FROM fonderie_sessions')) {
				state.sessionsDeleted += 1;
				return [];
			}
			if (sql.includes('fonderie_login_events')) return [] as unknown as T[];
			return [];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, state };
}

function mounter(store: IStoreAdapter): IFonderieModule {
	return {
		name: 'test-admin',
		install(app: IFonderieApp) {
			for (const r of describeAuthAdminRoutes(store))
				app.addRoute(r.method, `/_admin${r.path}`, ...r.handlers);
		},
	};
}

const config = defineConfig({ db: { url: 'postgres://localhost/test' } });
const req = (method: string, path: string) => new Request(`http://localhost${path}`, { method });

test('describeAuthAdminRoutes: the seven routes, prefix-relative', () => {
	const { store } = makeStore();
	assert.deepEqual(
		describeAuthAdminRoutes(store).map((r) => `${r.method} ${r.path}`),
		[
			'GET /users',
			'GET /users/:id',
			'GET /users/:id/sessions',
			'DELETE /users/:id/sessions',
			'GET /users/:id/login-history',
			'POST /users/:id/suspend',
			'POST /users/:id/unsuspend',
		],
	);
});

test('lookup by email and by id; secrets never leave; unknown is 404; missing email is 422', async () => {
	const { store } = makeStore();
	const app = await new FonderieApp(config).register(mounter(store)).boot();

	const byEmail = await app.handle(req('GET', '/_admin/users?email=ADA@example.com'));
	assert.equal(byEmail.status, 200);
	const body = (await byEmail.json()) as { result: Record<string, unknown> };
	assert.equal(body.result['id'], 'u1');
	assert.equal(body.result['suspended'], false);
	assert.equal(body.result['createdAt'], '2024-01-01T00:00:00.000Z');
	const text = JSON.stringify(body);
	assert.equal(text.includes('secret-hash'), false);
	assert.equal(text.includes('TOTP-SECRET'), false);

	assert.equal((await app.handle(req('GET', '/_admin/users/u1'))).status, 200);
	assert.equal((await app.handle(req('GET', '/_admin/users/nope'))).status, 404);
	assert.equal(
		(await app.handle(req('GET', '/_admin/users?email=nobody@example.com'))).status,
		404,
	);
	assert.equal((await app.handle(req('GET', '/_admin/users'))).status, 422);
});

test('sessions: listed, then revoked everywhere', async () => {
	const { store, state } = makeStore();
	const app = await new FonderieApp(config).register(mounter(store)).boot();
	const list = (await (await app.handle(req('GET', '/_admin/users/u1/sessions'))).json()) as {
		result: Array<{ id: string; current: boolean }>;
	};
	assert.deepEqual(
		list.result.map((s) => [s.id, s.current]),
		[['s1', false]],
	);
	assert.equal((await app.handle(req('DELETE', '/_admin/users/u1/sessions'))).status, 200);
	assert.equal(state.sessionsDeleted, 1);
	assert.equal((await app.handle(req('DELETE', '/_admin/users/nope/sessions'))).status, 404);
});

test('login history: paged shape; a bad cursor is 422', async () => {
	const { store } = makeStore();
	const app = await new FonderieApp(config).register(mounter(store)).boot();
	const res = await app.handle(req('GET', '/_admin/users/u1/login-history?limit=5'));
	assert.equal(res.status, 200);
	const page = (await res.json()) as { result: { events: unknown[]; nextCursor: string | null } };
	assert.deepEqual([page.result.events, page.result.nextCursor], [[], null]);
	assert.equal(
		(await app.handle(req('GET', '/_admin/users/u1/login-history?cursor=%%%'))).status,
		422,
	);
});

test('suspend / unsuspend flip the lock and return the user; unknown is 404', async () => {
	const { store, state } = makeStore();
	const app = await new FonderieApp(config).register(mounter(store)).boot();
	const s = await app.handle(req('POST', '/_admin/users/u1/suspend'));
	assert.equal(s.status, 200);
	assert.equal(((await s.json()) as { result: { suspended: boolean } }).result.suspended, true);
	assert.equal(state.user.suspended, true);
	const u = await app.handle(req('POST', '/_admin/users/u1/unsuspend'));
	assert.equal(((await u.json()) as { result: { suspended: boolean } }).result.suspended, false);
	assert.equal((await app.handle(req('POST', '/_admin/users/nope/suspend'))).status, 404);
});

test('toAdminUserDTO: app DTO plus the support fields', () => {
	const dto = toAdminUserDTO({
		...USER,
		suspended: true,
		deletedAt: new Date('2025-01-01T00:00:00Z'),
	});
	assert.equal(dto.suspended, true);
	assert.equal(dto.deletedAt, '2025-01-01T00:00:00.000Z');
	assert.equal(dto.email, 'ada@example.com');
});
