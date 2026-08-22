import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

/** @deprecated Use `useMembers().removeMember` instead — the list hook self-refreshes after the write. */
export interface IUseRemoveMemberReturn {
	removeMember: (userId: string) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use `useMembers().removeMember` instead — the list hook self-refreshes after the write. */
export function useRemoveMember(client?: WorkspacesClient): IUseRemoveMemberReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useRemoveMember');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const removeMember = useCallback(
		async (userId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				await workspaces.removeMember(userId);
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

	return { removeMember, isLoading, error };
}
