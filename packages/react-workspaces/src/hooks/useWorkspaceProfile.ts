import type { IUpdateWorkspaceInput, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseWorkspaceProfileReturn {
	updateWorkspace: (input: IUpdateWorkspaceInput) => Promise<IWorkspaceDTO>;
	archiveWorkspace: () => Promise<void>;
	restoreWorkspace: () => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

// Action-only, like useUpdateRole — there's no "get current workspace"
// route (only getWorkspace(id) for admin/cross-workspace lookups), so the
// caller already has the workspace object from useWorkspaces()'s list.
export function useWorkspaceProfile(client: WorkspacesClient): IUseWorkspaceProfileReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const updateWorkspace = useCallback(
		async (input: IUpdateWorkspaceInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.updateWorkspace(input);
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
		[client],
	);

	// Personal workspaces can't be archived — the server returns 403; surfaced via `error`.
	const archiveWorkspace = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			await client.archiveWorkspace();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const restoreWorkspace = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			await client.restoreWorkspace();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	return { updateWorkspace, archiveWorkspace, restoreWorkspace, isLoading, error };
}
