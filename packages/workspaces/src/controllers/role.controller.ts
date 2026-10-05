import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { RoleModel } from '../models/role.model';
import { toRoleDTO } from '../dtos/workspace';
import { permissionsEngine } from '../permissions-engine';
import { listRoleBin, purgeRoleFromBin, restoreRole } from '../services/roles';

export function roleController(store: IStoreAdapter) {
	const roles = new RoleModel(store);
	const roleIdOf = (ctx: IFonderieContext) => (ctx.meta['params'] as Record<string, string> | undefined)?.['roleId'];

	return {
		// ── The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3) ──────────
		async listBin(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			const rows = await listRoleBin(store, ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'ROLE_BIN', 'Deleted roles.', {
				roles: rows.map((r) => ({
					...r,
					deletedAt: new Date(r.deletedAt).toISOString(),
					purgeAt: new Date(r.purgeAt).toISOString(),
				})),
			});
		},

		async restore(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			const roleId = roleIdOf(ctx);
			if (!roleId) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');
			const r = await restoreRole(store, roleId, ctx.workspace.id);
			if (r.status === 'not-in-bin')
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_IN_BIN', 'Nothing to restore: not deleted here, or deleted too long ago.');
			if (r.status === 'conflict')
				return setApiResponse(HTTP.CONFLICT, 'RESTORE_CONFLICT', 'A role with this name exists now. Rename it, then restore.');
			const role = await roles.findById(roleId, ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'ROLE_RESTORED', 'Role restored.', {
				role: role ? toRoleDTO(role) : null,
				reassigned: r.reassigned,
			});
		},

		// The owner only: a manager who could empty the bin could delete and
		// then erase the undo.
		async purge(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			if ((ctx.workspace as { ownerId?: string }).ownerId !== ctx.user?.id)
				return setApiResponse(HTTP.FORBIDDEN, 'OWNER_REQUIRED', 'Only the workspace owner can empty the bin.');
			const roleId = roleIdOf(ctx);
			if (!roleId || !(await purgeRoleFromBin(store, roleId, ctx.workspace.id)))
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_IN_BIN', 'Not in the bin.');
			return new Response(null, { status: HTTP.NO_CONTENT });
		},

		async create(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const name = body?.['name'];
			const description = body?.['description'];

			if (typeof name !== 'string' || name.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'name is required');
			}

			try {
				const opts: Parameters<typeof roles.create>[0] = {
					name: name.trim(),
					workspaceId: ctx.workspace.id,
				};

				if (typeof description === 'string') {
					opts.description = description;
				}

				const role = await roles.create(opts);
				return setApiResponse(HTTP.CREATED, 'ROLE_CREATED', 'Role created successfully.', {
					role: toRoleDTO(role),
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to create role';
				return setApiResponse(HTTP.BAD_REQUEST, 'OPERATION_FAILED', message);
			}
		},

		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			}

			const list = await roles.list(ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'ROLES_FETCHED', 'Roles retrieved successfully.', {
				roles: list.map(toRoleDTO),
			});
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const roleId = params?.['roleId'];
			if (!roleId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');
			}

			const role = await roles.findById(roleId, ctx.workspace.id);
			if (!role) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Role not found');
			}

			return setApiResponse(HTTP.OK, 'ROLE_FETCHED', 'Role retrieved successfully.', {
				role: toRoleDTO(role),
			});
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const roleId = params?.['roleId'];
			if (!roleId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');
			}

			const opts: { name?: string; description?: string | null; active?: boolean } = {};

			if (typeof body?.['name'] === 'string') {
				opts.name = body['name'];
			}

			if (typeof body?.['description'] === 'string') {
				opts.description = body['description'];
			}

			if (body?.['description'] === null) {
				opts.description = null;
			}

			if (typeof body?.['active'] === 'boolean') {
				opts.active = body['active'];
			}

			const role = await roles.update(roleId, ctx.workspace.id, opts);
			if (!role) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Role not found or is a system role');
			}

			return setApiResponse(HTTP.OK, 'ROLE_UPDATED', 'Role updated successfully.', {
				role: toRoleDTO(role),
			});
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const roleId = params?.['roleId'];
			if (!roleId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');
			}

			// Into the undo bin: restorable for 30 days.
			const result = await roles.delete(roleId, ctx.workspace.id, ctx.user?.id ?? null);
			if (!result) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Role not found');

			// Members who held it lose it; anyone for whom it was the ONLY role
			// stays on the team with the default role instead of vanishing.
			return setApiResponse(HTTP.OK, 'ROLE_DELETED', 'Role deleted successfully.', result);
		},

		async getPermissions(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const roleId = params?.['roleId'];
			if (!roleId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');
			}

			const role = await roles.findById(roleId, ctx.workspace.id);
			if (!role) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Role not found');
			}

			const permissions = await roles.getPermissions(roleId, ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'PERMISSIONS_FETCHED', 'Role permissions retrieved successfully.', {
				permissions,
			});
		},

		async setPermissions(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const roleId = params?.['roleId'];
			if (!roleId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'roleId is required');
			}

			// Confirm the role belongs to this workspace before writing permissions —
			// without this, a member could seed permission rows against another
			// workspace's role id (IDOR). System roles are read-only here too.
			const target = await roles.findById(roleId, ctx.workspace.id);
			if (!target || target.isSystem) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Role not found');
			}

			const perms = body?.['permissions'];
			if (!Array.isArray(perms)) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'permissions array is required',
				);
			}

			const normalized = perms
				.map((p: unknown) => {
					const perm = p as Record<string, unknown>;
					return {
						permissionKey: String(perm['permissionKey'] ?? ''),
						canCreate: Boolean(perm['canCreate']),
						canRead: Boolean(perm['canRead']),
						canUpdate: Boolean(perm['canUpdate']),
						canDelete: Boolean(perm['canDelete']),
					};
				})
				.filter((p) => p.permissionKey.length > 0);

			// With a catalog declared, a role can only grant what the server
			// checks: a key nothing guards, or an operation the resource does not
			// have, would show an owner a restriction that restricts nothing.
			const engine = permissionsEngine(ctx);
			if (engine?.catalog) {
				for (const p of normalized) {
					if (!engine.isKnown(p.permissionKey)) {
						return setApiResponse(
							HTTP.UNPROCESSABLE,
							'UNKNOWN_PERMISSION',
							`'${p.permissionKey}' is not a permission this app checks`,
						);
					}
					const ops = engine.operationsOf(p.permissionKey);
					const asked = (['create', 'read', 'update', 'delete'] as const).filter(
						(op) => p[`can${op[0]!.toUpperCase()}${op.slice(1)}` as 'canCreate'],
					);
					const unsupported = asked.find((op) => !ops.includes(op));
					if (unsupported) {
						return setApiResponse(
							HTTP.UNPROCESSABLE,
							'UNSUPPORTED_OPERATION',
							`'${p.permissionKey}' has no '${unsupported}' operation`,
						);
					}
				}
			}

			await roles.setPermissions(roleId, ctx.workspace.id, normalized);

			return setApiResponse(HTTP.OK, 'PERMISSIONS_SET', 'Role permissions updated successfully.');
		},
	};
}
