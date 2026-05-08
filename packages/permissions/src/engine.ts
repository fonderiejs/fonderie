import type { IStoreAdapter }    from '@fonderie-js/store';

import type { Operation }         from './types';
import type { IPermissionsConfig } from './config';
import { getMembership, hasRole } from './services/membership';
import { checkPermission }        from './services/permissions';

export class PermissionsEngine {
	private superRole: string

	constructor(
		private store: IStoreAdapter,
		config: IPermissionsConfig = {},
	) {
		this.superRole = config.superRole ?? 'owner'
	}

	async getMembership(userId: string, workspaceId: string) {
		return getMembership(userId, workspaceId, this.store)
	}

	async can(
		userId:        string,
		operation:     Operation,
		permissionKey: string,
		workspaceId:   string,
	): Promise<boolean> {
		const isMember = await getMembership(userId, workspaceId, this.store)
		if (!isMember) return false

		if (await hasRole(userId, workspaceId, this.superRole, this.store)) return true

		return checkPermission(userId, workspaceId, permissionKey, operation, this.store)
	}

	async assert(
		userId:        string,
		operation:     Operation,
		permissionKey: string,
		workspaceId:   string,
	): Promise<void> {
		const allowed = await this.can(userId, operation, permissionKey, workspaceId)
		if (!allowed) {
			throw new PermissionDeniedError(operation, permissionKey)
		}
	}

	async canAll(
		userId:      string,
		checks:      Array<{ operation: Operation; permissionKey: string }>,
		workspaceId: string,
	): Promise<boolean> {
		const isMember = await getMembership(userId, workspaceId, this.store)
		if (!isMember) return false

		if (await hasRole(userId, workspaceId, this.superRole, this.store)) return true

		const results = await Promise.all(
			checks.map(c => checkPermission(userId, workspaceId, c.permissionKey, c.operation, this.store))
		)
		return results.every(Boolean)
	}

	async canAny(
		userId:      string,
		checks:      Array<{ operation: Operation; permissionKey: string }>,
		workspaceId: string,
	): Promise<boolean> {
		const isMember = await getMembership(userId, workspaceId, this.store)
		if (!isMember) return false

		if (await hasRole(userId, workspaceId, this.superRole, this.store)) return true

		const results = await Promise.all(
			checks.map(c => checkPermission(userId, workspaceId, c.permissionKey, c.operation, this.store))
		)
		return results.some(Boolean)
	}
}

export class PermissionDeniedError extends Error {
	readonly status = 403;

	constructor(operation: string, permissionKey: string) {
		super(`Permission denied: ${operation}:${permissionKey}`)
		this.name = 'PermissionDeniedError'
	}
}
