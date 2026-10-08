import type { IStoreAdapter } from '@fonderie/store';

import type { Operation, IPermissionCatalogEntry, IEffectivePermissions } from './types';
import type { IPermissionsConfig } from './config';
import { OPERATIONS, PERMISSION_COLUMN } from './constants';
import { getMembership, hasRole, listSystemRoleNames } from './services/membership';
import { checkPermission, listGrantedPermissions, readAccess } from './services/permissions';

const ALL_OPERATIONS = Object.values(OPERATIONS) as Operation[];

export class PermissionsEngine {
	private superRole: string;
	private grantsByRole: Record<string, Record<string, Operation[]>>;
	/** The app's declared resources, or null when it declared none. */
	readonly catalog: readonly IPermissionCatalogEntry[] | null;

	constructor(
		private store: IStoreAdapter,
		config: IPermissionsConfig = {},
	) {
		this.superRole = config.superRole ?? 'owner';
		this.catalog = config.catalog ? Object.freeze(config.catalog.map((e) => ({ ...e }))) : null;
		this.grantsByRole = config.systemGrants ?? {};
		// A misspelled resource in systemGrants would grant nothing, silently.
		// Refuse to start instead — a config mistake, caught at boot.
		if (this.catalog) {
			const known = new Set(this.catalog.map((e) => e.key));
			for (const [role, grants] of Object.entries(this.grantsByRole)) {
				for (const key of Object.keys(grants)) {
					if (!known.has(key)) {
						throw new Error(`[permissions] systemGrants.${role}.${key}: '${key}' is not in the catalog`);
					}
				}
			}
		}
	}

	/**
	 * What each SYSTEM role is granted by config (`systemGrants`) — rights that
	 * are never stored as rows, so a role editor reads them here to show them.
	 * A copy: changing it changes nothing.
	 */
	get systemGrants(): Record<string, Record<string, Operation[]>> {
		return Object.fromEntries(
			Object.entries(this.grantsByRole).map(([role, grants]) => [
				role,
				Object.fromEntries(Object.entries(grants).map(([key, ops]) => [key, [...ops]])),
			]),
		);
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
		if (Object.keys(this.grantsByRole).length > 0) {
			const roles = await listSystemRoleNames(userId, workspaceId, this.store);
			if (roles.some((r) => this.grantsByRole[r]?.[permissionKey]?.includes(operation) ?? false)) return true;
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
			Object.keys(this.grantsByRole).length ? listSystemRoleNames(userId, workspaceId, this.store) : Promise.resolve([]),
			listGrantedPermissions(userId, workspaceId, this.store),
		]);
		for (const role of systemRoles) {
			for (const [key, ops] of Object.entries(this.grantsByRole[role] ?? {})) {
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
		// An operation outside the four has no grant column; keep the old,
		// step-by-step path for it rather than change what it answers.
		if (!Object.hasOwn(PERMISSION_COLUMN, operation)) {
			const isMember = await getMembership(userId, workspaceId, this.store);
			if (!isMember) return false;
			if (await hasRole(userId, workspaceId, this.superRole, this.store)) return true;
			return this.allows(userId, workspaceId, permissionKey, operation);
		}

		// Member → super-role → config system grants → stored grants: the same
		// decisions in the same order, read in one round-trip.
		const a = await readAccess(userId, workspaceId, permissionKey, operation, this.superRole, this.store);
		if (!a.member) return false;
		if (a.isSuper) return true;
		if (a.systemRoles.some((r) => this.grantsByRole[r]?.[permissionKey]?.includes(operation) ?? false)) return true;
		return a.granted;
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
