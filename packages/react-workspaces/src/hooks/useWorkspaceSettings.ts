import type {
	IUpdateSettingsInput,
	IWorkspaceSettingsDTO,
	WorkspacesClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWorkspaceSettingsReturn {
	settings: IWorkspaceSettingsDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	updateSettings: (input: IUpdateSettingsInput) => Promise<void>;
}

export function useWorkspaceSettings(client: WorkspacesClient): IUseWorkspaceSettingsReturn {
	const [settings, setSettings] = useState<IWorkspaceSettingsDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getSettings();
			setSettings(result.settings);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const updateSettings = useCallback(
		async (input: IUpdateSettingsInput) => {
			setError(null);
			try {
				const { result } = await client.updateSettings(input);
				setSettings(result.settings);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { settings, isLoading, error, refresh, updateSettings };
}
