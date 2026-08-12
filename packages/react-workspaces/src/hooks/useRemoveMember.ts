import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseRemoveMemberReturn {
	removeMember: (userId: string) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useRemoveMember(client: WorkspacesClient): IUseRemoveMemberReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const removeMember = useCallback(
		async (userId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.removeMember(userId);
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

	return { removeMember, isLoading, error };
}
