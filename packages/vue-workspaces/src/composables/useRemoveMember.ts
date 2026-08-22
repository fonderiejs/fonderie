import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseRemoveMemberReturn {
	removeMember: (userId: string) => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

/** @deprecated Use useMembers().removeMember — the list hook self-refreshes after the write. */
export function useRemoveMember(client?: WorkspacesClient): IUseRemoveMemberReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useRemoveMember');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function removeMember(userId: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await workspaces.removeMember(userId);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { removeMember, isLoading, error };
}
