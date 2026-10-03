import type { FonderieApiError, IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseInvitationsReturn {
	invitations: Ref<IInvitationDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
	cancelInvitation: (inviteId: string) => Promise<void>;
}

const NONE: IInvitationDTO[] = [];

// The selected workspace's invitations — re-read on a workspace switch.
export function useInvitations(client?: WorkspacesClient): IUseInvitationsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useInvitations');
	const q = useScopedQuery(workspaces, '/workspaces/invitations', async (bust) => (await workspaces.listInvitations({ bust })).result.invitations);
	const w = useWrite(() => q.refresh());
	return {
		invitations: computed(() => q.data.value ?? NONE),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		invite: (entries) =>
			w.run(async () => {
				await workspaces.invite(entries);
			}),
		cancelInvitation: (inviteId) =>
			w.run(async () => {
				await workspaces.cancelInvitation(inviteId);
			}),
	};
}
