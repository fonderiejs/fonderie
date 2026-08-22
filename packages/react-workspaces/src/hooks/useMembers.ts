import type { IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseMembersReturn {
	members: IMemberDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useMembers(client?: WorkspacesClient): IUseMembersReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useMembers');
	const [members, setMembers] = useState<IMemberDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await workspaces.listMembers();
			setMembers(result.members);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [workspaces]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { members, isLoading, error, refresh };
}
