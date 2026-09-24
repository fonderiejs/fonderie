import type { ConfigAdminClient, ISecretEntry, ISetSecretInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useSecrets(client: ConfigAdminClient, environment?: string) {
	const secrets = ref<ISecretEntry[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			// A 200 does not guarantee the SHAPE. /_admin/config is owned by
			// @fonderie/admin (its declared-vs-held report, an object) while this
			// client expects the config brick's array of entries — so a deployment
			// without @fonderie/config answered 200 with an object and the screen
			// died on `.map`. Refuse the wrong shape here, where it can be reported.
			const { result } = await client.listSecrets(environment);
			if (!Array.isArray(result))
				throw new FonderieApiError(
					'UNEXPECTED_SHAPE',
					'Secret list returned an unexpected shape — is @fonderie/config mounted at this prefix?',
					200,
				);
			secrets.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	async function saveSecret(key: string, input: ISetSecretInput) {
		error.value = null;
		try {
			const { result } = await client.setSecret(key, input, environment);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeSecret(key: string) {
		error.value = null;
		try {
			await client.deleteSecret(key, environment);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { secrets, isLoading, error, refresh, saveSecret, removeSecret };
}
