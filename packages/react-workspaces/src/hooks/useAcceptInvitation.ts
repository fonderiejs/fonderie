import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

/** @deprecated Use `useWorkspaces().acceptInvitation` instead — the list hook self-refreshes after the write. */
export interface IUseAcceptInvitationReturn {
	acceptInvitation: (pin: string) => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use `useWorkspaces().acceptInvitation` instead — the list hook self-refreshes after the write. */
export function useAcceptInvitation(client?: WorkspacesClient): IUseAcceptInvitationReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useAcceptInvitation');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const acceptInvitation = useCallback(
		async (pin: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.acceptInvitation(pin);
				return result.workspaceId;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[workspaces],
	);

	return { acceptInvitation, isLoading, error };
}
