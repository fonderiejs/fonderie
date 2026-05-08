import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import {
	createWorkspace, findWorkspacesByUserId,
	updateWorkspace, archiveWorkspace, restoreWorkspace,
	getWorkspaceSettings, updateWorkspaceSettings,
} from '../services/workspaces';
import { addMember }  from '../services/members';
import { createRole } from '../services/roles';
import { toWorkspaceDTO, toSettingsDTO } from '../dtos/workspace';

export function listWorkspacesHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

		const workspaces = await findWorkspacesByUserId(ctx.user.id, store)
		return Response.json({ workspaces: workspaces.map(toWorkspaceDTO) })
	}
}

export function createWorkspaceHandler(store: IStoreAdapter, defaultRole: string) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

		const body        = ctx.meta['body'] as Record<string, unknown> | undefined
		const name        = body?.['name']
		const description = body?.['description']
		const type        = body?.['type']

		if (typeof name !== 'string' || name.trim().length === 0) {
			return Response.json({ error: 'name is required' }, { status: 422 })
		}

		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

		const workspace = await store.transaction(async tx => {
			const wsOpts: Parameters<typeof createWorkspace>[0] = {
				name:    name.trim(),
				slug,
				ownerId: ctx.user!.id,
				type:    typeof type === 'string' ? type : 'ORGANIZATION',
			}
			if (typeof description === 'string') wsOpts.description = description

			const ws = await createWorkspace(wsOpts, tx)

			// Create default workspace roles
			const [adminRole] = await Promise.all([
				createRole({ name: 'ADMIN', workspaceId: ws.id, description: 'Workspace administrator' }, tx),
				createRole({ name: defaultRole, workspaceId: ws.id, description: 'Default member role' }, tx),
			])

			// Add creator as ADMIN
			await addMember({ userId: ctx.user!.id, workspaceId: ws.id, roleId: adminRole.id }, tx)

			return ws
		})

		return Response.json({ workspace: toWorkspaceDTO(workspace) }, { status: 201 })
	}
}

export function getWorkspaceHandler() {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })
		return Response.json({ workspace: ctx.workspace })
	}
}

export function updateWorkspaceHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		const opts: { name?: string; description?: string | null } = {}

		if (typeof body?.['name'] === 'string') opts.name = body['name'].trim()
		if (body?.['description'] !== undefined) {
			opts.description = typeof body['description'] === 'string'
				? body['description']
				: null
		}

		const workspace = await updateWorkspace(ctx.workspace.id, opts, store)
		if (!workspace) return Response.json({ error: 'Not found' }, { status: 404 })

		return Response.json({ workspace: toWorkspaceDTO(workspace) })
	}
}

export function archiveWorkspaceHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })
		if (!ctx.user)      return Response.json({ error: 'Unauthorized' },         { status: 401 })

		await archiveWorkspace(ctx.workspace.id, ctx.user.id, store)
		return Response.json({ ok: true })
	}
}

export function restoreWorkspaceHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		await restoreWorkspace(ctx.workspace.id, store)
		return Response.json({ ok: true })
	}
}

export function getSettingsHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const settings = await getWorkspaceSettings(ctx.workspace.id, store)
		return Response.json({ settings: toSettingsDTO(settings) })
	}
}

export function updateSettingsHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return Response.json({ error: 'Workspace not found' }, { status: 404 })

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		if (!body || Object.keys(body).length === 0) {
			return Response.json({ error: 'No settings provided' }, { status: 422 })
		}

		const patch: Record<string, string> = {}
		for (const key of ['locale', 'timezone', 'currency', 'dateFormat', 'timeFormat'] as const) {
			if (typeof body[key] === 'string') patch[key] = body[key] as string
		}

		const settings = await updateWorkspaceSettings(ctx.workspace.id, patch, store)
		return Response.json({ settings: toSettingsDTO(settings) })
	}
}
