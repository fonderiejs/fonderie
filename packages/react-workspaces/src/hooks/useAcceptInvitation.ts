import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseAcceptInvitationReturn {
	acceptInvitation: (pin: string) => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useAcceptInvitation(client: WorkspacesClient): IUseAcceptInvitationReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const acceptInvitation = useCallback(
		async (pin: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.acceptInvitation(pin);
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
		[client],
	);

	return { acceptInvitation, isLoading, error };
}
