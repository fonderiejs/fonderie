import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseForgotPasswordReturn {
	forgotPassword: (email: string) => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	sent: Ref<boolean>;
}

export function useForgotPassword(client?: AuthClient): IUseForgotPasswordReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useForgotPassword');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const sent = ref(false);

	async function forgotPassword(email: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await auth.forgotPassword(email);
			sent.value = true;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { forgotPassword, isLoading, error, sent };
}
