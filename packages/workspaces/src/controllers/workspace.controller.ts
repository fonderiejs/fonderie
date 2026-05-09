import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IWorkspacesConfig } from '../config';
import type { IWorkspace }        from '../types';
import { WorkspaceModel }         from '../models/workspace.model';
import { MemberModel }            from '../models/member.model';
import { RoleModel }              from '../models/role.model';
import { toWorkspaceDTO, toSettingsDTO } from '../dtos/workspace';

export function workspaceController(store: IStoreAdapter, config: IWorkspacesConfig) {
	const workspaces  = new WorkspaceModel(store)
	const members     = new MemberModel(store)
	const roles       = new RoleModel(store)
	const defaultRole = config.defaultRole ?? 'member'

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.user) return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized')

			const list = await workspaces.findByUserId(ctx.user.id)
			return setApiResponse(HTTP.OK, 'WORKSPACES_FETCHED', 'Workspaces retrieved successfully.', {
				workspaces: list.map(toWorkspaceDTO),
			})
		},

		async create(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.user) return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized')

			const body        = ctx.meta['body'] as Record<string, unknown> | undefined
			const name        = body?.['name']
			const description = body?.['description']
			const type        = body?.['type']

			if (typeof name !== 'string' || name.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'name is required')
			}

			const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

			const workspace = await store.transaction(async tx => {
				const wsOpts: Parameters<typeof workspaces.create>[0] = {
					name:    name.trim(),
					slug,
					ownerId: ctx.user!.id,
					type:    typeof type === 'string' ? type : 'ORGANIZATION',
				}
				if (typeof description === 'string') wsOpts.description = description

				const wsModel   = new WorkspaceModel(tx)
				const roleModel = new RoleModel(tx)
				const memModel  = new MemberModel(tx)

				const ws = await wsModel.create(wsOpts)

				const [adminRole] = await Promise.all([
					roleModel.create({ name: 'ADMIN',       workspaceId: ws.id, description: 'Workspace administrator' }),
					roleModel.create({ name: defaultRole,   workspaceId: ws.id, description: 'Default member role'     }),
				])

				await memModel.add({ userId: ctx.user!.id, workspaceId: ws.id, roleId: adminRole.id })

				return ws
			})

			return setApiResponse(HTTP.CREATED, 'WORKSPACE_CREATED', 'Workspace created successfully.', {
				workspace: toWorkspaceDTO(workspace),
			})
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')
			return setApiResponse(HTTP.OK, 'WORKSPACE_FETCHED', 'Workspace retrieved successfully.', {
				workspace: toWorkspaceDTO(ctx.workspace as IWorkspace),
			})
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			const body = ctx.meta['body'] as Record<string, unknown> | undefined
			const opts: { name?: string; description?: string | null } = {}

			if (typeof body?.['name'] === 'string') opts.name = body['name'].trim()
			if (body?.['description'] !== undefined) {
				opts.description = typeof body['description'] === 'string'
					? body['description']
					: null
			}

			const workspace = await workspaces.update(ctx.workspace.id, opts)
			if (!workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			return setApiResponse(HTTP.OK, 'WORKSPACE_UPDATED', 'Workspace updated successfully.', {
				workspace: toWorkspaceDTO(workspace),
			})
		},

		async archive(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')
			if (!ctx.user)      return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized')

			await workspaces.archive(ctx.workspace.id, ctx.user.id)
			return setApiResponse(HTTP.OK, 'WORKSPACE_ARCHIVED', 'Workspace archived successfully.')
		},

		async restore(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			await workspaces.restore(ctx.workspace.id)
			return setApiResponse(HTTP.OK, 'WORKSPACE_RESTORED', 'Workspace restored successfully.')
		},

		async getSettings(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			const settings = await workspaces.getSettings(ctx.workspace.id)
			return setApiResponse(HTTP.OK, 'SETTINGS_FETCHED', 'Workspace settings retrieved successfully.', {
				settings: toSettingsDTO(settings),
			})
		},

		async updateSettings(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			const body = ctx.meta['body'] as Record<string, unknown> | undefined
			if (!body || Object.keys(body).length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'No settings provided')
			}

			const patch: Record<string, string> = {}
			for (const key of ['locale', 'timezone', 'currency', 'dateFormat', 'timeFormat'] as const) {
				if (typeof body[key] === 'string') patch[key] = body[key] as string
			}

			const settings = await workspaces.updateSettings(ctx.workspace.id, patch)
			return setApiResponse(HTTP.OK, 'SETTINGS_UPDATED', 'Workspace settings updated successfully.', {
				settings: toSettingsDTO(settings),
			})
		},
	}
}
