import type { AuthClient, IResetPasswordInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useResetPassword(client?: AuthClient) {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useResetPassword');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const done = ref(false);

	async function resetPassword(input: IResetPasswordInput) {
		isLoading.value = true;
		error.value = null;
		try {
			await auth.resetPassword(input);
			done.value = true;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { resetPassword, isLoading, error, done };
}
