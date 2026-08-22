import type {
	IUpdateSettingsInput,
	IWorkspaceSettingsDTO,
	WorkspacesClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useWorkspaceSettings(client?: WorkspacesClient) {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceSettings');
	const settings = ref<IWorkspaceSettingsDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.getSettings({ bust: opts?.force });
			settings.value = result.settings;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function updateSettings(input: IUpdateSettingsInput) {
		error.value = null;
		try {
			const { result } = await workspaces.updateSettings(input);
			settings.value = result.settings;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { settings, isLoading, error, refresh, updateSettings };
}
