import type { IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseInvitationsReturn {
	invitations: IInvitationDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
	cancelInvitation: (inviteId: string) => Promise<void>;
}

export function useInvitations(client?: WorkspacesClient): IUseInvitationsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useInvitations');
	const [invitations, setInvitations] = useState<IInvitationDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await workspaces.listInvitations();
			setInvitations(result.invitations);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [workspaces]);

	const invite = useCallback(
		async (entries: IInviteEntry | IInviteEntry[]) => {
			setError(null);
			try {
				await workspaces.invite(entries);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, refresh],
	);

	const cancelInvitation = useCallback(
		async (inviteId: string) => {
			setError(null);
			try {
				await workspaces.cancelInvitation(inviteId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { invitations, isLoading, error, refresh, invite, cancelInvitation };
}
