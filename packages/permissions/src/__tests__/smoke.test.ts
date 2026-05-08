import { test } from 'node:test'
import assert   from 'node:assert/strict'

import type { IStoreAdapter }                        from '@fonderie-js/store';

import { PermissionsEngine, PermissionDeniedError } from '../engine';
import type { IPermission, IMembership }               from '../types';

// ── In-memory stub store ─────────────────────────────────────────

function makeStore(opts: {
	membership?: IMembership | null
	permissions?: IPermission[]
}): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async (sql: string) => {
			// membership query
			if (sql.includes('fonderie_workspace_members') && sql.includes('role_name')) {
				if (!opts.membership) {
					return [];
				}
				
				return [{
					user_id:      opts.membership.userId,
					workspace_id: opts.membership.workspaceId,
					role_id:      opts.membership.roleId,
					role_name:    opts.membership.roleName,
				}];
			}

			// permissions query
			if (sql.includes('fonderie_role_permissions')) {
				return opts.permissions ?? [];
			}

			return [];
		},
		transaction: async (fn) => fn(stub),
	}

	return stub;
}

const WORKSPACE = 'ws-1';
const USER      = 'user-1';

// ── can() ────────────────────────────────────────────────────────

test('can: returns false when user has no membership', async () => {
	const engine = new PermissionsEngine(makeStore({ membership: null }));
	const result = await engine.can(USER, 'read', 'projects', WORKSPACE);
	assert.equal(result, false);
});

test('can: returns true when permission matches exactly', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
		permissions: [{ action: 'read', resource: 'projects' }],
	}));
	assert.equal(await engine.can(USER, 'read', 'projects', WORKSPACE), true);
});

test('can: returns false when permission does not match', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
		permissions: [{ action: 'read', resource: 'projects' }],
	}));
	assert.equal(await engine.can(USER, 'delete', 'projects', WORKSPACE), false);
});

test('can: wildcard action matches any action', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
		permissions: [{ action: '*', resource: 'projects' }],
	}));
	assert.equal(await engine.can(USER, 'delete', 'projects', WORKSPACE), true);
});

test('can: wildcard resource matches any resource', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
		permissions: [{ action: 'read', resource: '*' }],
	}));
	assert.equal(await engine.can(USER, 'read', 'invoices', WORKSPACE), true);
});

test('can: super-role bypasses all permission checks', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'owner' },
		permissions: [],   // no permissions — owner bypasses
	}));
	assert.equal(await engine.can(USER, 'delete', 'anything', WORKSPACE), true);
});

test('can: wildcards disabled — wildcard permission does not match', async () => {
	const engine = new PermissionsEngine(
		makeStore({
			membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
			permissions: [{ action: '*', resource: 'projects' }],
		}),
		{ wildcards: false },
	);
	assert.equal(await engine.can(USER, 'read', 'projects', WORKSPACE), false);
});

// ── assert() ─────────────────────────────────────────────────────

test('assert: throws PermissionDeniedError when denied', async () => {
	const engine = new PermissionsEngine(makeStore({ membership: null }));
	await assert.rejects(
		() => engine.assert(USER, 'read', 'projects', WORKSPACE),
			(err: unknown) => {
			assert.ok(err instanceof PermissionDeniedError)
			assert.equal((err as PermissionDeniedError).status, 403)
			return true
		},
	);
});

test('assert: resolves when allowed', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
		permissions: [{ action: 'read', resource: 'projects' }],
	}));
	await assert.doesNotReject(() => engine.assert(USER, 'read', 'projects', WORKSPACE));
});

// ── canAll() ─────────────────────────────────────────────────────

test('canAll: true only when all checks pass', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
		permissions: [
			{ action: 'read',   resource: 'projects' },
			{ action: 'create', resource: 'projects' },
		],
	}));
	assert.equal(
		await engine.canAll(USER, [
			{ action: 'read',   resource: 'projects' },
			{ action: 'create', resource: 'projects' },
		], WORKSPACE),
		true,
	);
	assert.equal(
		await engine.canAll(USER, [
			{ action: 'read',   resource: 'projects' },
			{ action: 'delete', resource: 'projects' },
		], WORKSPACE),
		false,
	);
});

// ── canAny() ─────────────────────────────────────────────────────

test('canAny: true when at least one check passes', async () => {
	const engine = new PermissionsEngine(makeStore({
		membership:  { userId: USER, workspaceId: WORKSPACE, roleId: 'r1', roleName: 'member' },
		permissions: [{ action: 'read', resource: 'projects' }],
	}));
	assert.equal(
		await engine.canAny(USER, [
			{ action: 'delete', resource: 'projects' },
			{ action: 'read',   resource: 'projects' },
		], WORKSPACE),
		true,
	);
	assert.equal(
		await engine.canAny(USER, [
			{ action: 'delete', resource: 'projects' },
			{ action: 'create', resource: 'projects' },
		], WORKSPACE),
		false,
	);
});

// ── PermissionsModule shape ──────────────────────────────────────

test('PermissionsModule: satisfies IFonderieModule interface', async () => {
	const { PermissionsModule } = await import('../module');
	const stub = makeStore({});
	const mod  = new PermissionsModule(stub);

	assert.equal(mod.name, '@fonderie-js/permissions');
	assert.ok(typeof mod.install  === 'function');
	assert.ok(mod.engine instanceof PermissionsEngine);
});
