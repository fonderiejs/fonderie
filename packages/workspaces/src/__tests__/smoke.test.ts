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
			if (sql.includes('fonderie_workspaces') && sql.includes('owner_id')) {
				if (!opts.workspace) return [] as T[]
				return [opts.workspace] as T[]
			}

			if (sql.includes('fonderie_workspaces') && sql.includes('GROUP BY w.id')) {
				return (opts.workspaces ?? []) as T[]
			}

			if (sql.includes('fonderie_role_user_workspaces') && sql.includes('LIMIT 1')) {
				if (!opts.member) return [] as T[]
				return [opts.member] as T[]
			}

			if (sql.includes('fonderie_roles') && sql.includes('ORDER BY')) {
				return (opts.roles ?? []) as T[]
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
