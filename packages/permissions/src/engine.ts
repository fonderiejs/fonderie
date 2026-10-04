import type { IStoreAdapter } from '@fonderie/store';

import type { Operation, IPermissionCatalogEntry, IEffectivePermissions } from './types';
import type { IPermissionsConfig } from './config';
import { OPERATIONS } from './constants';
import { getMembership, hasRole, listSystemRoleNames } from './services/membership';
import { checkPermission, listGrantedPermissions } from './services/permissions';

const ALL_OPERATIONS = Object.values(OPERATIONS) as Operation[];

export class PermissionsEngine {
	private superRole: string;
	private systemGrants: Record<string, Record<string, Operation[]>>;
	/** The app's declared resources, or null when it declared none. */
	readonly catalog: readonly IPermissionCatalogEntry[] | null;

	constructor(
		private store: IStoreAdapter,
		config: IPermissionsConfig = {},
	) {
		this.superRole = config.superRole ?? 'owner';
		this.catalog = config.catalog ? Object.freeze(config.catalog.map((e) => ({ ...e }))) : null;
		this.systemGrants = config.systemGrants ?? {};
		// A misspelled resource in systemGrants would grant nothing, silently.
		// Refuse to start instead — a config mistake, caught at boot.
		if (this.catalog) {
			const known = new Set(this.catalog.map((e) => e.key));
			for (const [role, grants] of Object.entries(this.systemGrants)) {
				for (const key of Object.keys(grants)) {
					if (!known.has(key)) {
						throw new Error(`[permissions] systemGrants.${role}.${key}: '${key}' is not in the catalog`);
					}
				}
			}
		}
	}

	/** Is this key in the catalog? Always true when the app declared no catalog. */
	isKnown(permissionKey: string): boolean {
		return !this.catalog || this.catalog.some((e) => e.key === permissionKey);
	}

	/** The operations a resource supports (all four when not declared). */
	operationsOf(permissionKey: string): Operation[] {
		return this.catalog?.find((e) => e.key === permissionKey)?.operations ?? ALL_OPERATIONS;
	}

	private async allows(
		userId: string,
		workspaceId: string,
		permissionKey: string,
		operation: Operation,
	): Promise<boolean> {
		if (Object.keys(this.systemGrants).length > 0) {
			const roles = await listSystemRoleNames(userId, workspaceId, this.store);
			if (roles.some((r) => this.systemGrants[r]?.[permissionKey]?.includes(operation) ?? false)) return true;
		}
		return checkPermission(userId, workspaceId, permissionKey, operation, this.store);
	}

	/**
	 * Everything this member may do in this workspace, in one read — what a
	 * client needs to show only the actions that will succeed. Null when the
	 * user is not a member. Lists the catalog's resources (every operation
	 * present, true or false) plus any granted key outside it.
	 */
	async effective(userId: string, workspaceId: string): Promise<IEffectivePermissions | null> {
		if (!(await getMembership(userId, workspaceId, this.store))) return null;

		const permissions: Record<string, Record<Operation, boolean>> = {};
		const entry = (key: string) =>
			(permissions[key] ??= { create: false, read: false, update: false, delete: false });
		for (const e of this.catalog ?? []) entry(e.key);

		if (await hasRole(userId, workspaceId, this.superRole, this.store)) {
			for (const e of this.catalog ?? []) {
				for (const op of e.operations ?? ALL_OPERATIONS) entry(e.key)[op] = true;
			}
			return { isSuper: true, permissions };
		}

		const [systemRoles, stored] = await Promise.all([
			Object.keys(this.systemGrants).length ? listSystemRoleNames(userId, workspaceId, this.store) : Promise.resolve([]),
			listGrantedPermissions(userId, workspaceId, this.store),
		]);
		for (const role of systemRoles) {
			for (const [key, ops] of Object.entries(this.systemGrants[role] ?? {})) {
				for (const op of ops) entry(key)[op] = true;
			}
		}
		for (const g of stored) {
			const e = entry(g.permissionKey);
			for (const op of ALL_OPERATIONS) e[op] ||= Boolean(g[op]);
		}
		return { isSuper: false, permissions };
	}

	async getMembership(userId: string, workspaceId: string) {
		return getMembership(userId, workspaceId, this.store);
	}

	async can(
		userId: string,
		operation: Operation,
		permissionKey: string,
		workspaceId: string,
	): Promise<boolean> {
		const isMember = await getMembership(userId, workspaceId, this.store);
		if (!isMember) return false;

		if (await hasRole(userId, workspaceId, this.superRole, this.store)) return true;

		return this.allows(userId, workspaceId, permissionKey, operation);
	}

	async assert(
		userId: string,
		operation: Operation,
		permissionKey: string,
		workspaceId: string,
	): Promise<void> {
		const allowed = await this.can(userId, operation, permissionKey, workspaceId);
		if (!allowed) {
			throw new PermissionDeniedError(operation, permissionKey);
		}
	}

	async canAll(
		userId: string,
		checks: Array<{ operation: Operation; permissionKey: string }>,
		workspaceId: string,
	): Promise<boolean> {
		const isMember = await getMembership(userId, workspaceId, this.store);
		if (!isMember) return false;

		if (await hasRole(userId, workspaceId, this.superRole, this.store)) return true;

		const results = await Promise.all(
			checks.map((c) => this.allows(userId, workspaceId, c.permissionKey, c.operation)),
		);
		return results.every(Boolean);
	}

	async canAny(
		userId: string,
		checks: Array<{ operation: Operation; permissionKey: string }>,
		workspaceId: string,
	): Promise<boolean> {
		const isMember = await getMembership(userId, workspaceId, this.store);
		if (!isMember) return false;

		if (await hasRole(userId, workspaceId, this.superRole, this.store)) return true;

		const results = await Promise.all(
			checks.map((c) => this.allows(userId, workspaceId, c.permissionKey, c.operation)),
		);
		return results.some(Boolean);
	}
}

export class PermissionDeniedError extends Error {
	readonly status = 403;

	constructor(operation: string, permissionKey: string) {
		super(`Permission denied: ${operation}:${permissionKey}`);
		this.name = 'PermissionDeniedError';
	}
}
