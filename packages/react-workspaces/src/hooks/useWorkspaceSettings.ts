import type {
	IUpdateSettingsInput,
	IWorkspaceSettingsDTO,
	WorkspacesClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWorkspaceSettingsReturn {
	settings: IWorkspaceSettingsDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateSettings: (input: IUpdateSettingsInput) => Promise<void>;
}

export function useWorkspaceSettings(client?: WorkspacesClient): IUseWorkspaceSettingsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceSettings');
	const [settings, setSettings] = useState<IWorkspaceSettingsDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.getSettings({ bust: opts?.force });
				setSettings(result.settings);
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

	const updateSettings = useCallback(
		async (input: IUpdateSettingsInput) => {
			setError(null);
			try {
				const { result } = await workspaces.updateSettings(input);
				setSettings(result.settings);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { settings, isLoading, error, refresh, updateSettings };
}
