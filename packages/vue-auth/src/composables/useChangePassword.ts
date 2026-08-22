import type { AuthClient, IChangePasswordInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseChangePasswordReturn {
	changePassword: (input: IChangePasswordInput) => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	done: Ref<boolean>;
}

export function useChangePassword(client?: AuthClient): IUseChangePasswordReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useChangePassword');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const done = ref(false);

	async function changePassword(input: IChangePasswordInput) {
		isLoading.value = true;
		error.value = null;
		done.value = false;
		try {
			await auth.changePassword(input);
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

	return { changePassword, isLoading, error, done };
}
