import type { IStoreAdapter } from '@fonderie-js/store';

import type { IInvitation } from '../types';
import {
	createInvitation, listInvitations,
	cancelInvitation, acceptInvitationByPin,
} from '../services/invitations';

export class InvitationModel {
	constructor(private readonly store: IStoreAdapter) {}

	create(opts: Parameters<typeof createInvitation>[0]): Promise<IInvitation> {
		return createInvitation(opts, this.store)
	}

	list(workspaceId: string): Promise<IInvitation[]> {
		return listInvitations(workspaceId, this.store)
	}

	cancel(invitationId: string, workspaceId: string): Promise<void> {
		return cancelInvitation(invitationId, workspaceId, this.store)
	}

	acceptByPin(opts: Parameters<typeof acceptInvitationByPin>[0]): Promise<{ workspaceId: string; roleId: string }> {
		return acceptInvitationByPin(opts, this.store)
	}
}
