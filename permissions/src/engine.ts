import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IPermission }       from './types';
import type { IPermissionsConfig } from './config';
import { getMembership }          from './services/membership';
import { getPermissionsForUser }  from './services/permissions';

export class PermissionsEngine {
	private wildcards: boolean
	private superRole: string

	constructor(
		private store: IStoreAdapter,
		config: IPermissionsConfig = {},
	) {
		this.wildcards = config.wildcards ?? true
		this.superRole = config.superRole ?? 'owner'
	}

	async getMembership(userId: string, workspaceId: string) {
		return getMembership(userId, workspaceId, this.store)
	}

	// Primary check — the one method every handler calls
	async can(
		userId:      string,
		action:      string,
		resource:    string,
		workspaceId: string,
	): Promise<boolean> {
		const membership = await this.getMembership(userId, workspaceId);
		if (!membership) {
			return false;
		}

		// Super-role bypasses all permission checks
		if (membership.roleName === this.superRole) {
			return true;
		}

		const permissions = await getPermissionsForUser(userId, workspaceId, this.store);
		return this.matches(permissions, action, resource);
	}

	// Convenience — throws 403 instead of returning false
	async assert(
		userId:      string,
		action:      string,
		resource:    string,
		workspaceId: string,
	): Promise<void> {
		const allowed = await this.can(userId, action, resource, workspaceId);
		if (!allowed) {
			throw new PermissionDeniedError(action, resource);
		}
	}

	// Check multiple permissions at once — all must pass
	async canAll(
		userId:      string,
		checks:      Array<{ action: string; resource: string }>,
		workspaceId: string,
	): Promise<boolean> {
		const membership = await this.getMembership(userId, workspaceId);
		if (!membership) {
			return false;
		}

		if (membership.roleName === this.superRole) {
			return true;
		}

		const permissions = await getPermissionsForUser(userId, workspaceId, this.store);
		return checks.every(c => this.matches(permissions, c.action, c.resource));
	}

	// Check multiple permissions — at least one must pass
	async canAny(
		userId:      string,
		checks:      Array<{ action: string; resource: string }>,
		workspaceId: string,
	): Promise<boolean> {
		const membership = await this.getMembership(userId, workspaceId);
		if (!membership) {
			return false;
		}

		if (membership.roleName === this.superRole) {
			return true;
		}

		const permissions = await getPermissionsForUser(userId, workspaceId, this.store);
		return checks.some(c => this.matches(permissions, c.action, c.resource));
	}

	private matches(permissions: IPermission[], action: string, resource: string): boolean {
		return permissions.some(p => {
			const actionMatch    = p.action   === action   || (this.wildcards && p.action   === '*');
			const resourceMatch  = p.resource === resource || (this.wildcards && p.resource === '*');
			return actionMatch && resourceMatch;
		});
	}
}

export class PermissionDeniedError extends Error {
	readonly status = 403;

	constructor(action: string, resource: string) {
		super(`Permission denied: ${action}:${resource}`);
		this.name = 'PermissionDeniedError';
	}
}
