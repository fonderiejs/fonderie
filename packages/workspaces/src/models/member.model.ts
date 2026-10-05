import type { IStoreAdapter } from '@fonderie/store';

import type { IMember, IRole } from '../types';
import {
	getMember,
	listMembers,
	addMember,
	removeMember,
	getUserRoles,
	addRoleToMember,
	removeRoleFromMember,
	countOccupiedSeats,
	setManager,
	transferOwnership,
} from '../services/members';

export class MemberModel {
	constructor(private readonly store: IStoreAdapter) {}

	get(userId: string, workspaceId: string): Promise<IMember | null> {
		return getMember(userId, workspaceId, this.store);
	}

	list(workspaceId: string, managerRoles?: string[]): Promise<IMember[]> {
		return listMembers(workspaceId, this.store, managerRoles);
	}

	countSeats(workspaceId: string): Promise<number> {
		return countOccupiedSeats(workspaceId, this.store);
	}

	setManager(userId: string, workspaceId: string, manager: boolean, managerRole?: string): Promise<boolean> {
		return setManager(userId, workspaceId, manager, this.store, managerRole);
	}

	transferOwnership(workspaceId: string, fromUserId: string, toUserId: string, managerRole?: string): Promise<boolean> {
		return transferOwnership(workspaceId, fromUserId, toUserId, this.store, managerRole);
	}

	add(opts: Parameters<typeof addMember>[0]): Promise<void> {
		return addMember(opts, this.store);
	}

	remove(userId: string, workspaceId: string): ReturnType<typeof removeMember> {
		return removeMember(userId, workspaceId, this.store);
	}

	getUserRoles(userId: string, workspaceId: string): Promise<IRole[]> {
		return getUserRoles(userId, workspaceId, this.store);
	}

	addRole(userId: string, workspaceId: string, roleId: string): ReturnType<typeof addRoleToMember> {
		return addRoleToMember(userId, workspaceId, roleId, this.store);
	}

	removeRole(userId: string, workspaceId: string, roleId: string): ReturnType<typeof removeRoleFromMember> {
		return removeRoleFromMember(userId, workspaceId, roleId, this.store);
	}
}
