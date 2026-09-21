import type { AuthAdminClient, ISessionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import type { Ref } from 'vue';
import { ref, watch } from 'vue';

export function useAdminUserSessions(client: AuthAdminClient, userId: Ref<string | null>) {
	const sessions = ref<ISessionDTO[]>([]);
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		if (!userId.value) {
			sessions.value = [];
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listUserSessions(userId.value);
			sessions.value = result;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoading.value = false;
		}
	}

	watch(userId, () => void refresh(), { immediate: true });

	return { sessions, isLoading, error, refresh };
}
