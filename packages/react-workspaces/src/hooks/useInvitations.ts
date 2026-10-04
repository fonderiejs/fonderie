import type { FonderieApiError, IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseInvitationsReturn {
	invitations: IInvitationDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
	cancelInvitation: (inviteId: string) => Promise<void>;
	/** Send again with a new link and PIN (the old ones stop working) and a fresh expiry. */
	resendInvitation: (inviteId: string) => Promise<void>;
}

const NONE: IInvitationDTO[] = [];

// The selected workspace's pending invitations — re-read on a workspace switch.
export function useInvitations(client?: WorkspacesClient): IUseInvitationsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useInvitations');
	const q = useScopedQuery(
		workspaces,
		'/workspaces/invitations',
		async (bust) => (await workspaces.listInvitations({ bust })).result.invitations,
	);
	const w = useWrite(q.refresh);
	const invite = useCallback(
		(entries: IInviteEntry | IInviteEntry[]) =>
			w.run(async () => {
				await workspaces.invite(entries);
			}),
		[workspaces, w.run],
	);
	const cancelInvitation = useCallback(
		(inviteId: string) =>
			w.run(async () => {
				await workspaces.cancelInvitation(inviteId);
			}),
		[workspaces, w.run],
	);
	const resendInvitation = useCallback(
		(inviteId: string) =>
			w.run(async () => {
				await workspaces.resendInvitation(inviteId);
			}),
		[workspaces, w.run],
	);
	return {
		invitations: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		invite,
		cancelInvitation,
		resendInvitation,
	};
}
