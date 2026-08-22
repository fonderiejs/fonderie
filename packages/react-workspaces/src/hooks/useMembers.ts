import type { IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseMembersReturn {
	members: IMemberDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	removeMember: (userId: string) => Promise<void>;
}

export function useMembers(client?: WorkspacesClient): IUseMembersReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useMembers');
	const [members, setMembers] = useState<IMemberDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.listMembers({ bust: opts?.force });
				setMembers(result.members);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[workspaces],
	);

	const removeMember = useCallback(
		async (userId: string) => {
			setError(null);
			try {
				await workspaces.removeMember(userId);
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

	return { members, isLoading, error, refresh, removeMember };
}
