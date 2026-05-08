import { test } from 'node:test'
import assert   from 'node:assert/strict'

import type { IStoreAdapter }          from '@fonderie-js/store'
import type { IWorkspace, IMember, IRole } from '../types'

function makeStore(opts: {
	workspace?:  IWorkspace | null
	member?:     IMember | null
	workspaces?: IWorkspace[]
	roles?:      IRole[]
} = {}): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_workspaces') && sql.includes('GROUP BY w.id')) {
				return (opts.workspaces ?? []) as T[]
			}

			if (sql.includes('fonderie_workspaces') && sql.includes('WHERE id = $1')) {
				if (!opts.workspace) return [] as T[]
				return [opts.workspace] as T[]
			}

			if (sql.includes('fonderie_role_user_workspaces') && sql.includes('LIMIT 1')) {
				if (!opts.member) return [] as T[]
				return [opts.member] as T[]
			}

			if (sql.includes('fonderie_roles') && sql.includes('ORDER BY')) {
				return (opts.roles ?? []) as T[]
			}

			// INSERT INTO fonderie_workspaces → createWorkspace
			if (sql.includes('INSERT INTO fonderie_workspaces')) {
				if (!opts.workspace) return [] as T[]
				return [opts.workspace] as T[]
			}

			// INSERT INTO fonderie_roles → createRole
			if (sql.includes('INSERT INTO fonderie_roles')) {
				return [{ id: 'role-1', name: 'ADMIN', isSystem: false, active: true, description: null, workspaceId: opts.workspace?.id ?? 'ws-1' }] as unknown as T[]
			}

			// UPDATE fonderie_workspaces → updateWorkspace
			if (sql.includes('UPDATE fonderie_workspaces') && sql.includes('RETURNING')) {
				if (!opts.workspace) return [] as T[]
				return [opts.workspace] as T[]
			}

			return [] as T[]
		},
		transaction: async (fn) => fn(stub),
	}
	return stub
}

const WS: IWorkspace = {
	id: 'ws-1', name: 'Acme', slug: 'acme', type: 'ORGANIZATION',
	description: null, plan: 'free', ownerId: 'user-1',
	archivedAt: null, archivedBy: null, createdAt: new Date().toISOString(), updatedAt: null,
}

const MEMBER: IMember = {
	userId: 'user-1', workspaceId: 'ws-1', roleId: 'r-1',
	roleName: 'ADMIN', confirmed: true, createdAt: new Date().toISOString(),
}

// ── findWorkspaceById ────────────────────────────────────────────

test('findWorkspaceById: returns workspace when found', async () => {
	const { findWorkspaceById } = await import('../services/workspaces')
	const result = await findWorkspaceById('ws-1', makeStore({ workspace: WS }))
	assert.equal(result?.id,   'ws-1')
	assert.equal(result?.name, 'Acme')
	assert.equal(result?.type, 'ORGANIZATION')
})

test('findWorkspaceById: returns null when not found', async () => {
	const { findWorkspaceById } = await import('../services/workspaces')
	const result = await findWorkspaceById('ws-missing', makeStore({ workspace: null }))
	assert.equal(result, null)
})

// ── getMember ────────────────────────────────────────────────────

test('getMember: returns member when found', async () => {
	const { getMember } = await import('../services/members')
	const result = await getMember('user-1', 'ws-1', makeStore({ member: MEMBER }))
	assert.equal(result?.roleName, 'ADMIN')
	assert.equal(result?.confirmed, true)
})

test('getMember: returns null when not a member', async () => {
	const { getMember } = await import('../services/members')
	const result = await getMember('user-2', 'ws-1', makeStore({ member: null }))
	assert.equal(result, null)
})

// ── listWorkspaceRoles ───────────────────────────────────────────

test('listWorkspaceRoles: returns roles for workspace', async () => {
	const { listWorkspaceRoles } = await import('../services/roles')
	const roles: IRole[] = [
		{ id: 'r-1', name: 'ADMIN', isSystem: false, active: true, description: null, workspaceId: 'ws-1' },
		{ id: 'r-2', name: 'GUEST', isSystem: true,  active: true, description: null, workspaceId: null },
	]
	const result = await listWorkspaceRoles('ws-1', makeStore({ roles }))
	assert.equal(result.length, 2)
})

// ── toWorkspaceDTO ───────────────────────────────────────────────

test('toWorkspaceDTO: maps all fields correctly', async () => {
	const { toWorkspaceDTO } = await import('../dtos/workspace')
	const dto = toWorkspaceDTO(WS)
	assert.equal(dto.id,         'ws-1')
	assert.equal(dto.type,       'ORGANIZATION')
	assert.equal(dto.isArchived, false)
	assert.equal(dto.archivedAt, '')
})

// ── WorkspacesModule shape ───────────────────────────────────────

test('WorkspacesModule: satisfies IFonderieModule interface', async () => {
	const { WorkspacesModule } = await import('../module')
	const mod = new WorkspacesModule(makeStore({}))
	assert.equal(mod.name, '@fonderie-js/workspaces')
	assert.ok(typeof mod.install === 'function')
})

// ── Ctx helper ───────────────────────────────────────────────────

function makeCtx(opts: {
	user?:      { id: string; email: string } | null
	workspace?: IWorkspace | null
	params?:    Record<string, string>
	header?:    Record<string, string>
	body?:      Record<string, unknown>
} = {}): any {
	return {
		user:      'user'      in opts ? opts.user      : null,
		workspace: 'workspace' in opts ? opts.workspace : null,
		tenant:    null,
		meta:      {
			body:   opts.body   ?? {},
			params: opts.params ?? {},
		},
		request: new Request('http://localhost/', {
			headers: opts.header ?? {},
		}),
	}
}

// ── workspaceContextMiddleware ────────────────────────────────────

test('workspaceContext: calls next when no workspace ID in request', async () => {
	const { workspaceContextMiddleware } = await import('../middlewares/workspace-context')
	const middleware = workspaceContextMiddleware(makeStore({ workspace: WS }))
	let called = false
	await middleware(makeCtx({ user: { id: 'user-1', email: 'a@b.com' } }), async () => {
		called = true
		return Response.json({})
	})
	assert.ok(called)
})

test('workspaceContext: 404 when workspace not found', async () => {
	const { workspaceContextMiddleware } = await import('../middlewares/workspace-context')
	const middleware = workspaceContextMiddleware(makeStore({ workspace: null }))
	const response   = await middleware(
		makeCtx({ header: { 'x-workspace-id': 'ws-missing' }, user: { id: 'user-1', email: 'a@b.com' } }),
		async () => Response.json({}),
	)
	assert.equal(response?.status, 404)
})

test('workspaceContext: 403 when user is not a member', async () => {
	const { workspaceContextMiddleware } = await import('../middlewares/workspace-context')
	const middleware = workspaceContextMiddleware(makeStore({ workspace: WS, member: null }))
	const response   = await middleware(
		makeCtx({ header: { 'x-workspace-id': 'ws-1' }, user: { id: 'stranger', email: 'x@b.com' } }),
		async () => Response.json({}),
	)
	assert.equal(response?.status, 403)
})

test('workspaceContext: resolves workspace and calls next when member found', async () => {
	const { workspaceContextMiddleware } = await import('../middlewares/workspace-context')
	const middleware = workspaceContextMiddleware(makeStore({ workspace: WS, member: MEMBER }))
	let   called     = false
	await middleware(
		makeCtx({ header: { 'x-workspace-id': 'ws-1' }, user: { id: 'user-1', email: 'a@b.com' } }),
		async () => { called = true; return Response.json({}) },
	)
	assert.ok(called)
})

// ── listWorkspacesHandler ─────────────────────────────────────────

test('listWorkspaces: 401 when not authenticated', async () => {
	const { listWorkspacesHandler } = await import('../handlers/workspaces')
	const handler  = listWorkspacesHandler(makeStore({ workspaces: [WS] }))
	const response = await handler(makeCtx({ user: null }))
	assert.equal(response.status, 401)
})

test('listWorkspaces: 200 with workspaces array', async () => {
	const { listWorkspacesHandler } = await import('../handlers/workspaces')
	const handler  = listWorkspacesHandler(makeStore({ workspaces: [WS] }))
	const response = await handler(makeCtx({ user: { id: 'user-1', email: 'a@b.com' } }))
	assert.equal(response.status, 200)
	const body = await response.json() as any
	assert.ok(Array.isArray(body.workspaces))
	assert.equal(body.workspaces.length, 1)
	assert.equal(body.workspaces[0].id, 'ws-1')
})

// ── createWorkspaceHandler ────────────────────────────────────────

test('createWorkspace: 422 when name is missing', async () => {
	const { createWorkspaceHandler } = await import('../handlers/workspaces')
	const handler  = createWorkspaceHandler(makeStore({ workspace: WS }), 'member')
	const response = await handler(makeCtx({ user: { id: 'user-1', email: 'a@b.com' }, body: {} }))
	assert.equal(response.status, 422)
})

test('createWorkspace: 201 with workspace DTO', async () => {
	const { createWorkspaceHandler } = await import('../handlers/workspaces')
	const handler  = createWorkspaceHandler(makeStore({ workspace: WS }), 'member')
	const response = await handler(makeCtx({
		user: { id: 'user-1', email: 'a@b.com' },
		body: { name: 'Acme Corp' },
	}))
	assert.equal(response.status, 201)
	const body = await response.json() as any
	assert.ok(body.workspace)
	assert.equal(body.workspace.id,   'ws-1')
	assert.equal(body.workspace.name, 'Acme')
	assert.ok(typeof body.workspace.isArchived === 'boolean')
})

// ── updateWorkspaceHandler ────────────────────────────────────────

test('updateWorkspace: 200 with updated workspace DTO', async () => {
	const { updateWorkspaceHandler } = await import('../handlers/workspaces')
	const updated  = { ...WS, name: 'Acme Updated' }
	const handler  = updateWorkspaceHandler(makeStore({ workspace: updated }))
	const response = await handler(makeCtx({
		workspace: WS,
		body:      { name: 'Acme Updated' },
	}))
	assert.equal(response.status, 200)
	const body = await response.json() as any
	assert.equal(body.workspace.name, 'Acme Updated')
	assert.ok(typeof body.workspace.isArchived === 'boolean')
})

// ── getWorkspaceHandler ───────────────────────────────────────────

test('getWorkspace: 404 when workspace not on ctx', async () => {
	const { getWorkspaceHandler } = await import('../handlers/workspaces')
	const handler  = getWorkspaceHandler()
	const response = await handler(makeCtx({ workspace: null }))
	assert.equal(response.status, 404)
})

test('getWorkspace: 200 with workspace DTO', async () => {
	const { getWorkspaceHandler } = await import('../handlers/workspaces')
	const handler  = getWorkspaceHandler()
	const response = await handler(makeCtx({ workspace: WS }))
	assert.equal(response.status, 200)
	const body = await response.json() as any
	assert.equal(body.workspace.id,         'ws-1')
	assert.equal(body.workspace.isArchived, false)
})
