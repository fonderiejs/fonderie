import type { ICreateWorkspaceInput, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseCreateWorkspaceReturn {
	createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useCreateWorkspace(client?: WorkspacesClient): IUseCreateWorkspaceReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useCreateWorkspace');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const createWorkspace = useCallback(
		async (input: ICreateWorkspaceInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.createWorkspace(input);
				return result.workspace;
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

	return { createWorkspace, isLoading, error };
}
