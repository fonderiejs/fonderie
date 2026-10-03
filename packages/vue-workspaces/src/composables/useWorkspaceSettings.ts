import type { FonderieApiError, IUpdateSettingsInput, IWorkspaceSettingsDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseWorkspaceSettingsReturn {
	settings: Ref<IWorkspaceSettingsDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateSettings: (input: IUpdateSettingsInput) => Promise<void>;
}

// The selected workspace's settings — re-read on a workspace switch.
export function useWorkspaceSettings(client?: WorkspacesClient): IUseWorkspaceSettingsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceSettings');
	const q = useScopedQuery(workspaces, '/workspaces/settings', async (bust) => (await workspaces.getSettings({ bust })).result.settings);
	const w = useWrite();
	return {
		settings: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		// The update returns the new settings: every screen adopts them.
		updateSettings: (input) =>
			w.run(async () => {
				q.adopt((await workspaces.updateSettings(input)).result.settings);
			}),
	};
}
