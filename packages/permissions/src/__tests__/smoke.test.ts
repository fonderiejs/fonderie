import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import { PermissionsEngine, PermissionDeniedError } from '../engine';
import type { IMembership } from '../types';

// ── In-memory stub store ─────────────────────────────────────────

type StubOpts = {
	membership?: IMembership | null;
	superRoleExists?: boolean;
	hasPermission?: boolean;
};

function makeStore(opts: StubOpts): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			// membership existence check (fonderie_role_user_workspaces LIMIT 1)
			if (sql.includes('fonderie_role_user_workspaces') && sql.includes('LIMIT 1')) {
				if (!opts.membership) return [] as T[];
				return [
					{
						user_id: opts.membership.userId,
						workspace_id: opts.membership.workspaceId,
						role_id: opts.membership.roleId,
						role_name: opts.membership.roleName,
					},
				] as T[];
			}

			// super-role check (EXISTS query)
			if (sql.includes('EXISTS') && sql.includes('fonderie_role_user_workspaces')) {
				return [{ exists: opts.superRoleExists ?? false }] as T[];
			}

			// BOOL_OR permission check
			if (sql.includes('BOOL_OR') && sql.includes('fonderie_role_permissions')) {
				return [{ has_permission: opts.hasPermission ?? false }] as T[];
			}

			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};

	return stub;
}

const WORKSPACE = 'ws-1';
const USER = 'user-1';
const MEM: IMembership = {
	userId: USER,
	workspaceId: WORKSPACE,
	roleId: 'r1',
	roleName: 'member',
};

// ── can() ────────────────────────────────────────────────────────

test('can: returns false when user has no membership', async () => {
	const engine = new PermissionsEngine(makeStore({ membership: null }));
	assert.equal(await engine.can(USER, 'read', 'JOBS', WORKSPACE), false);
});

test('can: returns true when BOOL_OR check returns true', async () => {
	const engine = new PermissionsEngine(makeStore({ membership: MEM, hasPermission: true }));
	assert.equal(await engine.can(USER, 'read', 'JOBS', WORKSPACE), true);
});

test('can: returns false when BOOL_OR check returns false', async () => {
	const engine = new PermissionsEngine(makeStore({ membership: MEM, hasPermission: false }));
	assert.equal(await engine.can(USER, 'delete', 'JOBS', WORKSPACE), false);
});

test('can: super-role bypasses permission check', async () => {
	const engine = new PermissionsEngine(
		makeStore({
			membership: MEM,
			superRoleExists: true,
			hasPermission: false, // would fail without bypass
		}),
	);
	assert.equal(await engine.can(USER, 'delete', 'ANYTHING', WORKSPACE), true);
});

test('can: custom superRole name respected', async () => {
	const engine = new PermissionsEngine(
		makeStore({ membership: MEM, superRoleExists: true, hasPermission: false }),
		{ superRole: 'admin' },
	);
	assert.equal(await engine.can(USER, 'delete', 'ANYTHING', WORKSPACE), true);
});

// ── assert() ─────────────────────────────────────────────────────

test('assert: throws PermissionDeniedError when denied', async () => {
	const engine = new PermissionsEngine(makeStore({ membership: null }));
	await assert.rejects(
		() => engine.assert(USER, 'read', 'JOBS', WORKSPACE),
		(err: unknown) => {
			assert.ok(err instanceof PermissionDeniedError);
			assert.equal((err as PermissionDeniedError).status, 403);
			return true;
		},
	);
});

test('assert: resolves when allowed', async () => {
	const engine = new PermissionsEngine(makeStore({ membership: MEM, hasPermission: true }));
	await assert.doesNotReject(() => engine.assert(USER, 'read', 'JOBS', WORKSPACE));
});

// ── canAll() ─────────────────────────────────────────────────────

test('canAll: true only when all checks pass', async () => {
	const passing = makeStore({ membership: MEM, hasPermission: true });
	const failing = makeStore({ membership: MEM, hasPermission: false });

	assert.equal(
		await new PermissionsEngine(passing).canAll(
			USER,
			[
				{ operation: 'read', permissionKey: 'JOBS' },
				{ operation: 'create', permissionKey: 'JOBS' },
			],
			WORKSPACE,
		),
		true,
	);

	assert.equal(
		await new PermissionsEngine(failing).canAll(
			USER,
			[
				{ operation: 'read', permissionKey: 'JOBS' },
				{ operation: 'delete', permissionKey: 'JOBS' },
			],
			WORKSPACE,
		),
		false,
	);
});

// ── canAny() ─────────────────────────────────────────────────────

test('canAny: true when at least one check passes', async () => {
	// Store always returns same result for all checks — model a partial pass
	// by having different stores for each sub-check is not possible with this stub,
	// so we verify the all-pass and all-fail cases.
	const passing = makeStore({ membership: MEM, hasPermission: true });
	const failing = makeStore({ membership: MEM, hasPermission: false });

	assert.equal(
		await new PermissionsEngine(passing).canAny(
			USER,
			[
				{ operation: 'read', permissionKey: 'JOBS' },
				{ operation: 'delete', permissionKey: 'JOBS' },
			],
			WORKSPACE,
		),
		true,
	);

	assert.equal(
		await new PermissionsEngine(failing).canAny(
			USER,
			[
				{ operation: 'delete', permissionKey: 'JOBS' },
				{ operation: 'create', permissionKey: 'JOBS' },
			],
			WORKSPACE,
		),
		false,
	);
});

// ── PermissionsModule shape ──────────────────────────────────────

test('PermissionsModule: satisfies IFonderieModule interface', async () => {
	const { PermissionsModule } = await import('../module');
	const mod = new PermissionsModule(makeStore({}));

	assert.equal(mod.name, '@fonderie/permissions');
	assert.ok(typeof mod.install === 'function');
	assert.ok(mod.engine instanceof PermissionsEngine);
});

// ── requirePermission middleware ──────────────────────────────────

test('requirePermission: 401 when no user on ctx', async () => {
	const { requirePermission } = await import('../middlewares/require-permission');
	const middleware = requirePermission('read', 'JOBS');
	const ctx = {
		user: null,
		workspace: null,
		tenant: null,
		meta: {},
		request: new Request('http://localhost/'),
	};
	const response = await middleware(ctx as any, async () => Response.json({}));
	assert.equal(response.status, 401);
});

test('requirePermission: 500 when permissions engine not installed', async () => {
	const { requirePermission } = await import('../middlewares/require-permission');
	const middleware = requirePermission('read', 'JOBS');
	const ctx = {
		user: { id: USER, email: 'a@b.com' },
		workspace: { id: WORKSPACE },
		tenant: null,
		meta: {}, // no engine in meta
		request: new Request('http://localhost/'),
	};
	const response = await middleware(ctx as any, async () => Response.json({}));
	assert.equal(response.status, 500);
});

test('requirePermission: 403 when permission denied', async () => {
	const { requirePermission } = await import('../middlewares/require-permission');
	const { PERMISSIONS_ENGINE_KEY } = await import('../module');
	const engine = new PermissionsEngine(makeStore({ membership: MEM, hasPermission: false }));
	const middleware = requirePermission('delete', 'JOBS');
	const ctx = {
		user: { id: USER, email: 'a@b.com' },
		workspace: { id: WORKSPACE },
		tenant: null,
		meta: { [PERMISSIONS_ENGINE_KEY]: engine },
		request: new Request('http://localhost/'),
	};
	const response = await middleware(ctx as any, async () => Response.json({}));
	assert.equal(response.status, 403);
});

test('requirePermission: calls next when permission granted', async () => {
	const { requirePermission } = await import('../middlewares/require-permission');
	const { PERMISSIONS_ENGINE_KEY } = await import('../module');
	const engine = new PermissionsEngine(makeStore({ membership: MEM, hasPermission: true }));
	const middleware = requirePermission('read', 'JOBS');
	const ctx = {
		user: { id: USER, email: 'a@b.com' },
		workspace: { id: WORKSPACE },
		tenant: null,
		meta: { [PERMISSIONS_ENGINE_KEY]: engine },
		request: new Request('http://localhost/'),
	};
	let called = false;
	await middleware(ctx as any, async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

// ── D2: access-grant export ─────────────────────────────────────────────
import { listGrants } from '../services/grants';
test('D2 listGrants: returns active user→workspace→role grants', async () => {
	const store: IStoreAdapter = {
		query: async <T = unknown>() => ([
			{ user_id: 'u1', workspace_id: 'w1', role_id: 'r1', role_name: 'owner', suspended: false },
		] as unknown as T[]),
		transaction: async (fn) => fn(store),
	};
	const grants = await listGrants(store);
	assert.equal(grants.length, 1);
	assert.equal(grants[0]?.roleName, 'owner');
	assert.equal(grants[0]?.userId, 'u1');
});

// ── F2: tenant-isolation sweep ──────────────────────────────────────────
// A store where USER is a member WITH permission AND super-role, but ONLY in
// `memberWs`. workspace_id is $2 (params[1]) in every access query, so any
// query for a different workspace returns "no membership / no permission".
function isolatedStore(memberWs: string): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			const inWs = (params?.[1] ?? '') === memberWs;
			if (sql.includes('fonderie_role_user_workspaces') && sql.includes('LIMIT 1')) {
				return (inWs ? [{ user_id: USER, workspace_id: memberWs, role_id: 'r1', role_name: 'owner' }] : []) as T[];
			}
			if (sql.includes('EXISTS')) return [{ exists: inWs }] as T[];
			if (sql.includes('BOOL_OR')) return (inWs ? [{ has_permission: true }] : []) as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	return stub;
}

test('F2: member of ws-A is allowed in ws-A but DENIED in ws-B', async () => {
	const engine = new PermissionsEngine(isolatedStore('ws-A'));
	assert.equal(await engine.can(USER, 'read', 'JOBS', 'ws-A'), true, 'allowed in own workspace');
	assert.equal(await engine.can(USER, 'read', 'JOBS', 'ws-B'), false, 'denied in other workspace');
});

test('F2: super-role does not cross workspaces', async () => {
	const engine = new PermissionsEngine(isolatedStore('ws-A'));
	assert.equal(await engine.can(USER, 'delete', 'ANYTHING', 'ws-A'), true);
	assert.equal(await engine.can(USER, 'delete', 'ANYTHING', 'ws-B'), false);
});

test('F2: canAll / canAny / assert all respect isolation', async () => {
	const engine = new PermissionsEngine(isolatedStore('ws-A'));
	const checks = [{ operation: 'read' as const, permissionKey: 'JOBS' }];
	assert.equal(await engine.canAll(USER, checks, 'ws-B'), false);
	assert.equal(await engine.canAny(USER, checks, 'ws-B'), false);
	await assert.rejects(() => engine.assert(USER, 'read', 'JOBS', 'ws-B'), PermissionDeniedError);
});

test('F2: requirePermission middleware returns 403 across workspaces', async () => {
	const { requirePermission } = await import('../middlewares/require-permission');
	const { PERMISSIONS_ENGINE_KEY } = await import('../module');
	const engine = new PermissionsEngine(isolatedStore('ws-A'));
	const ctx: any = {
		user: { id: USER },
		workspace: { id: 'ws-B' },
		meta: { [PERMISSIONS_ENGINE_KEY]: engine },
		request: new Request('http://localhost/x'),
	};
	const res = await requirePermission('read', 'JOBS', ctx, async () => new Response('ok', { status: 200 }));
	assert.equal(res.status, 403);
});
