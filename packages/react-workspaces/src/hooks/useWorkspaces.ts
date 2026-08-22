import type { IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWorkspacesReturn {
	workspaces: IWorkspaceDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useWorkspaces(client?: WorkspacesClient): IUseWorkspacesReturn {
	// Named `resolved` (not `workspaces`) to avoid shadowing the list state below.
	const resolved = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaces');
	const [workspaces, setWorkspaces] = useState<IWorkspaceDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await resolved.listWorkspaces();
			setWorkspaces(result.workspaces);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [resolved]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { workspaces, isLoading, error, refresh };
}
