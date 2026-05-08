import { test } from 'node:test'
import assert   from 'node:assert/strict'

import type { IStoreAdapter } from '@fonderie-js/store'
import type { IWorkspace, IMember } from '../types'

function makeStore(opts: {
	workspace?: IWorkspace | null
	member?:    IMember | null
	workspaces?: IWorkspace[]
} = {}): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async (sql: string) => {
			if (sql.includes('fonderie_workspaces') && sql.includes('owner_id')) {
				if (!opts.workspace) {
					return [];
				}
				
				return [{
					id:         opts.workspace.id,
					name:       opts.workspace.name,
					slug:       opts.workspace.slug,
					plan:       opts.workspace.plan,
					ownerId:    opts.workspace.ownerId,
					archivedAt: opts.workspace.archivedAt,
					createdAt:  opts.workspace.createdAt,
				}];
			}

			if (sql.includes('fonderie_workspaces') && sql.includes('wm.user_id')) {
				return opts.workspaces ?? [];
			}

			if (sql.includes('fonderie_workspace_members')) {
				if (!opts.member) {
					return [];
				}
				
				return [{
					id:          opts.member.id,
					userId:      opts.member.userId,
					workspaceId: opts.member.workspaceId,
					roleId:      opts.member.roleId,
					roleName:    opts.member.roleName,
					createdAt:   opts.member.createdAt,
				}];
			}

			return [];
		},
		transaction: async (fn) => fn(stub),
	}

	return stub;
}

const ws: IWorkspace = {
	id:         'ws-1',
	name:       'Acme',
	slug:       'acme',
	plan:       'free',
	ownerId:    'user-1',
	archivedAt: null,
	createdAt:  new Date(),
}

// ── findWorkspaceById ────────────────────────────────────────────

test('findWorkspaceById: returns workspace when found', async () => {
	const { findWorkspaceById } = await import('../services/workspaces');
	const store  = makeStore({ workspace: ws });
	const result = await findWorkspaceById('ws-1', store);

	assert.equal(result?.id,   'ws-1');
	assert.equal(result?.name, 'Acme');
});

test('findWorkspaceById: returns null when not found', async () => {
	const { findWorkspaceById } = await import('../services/workspaces');
	const store  = makeStore({ workspace: null });
	const result = await findWorkspaceById('ws-missing', store);

	assert.equal(result, null);
});

// ── getMember ────────────────────────────────────────────────────

test('getMember: returns member when found', async () => {
	const { getMember } = await import('../services/members');
	const member: IMember = {
		id: 'm-1', userId: 'user-1', workspaceId: 'ws-1',
		roleId: 'r-1', roleName: 'owner', createdAt: new Date(),
	}
	const store  = makeStore({ member });
	const result = await getMember('user-1', 'ws-1', store);

	assert.equal(result?.roleName, 'owner');
});

test('getMember: returns null when not a member', async () => {
	const { getMember } = await import('../services/members');
	const store  = makeStore({ member: null });
	const result = await getMember('user-2', 'ws-1', store);

	assert.equal(result, null);
});

// ── WorkspacesModule shape ───────────────────────────────────────

test('WorkspacesModule: satisfies IFonderieModule interface', async () => {
	const { WorkspacesModule } = await import('../module');
	const stub = makeStore({});
	const mod  = new WorkspacesModule(stub);

	assert.equal(mod.name, '@fonderie-js/workspaces');
	assert.ok(typeof mod.install === 'function');
});
