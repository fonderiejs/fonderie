import type { FonderieApiError, IUpdateSettingsInput, IWorkspaceSettingsDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseWorkspaceSettingsReturn {
	settings: IWorkspaceSettingsDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateSettings: (input: IUpdateSettingsInput) => Promise<void>;
}

// The selected workspace's settings — re-read on a workspace switch.
export function useWorkspaceSettings(client?: WorkspacesClient): IUseWorkspaceSettingsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceSettings');
	const q = useScopedQuery(workspaces, '/workspaces/settings', async (bust) => (await workspaces.getSettings({ bust })).result.settings);
	const w = useWrite();
	const updateSettings = useCallback(
		(input: IUpdateSettingsInput) =>
			w.run(async () => {
				// The update returns the new settings: every screen adopts them.
				q.adopt((await workspaces.updateSettings(input)).result.settings);
			}),
		[workspaces, w.run, q.adopt],
	);
	return { settings: q.data ?? null, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, updateSettings };
}
