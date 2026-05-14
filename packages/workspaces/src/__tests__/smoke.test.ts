import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie-js/store';
import type { IWorkspace, IMember, IRole } from '../types';
import { NOTIFICATION_EVENT } from '@fonderie-js/events';
import { MESSAGE_KEYS } from '../config';

function makeStore(
	opts: {
		workspace?: IWorkspace | null;
		member?: IMember | null;
		workspaces?: IWorkspace[];
		roles?: IRole[];
		personalWorkspace?: IWorkspace | null;
	} = {},
): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_workspaces') && sql.includes('GROUP BY w.id')) {
				return (opts.workspaces ?? []) as T[];
			}

			if (sql.includes('fonderie_workspaces') && sql.includes('WHERE id = $1')) {
				if (!opts.workspace) return [] as T[];
				return [opts.workspace] as T[];
			}

			if (sql.includes('fonderie_role_user_workspaces') && sql.includes('LIMIT 1')) {
				if (!opts.member) return [] as T[];
				return [opts.member] as T[];
			}

			if (sql.includes('fonderie_roles') && sql.includes('ORDER BY')) {
				return (opts.roles ?? []) as T[];
			}

			// findPersonalWorkspace: SELECT ... WHERE owner_id = $1 AND is_personal = true
			if (sql.includes('fonderie_workspaces') && sql.includes('is_personal = true')) {
				if (!opts.personalWorkspace) return [] as T[];
				return [opts.personalWorkspace] as T[];
			}

			// createPersonalWorkspace: INSERT ... ON CONFLICT (owner_id) WHERE is_personal = true
			if (sql.includes('INSERT INTO fonderie_workspaces') && sql.includes('ON CONFLICT')) {
				if (!opts.personalWorkspace) return [] as T[];
				return [opts.personalWorkspace] as T[];
			}

			// INSERT INTO fonderie_workspaces → createWorkspace
			if (sql.includes('INSERT INTO fonderie_workspaces')) {
				if (!opts.workspace) return [] as T[];
				return [opts.workspace] as T[];
			}

			// INSERT INTO fonderie_roles → createRole
			if (sql.includes('INSERT INTO fonderie_roles')) {
				const wsId = opts.personalWorkspace?.id ?? opts.workspace?.id ?? 'ws-1';
				return [
					{
						id: 'role-1',
						name: 'ADMIN',
						isSystem: false,
						active: true,
						description: null,
						workspaceId: wsId,
					},
				] as unknown as T[];
			}

			// INSERT INTO fonderie_role_user_workspaces → addMember (void)
			if (sql.includes('INSERT INTO fonderie_role_user_workspaces')) {
				return [] as T[];
			}

			// UPDATE fonderie_workspaces → updateWorkspace
			if (sql.includes('UPDATE fonderie_workspaces') && sql.includes('RETURNING')) {
				if (!opts.workspace) return [] as T[];
				return [opts.workspace] as T[];
			}

			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	return stub;
}

const WS: IWorkspace = {
	id: 'ws-1',
	name: 'Acme',
	slug: 'acme',
	type: 'ORGANIZATION',
	description: null,
	plan: 'free',
	ownerId: 'user-1',
	isPersonal: false,
	archivedAt: null,
	archivedBy: null,
	createdAt: new Date().toISOString(),
	updatedAt: null,
};

const MEMBER: IMember = {
	userId: 'user-1',
	workspaceId: 'ws-1',
	roleId: 'r-1',
	roleName: 'ADMIN',
	confirmed: true,
	createdAt: new Date().toISOString(),
};

// ── findWorkspaceById ────────────────────────────────────────────

test('findWorkspaceById: returns workspace when found', async () => {
	const { findWorkspaceById } = await import('../services/workspaces');
	const result = await findWorkspaceById('ws-1', makeStore({ workspace: WS }));
	assert.equal(result?.id, 'ws-1');
	assert.equal(result?.name, 'Acme');
	assert.equal(result?.type, 'ORGANIZATION');
});

test('findWorkspaceById: returns null when not found', async () => {
	const { findWorkspaceById } = await import('../services/workspaces');
	const result = await findWorkspaceById('ws-missing', makeStore({ workspace: null }));
	assert.equal(result, null);
});

// ── getMember ────────────────────────────────────────────────────

test('getMember: returns member when found', async () => {
	const { getMember } = await import('../services/members');
	const result = await getMember('user-1', 'ws-1', makeStore({ member: MEMBER }));
	assert.equal(result?.roleName, 'ADMIN');
	assert.equal(result?.confirmed, true);
});

test('getMember: returns null when not a member', async () => {
	const { getMember } = await import('../services/members');
	const result = await getMember('user-2', 'ws-1', makeStore({ member: null }));
	assert.equal(result, null);
});

// ── listWorkspaceRoles ───────────────────────────────────────────

test('listWorkspaceRoles: returns roles for workspace', async () => {
	const { listWorkspaceRoles } = await import('../services/roles');
	const roles: IRole[] = [
		{
			id: 'r-1',
			name: 'ADMIN',
			isSystem: false,
			active: true,
			description: null,
			workspaceId: 'ws-1',
		},
		{
			id: 'r-2',
			name: 'GUEST',
			isSystem: true,
			active: true,
			description: null,
			workspaceId: null,
		},
	];
	const result = await listWorkspaceRoles('ws-1', makeStore({ roles }));
	assert.equal(result.length, 2);
});

// ── toWorkspaceDTO ───────────────────────────────────────────────

test('toWorkspaceDTO: maps all fields correctly', async () => {
	const { toWorkspaceDTO } = await import('../dtos/workspace');
	const dto = toWorkspaceDTO(WS);
	assert.equal(dto.id, 'ws-1');
	assert.equal(dto.type, 'ORGANIZATION');
	assert.equal(dto.isArchived, false);
	assert.equal(dto.archivedAt, '');
});

// ── WorkspacesModule shape ───────────────────────────────────────

test('WorkspacesModule: satisfies IFonderieModule interface', async () => {
	const { WorkspacesModule } = await import('../module');
	const mod = new WorkspacesModule(makeStore({}));
	assert.equal(mod.name, '@fonderie-js/workspaces');
	assert.ok(typeof mod.install === 'function');
});

// ── Ctx helper ───────────────────────────────────────────────────

function makeCtx(
	opts: {
		user?: { id: string; email: string } | null;
		workspace?: IWorkspace | null;
		params?: Record<string, string>;
		header?: Record<string, string>;
		body?: Record<string, unknown>;
	} = {},
): any {
	return {
		user: 'user' in opts ? opts.user : null,
		workspace: 'workspace' in opts ? opts.workspace : null,
		tenant: null,
		meta: {
			body: opts.body ?? {},
			params: opts.params ?? {},
		},
		request: new Request('http://localhost/', {
			headers: opts.header ?? {},
		}),
	};
}

// ── withWorkspace ────────────────────────────────────

test('workspaceContext: calls next when no workspace ID in request', async () => {
	const { withWorkspace } = await import('../middlewares/workspace-context');
	const middleware = withWorkspace(makeStore({ workspace: WS }));
	let called = false;
	await middleware(makeCtx({ user: { id: 'user-1', email: 'a@b.com' } }), async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

test('workspaceContext: 404 when workspace not found', async () => {
	const { withWorkspace } = await import('../middlewares/workspace-context');
	const middleware = withWorkspace(makeStore({ workspace: null }));
	const response = await middleware(
		makeCtx({
			header: { 'x-workspace-id': 'ws-missing' },
			user: { id: 'user-1', email: 'a@b.com' },
		}),
		async () => Response.json({}),
	);
	assert.equal(response?.status, 404);
});

test('workspaceContext: 403 when user is not a member', async () => {
	const { withWorkspace } = await import('../middlewares/workspace-context');
	const middleware = withWorkspace(makeStore({ workspace: WS, member: null }));
	const response = await middleware(
		makeCtx({ header: { 'x-workspace-id': 'ws-1' }, user: { id: 'stranger', email: 'x@b.com' } }),
		async () => Response.json({}),
	);
	assert.equal(response?.status, 403);
});

test('workspaceContext: resolves workspace and calls next when member found', async () => {
	const { withWorkspace } = await import('../middlewares/workspace-context');
	const middleware = withWorkspace(makeStore({ workspace: WS, member: MEMBER }));
	let called = false;
	await middleware(
		makeCtx({ header: { 'x-workspace-id': 'ws-1' }, user: { id: 'user-1', email: 'a@b.com' } }),
		async () => {
			called = true;
			return Response.json({});
		},
	);
	assert.ok(called);
});

// ── workspaceController ───────────────────────────────────────────

test('listWorkspaces: 401 when not authenticated', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore({ workspaces: [WS] }), {});
	const response = await ctrl.list(makeCtx({ user: null }));
	assert.equal(response.status, 401);
});

test('listWorkspaces: 200 with workspaces array', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore({ workspaces: [WS] }), {});
	const response = await ctrl.list(makeCtx({ user: { id: 'user-1', email: 'a@b.com' } }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'WORKSPACES_FETCHED');
	assert.ok(Array.isArray(body.result.workspaces));
	assert.equal(body.result.workspaces.length, 1);
	assert.equal(body.result.workspaces[0].id, 'ws-1');
});

test('createWorkspace: 422 when name is missing', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore({ workspace: WS }), {});
	const response = await ctrl.create(
		makeCtx({ user: { id: 'user-1', email: 'a@b.com' }, body: {} }),
	);
	assert.equal(response.status, 422);
});

test('createWorkspace: 201 with workspace DTO', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore({ workspace: WS }), {});
	const response = await ctrl.create(
		makeCtx({
			user: { id: 'user-1', email: 'a@b.com' },
			body: { name: 'Acme Corp' },
		}),
	);
	assert.equal(response.status, 201);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'WORKSPACE_CREATED');
	assert.ok(body.result.workspace);
	assert.equal(body.result.workspace.id, 'ws-1');
	assert.equal(body.result.workspace.name, 'Acme');
	assert.ok(typeof body.result.workspace.isArchived === 'boolean');
});

test('updateWorkspace: 200 with updated workspace DTO', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const updated = { ...WS, name: 'Acme Updated' };
	const ctrl = workspaceController(makeStore({ workspace: updated }), {});
	const response = await ctrl.update(
		makeCtx({
			workspace: WS,
			body: { name: 'Acme Updated' },
		}),
	);
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'WORKSPACE_UPDATED');
	assert.equal(body.result.workspace.name, 'Acme Updated');
	assert.ok(typeof body.result.workspace.isArchived === 'boolean');
});

test('getWorkspace: 404 when workspace not on ctx', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore(), {});
	const response = await ctrl.get(makeCtx({ workspace: null }));
	assert.equal(response.status, 404);
});

test('getWorkspace: 200 with workspace DTO', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore(), {});
	const response = await ctrl.get(makeCtx({ workspace: WS }));
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'WORKSPACE_FETCHED');
	assert.equal(body.result.workspace.id, 'ws-1');
	assert.equal(body.result.workspace.isArchived, false);
});

// ── Personal workspace guards ────────────────────────────────────

const PERSONAL_WS: IWorkspace = {
	...WS,
	id: 'ws-personal',
	slug: 'user-1-personal',
	type: 'PERSONAL',
	isPersonal: true,
};

test('archive: 403 FORBIDDEN on personal workspace', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore(), {});
	const response = await ctrl.archive(
		makeCtx({ workspace: PERSONAL_WS, user: { id: 'user-1', email: 'a@b.com' } }),
	);
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'FORBIDDEN');
});

test('create: 422 when type is PERSONAL', async () => {
	const { workspaceController } = await import('../controllers/workspace.controller');
	const ctrl = workspaceController(makeStore(), {});
	const response = await ctrl.create(
		makeCtx({
			user: { id: 'user-1', email: 'a@b.com' },
			body: { name: 'My WS', type: 'PERSONAL' },
		}),
	);
	assert.equal(response.status, 422);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'INVALID_PARAMETER');
});

test('invite: 403 FORBIDDEN on personal workspace', async () => {
	const { invitationController } = await import('../controllers/invitation.controller');
	const ctrl = invitationController(makeStore(), '7d');
	const response = await ctrl.invite(
		makeCtx({
			workspace: PERSONAL_WS,
			user: { id: 'user-1', email: 'a@b.com' },
			body: { email: 'guest@example.com' },
		}),
	);
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'FORBIDDEN');
});

test('member.remove: 403 FORBIDDEN on personal workspace', async () => {
	const { memberController } = await import('../controllers/member.controller');
	const ctrl = memberController(makeStore());
	const response = await ctrl.remove(
		makeCtx({
			workspace: PERSONAL_WS,
			user: { id: 'user-1', email: 'a@b.com' },
			params: { userId: 'user-2' },
		}),
	);
	assert.equal(response.status, 403);
	const body = (await response.json()) as any;
	assert.equal(body.reason, 'FORBIDDEN');
});

// ── DMZ fallback ─────────────────────────────────────────────────

test('workspaceContext DMZ: sets ctx.workspace to personal when no header and user has personal ws', async () => {
	const { withWorkspace } = await import('../middlewares/workspace-context');
	const middleware = withWorkspace(makeStore({ personalWorkspace: PERSONAL_WS }));
	const ctx = makeCtx({ user: { id: 'user-1', email: 'a@b.com' } });
	let wsAfter: IWorkspace | null = null;
	await middleware(ctx, async () => {
		wsAfter = ctx.workspace;
		return Response.json({});
	});
	assert.equal(wsAfter?.id, 'ws-personal');
});

test('workspaceContext DMZ: next is still called when no personal workspace found', async () => {
	const { withWorkspace } = await import('../middlewares/workspace-context');
	const middleware = withWorkspace(makeStore({ personalWorkspace: null }));
	let called = false;
	await middleware(makeCtx({ user: { id: 'user-1', email: 'a@b.com' } }), async () => {
		called = true;
		return Response.json({});
	});
	assert.ok(called);
});

// ── Personal workspace provisioning ──────────────────────────────

test('WorkspacesModule: provisions personal workspace on user.registered via bus', async () => {
	const { WorkspacesModule } = await import('../module');

	let registeredHandler: ((payload: any) => Promise<void>) | undefined;
	const fakeBus = {
		on: (_type: string, handler: any) => {
			registeredHandler = handler;
		},
		emit: async () => {},
	} as any;

	const queriedSql: string[] = [];
	const innerStore = makeStore({ personalWorkspace: PERSONAL_WS });
	const makeTracking = (): IStoreAdapter => ({
		query: async <T = unknown>(sql: string, params?: unknown[]) => {
			queriedSql.push(sql);
			return innerStore.query<T>(sql, params);
		},
		transaction: async (fn) => fn(makeTracking()),
	});
	const trackedStore = makeTracking();

	const fakeApp = { use: () => {}, addRoute: () => {} } as any;
	const mod = new WorkspacesModule(trackedStore, {}, fakeBus);
	mod.install(fakeApp);

	assert.ok(
		typeof registeredHandler === 'function',
		'handler must be registered for user.registered',
	);

	await registeredHandler!({ userId: 'user-1', firstName: 'Jane', lastName: 'Doe' });

	assert.ok(
		queriedSql.some(
			(s) => s.includes('INSERT INTO fonderie_workspaces') && s.includes('is_personal'),
		),
		'should insert personal workspace',
	);
	assert.ok(
		queriedSql.some((s) => s.includes('INSERT INTO fonderie_roles')),
		'should create ADMIN role',
	);
	assert.ok(
		queriedSql.some((s) => s.includes('INSERT INTO fonderie_role_user_workspaces')),
		'should add owner as member',
	);
});

test('WorkspacesModule: skips provisioning when personalWorkspace config is false', async () => {
	const { WorkspacesModule } = await import('../module');

	let registeredHandler: (() => void) | undefined;
	const fakeBus = {
		on: (_t: string, h: any) => {
			registeredHandler = h;
		},
	} as any;

	const fakeApp = { use: () => {}, addRoute: () => {} } as any;
	const mod = new WorkspacesModule(makeStore(), { personalWorkspace: false }, fakeBus);
	mod.install(fakeApp);

	assert.equal(
		registeredHandler,
		undefined,
		'no handler should be registered when personalWorkspace is false',
	);
});

test('WorkspacesModule: idempotent — no error when personal workspace already exists', async () => {
	const { WorkspacesModule } = await import('../module');

	let registeredHandler: ((payload: any) => Promise<void>) | undefined;
	const fakeBus = {
		on: (_type: string, handler: any) => {
			registeredHandler = handler;
		},
		emit: async () => {},
	} as any;

	// personalWorkspace: null simulates ON CONFLICT DO NOTHING returning no row
	const fakeApp = { use: () => {}, addRoute: () => {} } as any;
	const mod = new WorkspacesModule(makeStore({ personalWorkspace: null }), {}, fakeBus);
	mod.install(fakeApp);

	await assert.doesNotReject(() => registeredHandler!({ userId: 'user-1' }));
});

// ── Invitation NOTIFICATION_EVENT ────────────────────────────────

test('invite: emits NOTIFICATION_EVENT with workspaceInvitation payload', async () => {
	const { invitationController } = await import('../controllers/invitation.controller');

	const FAKE_INVITATION = {
		id: 'inv-1',
		workspaceId: 'ws-1',
		email: 'guest@example.com',
		roleId: 'r-1',
		token: 'tok-abc',
		pin: '654321',
		status: 'PENDING',
		expiresAt: new Date().toISOString(),
		createdAt: new Date().toISOString(),
	};

	const invStore: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_workspace_invitations'))
				return [FAKE_INVITATION] as unknown as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(invStore),
	};

	const emitted: { type: string; payload: unknown }[] = [];
	const fakeBus = {
		emit: async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		},
	} as any;

	const ctrl = invitationController(invStore, '7d', fakeBus);
	const response = await ctrl.invite(
		makeCtx({
			workspace: WS,
			user: { id: 'user-1', email: 'a@b.com' },
			body: { email: 'guest@example.com', roleId: 'r-1' },
		}),
	);

	assert.equal(response.status, 201);
	assert.equal(emitted.length, 1);
	assert.equal(emitted[0]?.type, NOTIFICATION_EVENT);
	const p = emitted[0]?.payload as any;
	assert.equal(p.type, MESSAGE_KEYS.workspaceInvitation);
	assert.equal(p.recipient.email, 'guest@example.com');
	assert.ok(typeof p.data.pin === 'string');
	assert.ok(typeof p.data.token === 'string');
});
