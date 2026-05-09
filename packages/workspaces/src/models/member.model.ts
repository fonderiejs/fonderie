import type { IStoreAdapter } from '@fonderie-js/store';

import type { IMember, IRole } from '../types';
import {
	getMember, listMembers, addMember, removeMember,
	getUserRoles, addRoleToMember, removeRoleFromMember,
} from '../services/members';

export class MemberModel {
	constructor(private readonly store: IStoreAdapter) {}

	get(userId: string, workspaceId: string): Promise<IMember | null> {
		return getMember(userId, workspaceId, this.store)
	}

	list(workspaceId: string): Promise<IMember[]> {
		return listMembers(workspaceId, this.store)
	}

	add(opts: Parameters<typeof addMember>[0]): Promise<void> {
		return addMember(opts, this.store)
	}

	remove(userId: string, workspaceId: string): Promise<void> {
		return removeMember(userId, workspaceId, this.store)
	}

	getUserRoles(userId: string, workspaceId: string): Promise<IRole[]> {
		return getUserRoles(userId, workspaceId, this.store)
	}

	addRole(userId: string, workspaceId: string, roleId: string): Promise<void> {
		return addRoleToMember(userId, workspaceId, roleId, this.store)
	}

	removeRole(userId: string, workspaceId: string, roleId: string): Promise<void> {
		return removeRoleFromMember(userId, workspaceId, roleId, this.store)
	}
}
