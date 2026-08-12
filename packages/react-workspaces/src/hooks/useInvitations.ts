import type { IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseInvitationsReturn {
	invitations: IInvitationDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
	cancelInvitation: (inviteId: string) => Promise<void>;
}

export function useInvitations(client: WorkspacesClient): IUseInvitationsReturn {
	const [invitations, setInvitations] = useState<IInvitationDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listInvitations();
			setInvitations(result.invitations);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const invite = useCallback(
		async (entries: IInviteEntry | IInviteEntry[]) => {
			setError(null);
			try {
				await client.invite(entries);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	const cancelInvitation = useCallback(
		async (inviteId: string) => {
			setError(null);
			try {
				await client.cancelInvitation(inviteId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { invitations, isLoading, error, refresh, invite, cancelInvitation };
}
