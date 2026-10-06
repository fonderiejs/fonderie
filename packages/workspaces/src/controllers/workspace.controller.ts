import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IWorkspacesConfig } from '../config';
import type { IWorkspace } from '../types';
import { WorkspaceModel } from '../models/workspace.model';
import { MemberModel } from '../models/member.model';
import { RoleModel } from '../models/role.model';
import { toWorkspaceDTO, toSettingsDTO } from '../dtos/workspace';
import { fromProfile } from '../services/contacts';

export function workspaceController(store: IStoreAdapter, config: IWorkspacesConfig) {
	const workspaces = new WorkspaceModel(store);
	const members = new MemberModel(store);
	const roles = new RoleModel(store);

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.user)
				return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required');
			const list = await workspaces.findByUserId(ctx.user.id);
			return setApiResponse(HTTP.OK, 'WORKSPACES_FETCHED', 'Workspaces retrieved successfully.', {
				workspaces: list.map(toWorkspaceDTO),
			});
		},

		async create(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const name = body?.['name'];
			const description = body?.['description'];
			const type = body?.['type'];

			if (typeof name !== 'string' || name.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'name is required');
			}

			if (type === 'PERSONAL') {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'Personal workspaces are created automatically',
				);
			}

			const slug = name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');

			const workspace = await store.transaction(async (tx) => {
				const wsOpts: Parameters<typeof workspaces.create>[0] = {
					name: name.trim(),
					slug,
					ownerId: ctx.user!.id,
					type: typeof type === 'string' ? type : 'ORGANIZATION',
				};
				if (typeof description === 'string') wsOpts.description = description;

				const wsModel = new WorkspaceModel(tx);
				const roleModel = new RoleModel(tx);
				const memModel = new MemberModel(tx);

				const ws = await wsModel.create(wsOpts);

				const adminRole = await roleModel.findSystem('ADMIN');
				if (!adminRole) throw new Error('System ADMIN role not found');
				await memModel.add({ userId: ctx.user!.id, workspaceId: ws.id, roleId: adminRole.id });

				return ws;
			});

			return setApiResponse(HTTP.CREATED, 'WORKSPACE_CREATED', 'Workspace created successfully.', {
				workspace: toWorkspaceDTO(workspace),
			});
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			return setApiResponse(HTTP.OK, 'WORKSPACE_FETCHED', 'Workspace retrieved successfully.', {
				workspace: toWorkspaceDTO(ctx.workspace as IWorkspace),
			});
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const opts: Parameters<typeof workspaces.update>[1] = {};

			if (typeof body?.['name'] === 'string') opts.name = body['name'].trim();
			if (body?.['description'] !== undefined)
				opts.description = typeof body['description'] === 'string' ? body['description'] : null;
			if (body?.['motto'] !== undefined)
				opts.motto = typeof body['motto'] === 'string' ? body['motto'] : null;
			if (body?.['phone'] !== undefined)
				opts.phone = typeof body['phone'] === 'string' ? body['phone'].trim() : null;
			if (body?.['businessType'] !== undefined)
				opts.businessType = typeof body['businessType'] === 'string' ? body['businessType'] : null;
			if (body?.['industry'] !== undefined)
				opts.industry = typeof body['industry'] === 'string' ? body['industry'] : null;
			if (body?.['address'] !== undefined && typeof body['address'] === 'object')
				opts.address = (body['address'] ?? null) as NonNullable<
					Parameters<typeof workspaces.update>[1]
				>['address'] & (object | null);

			for (const key of ['legalName', 'email', 'website', 'logoUrl'] as const) {
				if (body?.[key] !== undefined) opts[key] = typeof body[key] === 'string' ? (body[key] as string) : null;
			}
			if (Array.isArray(body?.['taxRegistrations'])) opts.taxRegistrations = body['taxRegistrations'] as NonNullable<typeof opts.taxRegistrations>;
			if (Array.isArray(body?.['languages'])) opts.languages = body['languages'] as string[];

			// The profile's email / phone / address are the mirror of the primary
			// email, the primary phone and the head office: one transaction moves both.
			const id = ctx.workspace.id;
			const workspace = await store.transaction(async (tx) => {
				const updated = await new WorkspaceModel(tx).update(id, opts);
				if (!updated) return null;
				const mirrored = { email: opts.email, phone: opts.phone, address: opts.address };
				if (Object.values(mirrored).every((v) => v === undefined)) return updated;
				await fromProfile(tx, id, mirrored);
				return new WorkspaceModel(tx).findById(id);
			});
			if (!workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			return setApiResponse(HTTP.OK, 'WORKSPACE_UPDATED', 'Workspace updated successfully.', {
				workspace: toWorkspaceDTO(workspace),
			});
		},

		async archive(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			if (ctx.workspace.isPersonal) {
				return setApiResponse(
					HTTP.FORBIDDEN,
					'FORBIDDEN',
					'Personal workspaces cannot be archived',
				);
			}

			await workspaces.archive(ctx.workspace.id, ctx.user!.id);
			return setApiResponse(HTTP.OK, 'WORKSPACE_ARCHIVED', 'Workspace archived successfully.');
		},

		async restore(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			await workspaces.restore(ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'WORKSPACE_RESTORED', 'Workspace restored successfully.');
		},

		async getSettings(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const settings = await workspaces.getSettings(ctx.workspace.id);
			return setApiResponse(
				HTTP.OK,
				'SETTINGS_FETCHED',
				'Workspace settings retrieved successfully.',
				{
					settings: toSettingsDTO(settings),
				},
			);
		},

		async updateSettings(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			if (!body || Object.keys(body).length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'No settings provided');
			}

			const patch: Record<string, string> & { documentPrefixes?: Record<string, string> | null } = {};
			for (const key of ['locale', 'timezone', 'currency', 'dateFormat', 'timeFormat'] as const) {
				if (typeof body[key] === 'string') patch[key] = body[key] as string;
			}
			// Validated and upper-cased by updateSettingsSchema; null clears the map.
			if (body['documentPrefixes'] !== undefined) {
				patch.documentPrefixes =
					body['documentPrefixes'] && typeof body['documentPrefixes'] === 'object'
						? (body['documentPrefixes'] as Record<string, string>)
						: {};
			}

			const settings = await workspaces.updateSettings(ctx.workspace.id, patch);
			return setApiResponse(
				HTTP.OK,
				'SETTINGS_UPDATED',
				'Workspace settings updated successfully.',
				{
					settings: toSettingsDTO(settings),
				},
			);
		},
	};
}
